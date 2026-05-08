# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""Elasticsearch 向量存储驱动

索引策略：单一索引 catwiki_documents，依靠 metadata.tenant_id 实现逻辑隔离。
搜索策略：KNN + BM25 并行查询，Python 侧 RRF 合并（Basic License 兼容）。
弹性策略：所有 ES 操作经由 CircuitBreaker + retry_on_transient 保护。

重要约束：
- flattened 类型将所有 metadata 叶子值以 keyword string 存储，_build_es_filter
  中的 str() 转换不可省略。
- ES 服务端 RRF / Linear Retriever 均需 Platinum License，Basic License 下不可用。
"""

from __future__ import annotations

import asyncio
import logging
import time
from typing import TYPE_CHECKING, Any

from langchain_core.documents import Document as LangChainDocument

from app.core.vector.driver.base import (
    ALLOWED_FILTER_KEYS,
    DriverSearchResult,
    VectorChunk,
    VectorDriver,
)
from app.core.vector.exceptions import (
    VectorStoreBulkWriteError,
    VectorStoreConnectionError,
    VectorStoreDimensionError,
    VectorStoreSchemaError,
)
from app.core.vector.retry import CircuitBreaker, RetryPolicy, retry_on_transient

if TYPE_CHECKING:
    from elasticsearch import AsyncElasticsearch

logger = logging.getLogger(__name__)

_RRF_K = 60  # RRF ranking constant — higher values average scores more, typically 60
_TOP_LEVEL_FIELDS: frozenset[str] = frozenset({"chunk_index", "summary", "tags"})

# Retry policy for ES: also retry on 429 (rate limit) and 503 (shard not ready)
_ES_RETRY_POLICY = RetryPolicy(
    max_attempts=4,
    retryable_http_statuses=frozenset({429, 503}),
    base_delay=5.0,
    max_delay=30.0,
    backoff_factor=2.0,
    jitter=True,
)


class ElasticsearchDriver(VectorDriver):
    """Pure-storage Elasticsearch driver.

    Args:
        index_name: ES index name (default: catwiki_documents).
        es_client:  Inject a pre-built AsyncElasticsearch for testing; production leaves None.
    """

    def __init__(
        self,
        index_name: str = "catwiki_documents",
        *,
        es_client: AsyncElasticsearch | None = None,
    ) -> None:
        self.index_name = index_name
        self._es_client: AsyncElasticsearch | None = es_client
        self._lock = asyncio.Lock()
        self._circuit_breaker = CircuitBreaker(name="ESVectorStore")

    # ──────────────────────────────────────────────────────────────────────
    # Client initialisation
    # ──────────────────────────────────────────────────────────────────────

    def _init_es_client(self) -> Any:
        from elasticsearch import AsyncElasticsearch

        from app.core.infra.config import settings

        kwargs: dict[str, Any] = {"hosts": [settings.ES_URL]}

        if settings.ES_API_KEY:
            kwargs["api_key"] = settings.ES_API_KEY
        elif settings.ES_USERNAME and settings.ES_PASSWORD:
            kwargs["basic_auth"] = (settings.ES_USERNAME, settings.ES_PASSWORD)

        if settings.ES_CA_CERTS:
            kwargs["ca_certs"] = settings.ES_CA_CERTS
            kwargs["verify_certs"] = True
        elif not settings.ES_VERIFY_CERTS:
            kwargs["verify_certs"] = False

        logger.info(f"[ES] Connecting to Elasticsearch: {settings.ES_URL}")
        return AsyncElasticsearch(**kwargs)

    async def _ensure_client(self) -> None:
        """Ensure the ES client exists; double-check locking for concurrency safety."""
        if self._es_client is not None:
            return
        async with self._lock:
            if self._es_client is None:
                try:
                    self._es_client = self._init_es_client()
                except Exception as e:
                    raise VectorStoreConnectionError(f"ES client init failed: {e}") from e

    # ──────────────────────────────────────────────────────────────────────
    # Index maintenance
    # ──────────────────────────────────────────────────────────────────────

    async def _create_index(self, dimension: int) -> None:
        try:
            await self._es_client.indices.create(
                index=self.index_name,
                settings={
                    "index": {
                        "number_of_shards": 1,
                        "number_of_replicas": 0,
                        "refresh_interval": "1s",
                    }
                },
                mappings={
                    "properties": {
                        "text": {
                            "type": "text",
                            "analyzer": "ik_max_word",
                            "search_analyzer": "ik_smart",
                        },
                        "summary": {
                            "type": "text",
                            "analyzer": "ik_max_word",
                            "search_analyzer": "ik_smart",
                        },
                        "tags": {
                            "type": "text",
                            "analyzer": "ik_max_word",
                            "search_analyzer": "ik_smart",
                        },
                        "vector": {
                            "type": "dense_vector",
                            "dims": dimension,
                            "index": True,
                            "similarity": "cosine",
                        },
                        "chunk_index": {"type": "integer"},
                        "metadata": {"type": "flattened"},
                    }
                },
            )
            logger.info(f"[ES] Index created: {self.index_name} (dim={dimension})")
        except Exception as e:
            if "resource_already_exists_exception" in str(e).lower():
                return
            raise VectorStoreSchemaError(f"Failed to create ES index: {e}") from e

    async def _check_index_dimension(self, expected_dim: int) -> None:
        try:
            mapping = await self._es_client.indices.get_mapping(index=self.index_name)
            props = mapping[self.index_name]["mappings"].get("properties", {})
            actual_dim = props.get("vector", {}).get("dims")
            if actual_dim is None:
                return
            if actual_dim != expected_dim:
                raise VectorStoreDimensionError(
                    f"ES dimension mismatch: index '{self.index_name}' has {actual_dim}, "
                    f"config requires {expected_dim}. Fix: DELETE /{self.index_name}"
                )
            logger.debug(f"[ES] Dimension check passed: {actual_dim}")
        except VectorStoreDimensionError:
            raise
        except Exception as e:
            if "index_not_found" in str(e).lower():
                return
            raise

    async def _wait_for_shards(self) -> None:
        try:
            resp = await self._es_client.cluster.health(
                index=self.index_name,
                wait_for_status="yellow",
                wait_for_active_shards="1",
                timeout="60s",
            )
            logger.debug(f"[ES] Shards ready, cluster status: {resp.get('status', 'unknown')}")
        except Exception as e:
            logger.warning(f"[ES] Shard wait timed out, proceeding anyway: {e}")

    # ──────────────────────────────────────────────────────────────────────
    # Schema entry point (VectorDriver interface)
    # ──────────────────────────────────────────────────────────────────────

    async def ensure_schema(self, dimension: int) -> None:
        """Create index if absent; validate dimension if index already exists."""
        await self._ensure_client()
        try:
            index_exists = await self._es_client.indices.exists(index=self.index_name)
            if not index_exists:
                await self._create_index(dimension)
            else:
                await self._check_index_dimension(dimension)
            await self._wait_for_shards()
        except (VectorStoreDimensionError, VectorStoreSchemaError):
            raise
        except Exception as e:
            raise VectorStoreSchemaError(f"ES schema setup failed: {e}") from e

    # ──────────────────────────────────────────────────────────────────────
    # Filter DSL conversion
    # ──────────────────────────────────────────────────────────────────────

    def _build_es_filter(self, criteria: dict) -> list[dict]:
        """Convert a generic filter dict to an ES DSL term list.

        chunk_index is a top-level integer field; all other keys live inside the
        flattened metadata field and must be queried as strings.
        """
        for k in criteria:
            if k not in ALLOWED_FILTER_KEYS:
                raise ValueError(f"Disallowed filter key: {k!r}")
        clauses = []
        for k, v in criteria.items():
            if k == "chunk_index":
                clauses.append({"term": {"chunk_index": v}})
            else:
                clauses.append({"term": {f"metadata.{k}": str(v)}})
        return clauses

    # ──────────────────────────────────────────────────────────────────────
    # VectorDriver operations
    # ──────────────────────────────────────────────────────────────────────

    async def add_documents(
        self,
        documents: list[LangChainDocument],
        ids: list[str],
        embeddings: Any,
        batch_size: int = 100,
    ) -> list[str]:
        await self._ensure_client()
        start_time = time.time()
        total = len(documents)

        for i in range(0, total, batch_size):
            batch_docs = documents[i : i + batch_size]
            batch_ids = ids[i : i + batch_size]
            vectors = await embeddings.aembed_documents([doc.page_content for doc in batch_docs])

            operations = []
            for doc, doc_id, vector in zip(batch_docs, batch_ids, vectors):
                chunk_index = doc.metadata.get("chunk_index")
                summary = doc.metadata.get("summary") or ""
                tags = doc.metadata.get("tags") or ""
                es_doc: dict = {
                    "text": doc.page_content,
                    "summary": summary,
                    "tags": tags,
                    "vector": vector,
                    "metadata": {
                        k: v for k, v in doc.metadata.items() if k not in _TOP_LEVEL_FIELDS
                    },
                }
                if chunk_index is not None:
                    es_doc["chunk_index"] = int(chunk_index)
                operations.append({"index": {"_index": self.index_name, "_id": doc_id}})
                operations.append(es_doc)

            resp = await self._circuit_breaker.call(
                lambda ops=operations: retry_on_transient(
                    lambda: self._es_client.bulk(operations=ops, refresh=False),
                    policy=_ES_RETRY_POLICY,
                    operation="bulk_index",
                ),
                operation="bulk_index",
            )

            if resp.get("errors"):
                failed_ids = [
                    batch_ids[idx]
                    for idx, item in enumerate(resp.get("items", []))
                    if item.get("index", {}).get("error")
                ]
                raise VectorStoreBulkWriteError(
                    f"ES bulk write failed ({len(failed_ids)} docs)",
                    failed_ids=failed_ids,
                )
            logger.debug(
                f"[ES] Stored batch {i // batch_size + 1}/{(total + batch_size - 1) // batch_size}"
            )

        logger.info(f"[ES] Stored {total} documents in {time.time() - start_time:.3f}s")
        return ids

    async def search(
        self,
        query: str,
        embeddings: Any,
        k: int,
        metadata_filter: dict | None,
    ) -> list[DriverSearchResult]:
        """KNN + BM25 parallel search with Python-side RRF merge.

        If BM25 fails, degrades gracefully to KNN-only. KNN failure is fatal.
        score=1.0 is a sentinel — not a cosine similarity; score_comparable=False.
        """
        await self._ensure_client()
        query_vector = await embeddings.aembed_query(query)
        es_filter = self._build_es_filter(metadata_filter) if metadata_filter else []
        fetch_k = min(k * 3, 100)

        knn_params: dict = {
            "field": "vector",
            "query_vector": query_vector,
            "k": fetch_k,
            "num_candidates": min(fetch_k * 10, 10000),
        }
        if es_filter:
            knn_params["filter"] = {"bool": {"filter": es_filter}}

        multi_match: dict = {
            "multi_match": {
                "query": query,
                "fields": ["text^1.0", "summary^1.5", "tags^1.2"],
                "type": "best_fields",
            }
        }
        bm25_query: dict = (
            {"bool": {"must": multi_match, "filter": es_filter}} if es_filter else multi_match
        )

        knn_resp, bm25_resp = await asyncio.gather(
            self._circuit_breaker.call(
                lambda: retry_on_transient(
                    lambda: self._es_client.search(
                        index=self.index_name, knn=knn_params, size=fetch_k
                    ),
                    policy=_ES_RETRY_POLICY,
                    operation="knn_search",
                ),
                operation="knn_search",
            ),
            self._circuit_breaker.call(
                lambda: retry_on_transient(
                    lambda: self._es_client.search(
                        index=self.index_name, query=bm25_query, size=fetch_k
                    ),
                    policy=_ES_RETRY_POLICY,
                    operation="bm25_search",
                ),
                operation="bm25_search",
            ),
            return_exceptions=True,
        )

        if isinstance(knn_resp, BaseException):
            raise knn_resp

        if isinstance(bm25_resp, BaseException):
            logger.warning(f"[ES] BM25 failed, falling back to KNN-only: {bm25_resp}")
            bm25_hits: list[dict] = []
        else:
            bm25_hits = bm25_resp["hits"]["hits"]

        # Python-level RRF: accumulate 1/(K + rank + 1) per source
        scores: dict[str, float] = {}
        hit_cache: dict[str, dict] = {}
        for source_hits in (knn_resp["hits"]["hits"], bm25_hits):
            for rank, hit in enumerate(source_hits):
                doc_id = hit["_id"]
                scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (_RRF_K + rank + 1)
                hit_cache.setdefault(doc_id, hit)

        top_ids = sorted(scores, key=lambda x: scores[x], reverse=True)[:k]
        results: list[DriverSearchResult] = []
        for doc_id in top_ids:
            src = hit_cache[doc_id]["_source"]
            results.append(
                {
                    "doc": LangChainDocument(
                        page_content=src.get("text", ""),
                        metadata=src.get("metadata", {}),
                    ),
                    "score": 1.0,
                    "score_comparable": False,
                }
            )

        logger.info(f"[ES] Found {len(results)} chunks (Python RRF)")
        return results

    async def delete_by_ids(self, ids: list[str]) -> None:
        await self._ensure_client()
        logger.info(f"[ES] Deleting {len(ids)} documents by ID")
        operations = [{"delete": {"_index": self.index_name, "_id": doc_id}} for doc_id in ids]
        resp = await self._circuit_breaker.call(
            lambda ops=operations: retry_on_transient(
                lambda: self._es_client.bulk(operations=ops, refresh=False),
                policy=_ES_RETRY_POLICY,
                operation="bulk_delete",
            ),
            operation="bulk_delete",
        )
        if resp.get("errors"):
            failed_ids = [
                ids[i]
                for i, item in enumerate(resp.get("items", []))
                if item.get("delete", {}).get("error")
            ]
            if failed_ids:
                raise VectorStoreBulkWriteError(
                    f"ES bulk delete failed ({len(failed_ids)} docs)",
                    failed_ids=failed_ids,
                )
        logger.info(f"[ES] Deleted {len(ids)} documents")

    async def delete_by_filter(self, key: str, value: str | int) -> None:
        await self._ensure_client()
        logger.info(f"[ES] Deleting by metadata: {key}={value}")
        filter_clauses = self._build_es_filter({key: value})
        resp = await self._circuit_breaker.call(
            lambda fc=filter_clauses: retry_on_transient(
                lambda: self._es_client.delete_by_query(
                    index=self.index_name,
                    query={"bool": {"filter": fc}},
                    conflicts="proceed",
                    wait_for_completion=True,
                    timeout="60s",
                ),
                policy=_ES_RETRY_POLICY,
                operation="delete_by_query",
            ),
            operation="delete_by_query",
        )
        logger.info(f"[ES] Deleted {resp.get('deleted', 0)} docs with {key}={value}")

    async def get_by_filter(self, key: str, value: str | int) -> list[VectorChunk]:
        await self._ensure_client()
        try:
            filter_clauses = self._build_es_filter({key: value})
            resp = await self._circuit_breaker.call(
                lambda fc=filter_clauses: retry_on_transient(
                    lambda: self._es_client.search(
                        index=self.index_name,
                        query={"bool": {"filter": fc}},
                        sort=[{"chunk_index": {"order": "asc"}}],
                        size=10000,
                    ),
                    policy=_ES_RETRY_POLICY,
                    operation="get_by_filter",
                ),
                operation="get_by_filter",
            )
            hits = resp["hits"]["hits"]
            return [
                {
                    "id": hit["_id"],
                    "content": hit["_source"].get("text", ""),
                    "metadata": hit["_source"].get("metadata", {}),
                }
                for hit in hits
            ]
        except Exception as e:
            logger.error(f"[ES] get_by_filter failed: {e}", exc_info=True)
            return []

    async def ping(self) -> bool:
        try:
            if self._es_client is not None:
                return await self._es_client.ping()
            client = self._init_es_client()
            try:
                return await client.ping()
            finally:
                await client.close()
        except Exception as e:
            logger.warning(f"[ES] ping failed: {e}")
            return False

    async def close(self) -> None:
        if self._es_client:
            await self._es_client.close()
            self._es_client = None
            logger.info("[ES] Connection closed")
