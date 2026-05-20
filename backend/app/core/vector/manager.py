# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""向量存储管理器 — 组合 EmbeddingProvider + VectorDriver"""

import asyncio
import logging
from typing import TypedDict

from langchain_core.documents import Document as LangChainDocument

from app.core.ai.providers.base import Resolved
from app.core.ai.providers.embedding import EmbeddingProvider
from app.core.ai.providers.openai_embeddings import OpenAICompatibleEmbeddings
from app.core.vector.driver.base import DriverSearchResult, VectorChunk, VectorDriver

logger = logging.getLogger(__name__)


class VectorSearchResult(TypedDict):
    doc: LangChainDocument
    score: float
    score_comparable: bool


class VectorStoreManager:
    """Orchestrates EmbeddingProvider and VectorDriver.

    Responsible for:
    - Resolving the correct embeddings instance for the current tenant
    - Ensuring the storage schema is initialised before the first write/read
    - Delegating all actual storage operations to the injected VectorDriver
    - Caching the most recent embedding resolution so observability layers
      (RAG pipeline summary card) can read model / hash without re-resolving.
    """

    def __init__(self, provider: EmbeddingProvider, driver: VectorDriver) -> None:
        self._provider = provider
        self._driver = driver
        self._lock = asyncio.Lock()
        # conf_hashes for which schema has already been verified this process lifetime
        self._schema_initialized: set[str] = set()
        # 最近一次 _get_ready 的解析结果，供观测层读取（替代之前的 ContextVar）
        self._last_embedding: Resolved[OpenAICompatibleEmbeddings] | None = None

    # ──────────────────────────────────────────────────────────────────────
    # Internal: resolve embeddings + ensure schema
    # ──────────────────────────────────────────────────────────────────────

    async def _get_ready(
        self,
        tenant_id: int | None = None,
        force: bool = False,
        purpose: str | None = None,
    ) -> Resolved[OpenAICompatibleEmbeddings]:
        resolved = await self._provider.resolve(tenant_id, force=force, purpose=purpose)
        self._last_embedding = resolved

        conf_hash = resolved.hash
        if conf_hash not in self._schema_initialized:
            async with self._lock:
                if conf_hash not in self._schema_initialized:
                    # Dimension 在 EmbeddingProvider 的 signal_extras 中以 int 或 None 暴露
                    raw_dim = resolved.extra.get("Dimension")
                    dimension = int(raw_dim) if isinstance(raw_dim, int) else 1024
                    await self._driver.ensure_schema(dimension)
                    self._schema_initialized.add(conf_hash)

        return resolved

    # ──────────────────────────────────────────────────────────────────────
    # Public interface
    # ──────────────────────────────────────────────────────────────────────

    async def add_documents(
        self,
        documents: list[LangChainDocument],
        ids: list[str],
        storage_batch_size: int = 100,
    ) -> list[str]:
        resolved = await self._get_ready()
        return await self._driver.add_documents(
            documents, ids, resolved.instance, storage_batch_size
        )

    async def search(
        self,
        query: str,
        k: int = 5,
        metadata_filter: dict | None = None,
        purpose: str | None = None,
    ) -> list[VectorSearchResult]:
        resolved = await self._get_ready(purpose=purpose)
        raw: list[DriverSearchResult] = await self._driver.search(
            query, resolved.instance, k, metadata_filter
        )
        return [
            {"doc": r["doc"], "score": r["score"], "score_comparable": r["score_comparable"]}
            for r in raw
        ]

    async def delete_documents(self, ids: list[str]) -> None:
        await self._get_ready()
        await self._driver.delete_by_ids(ids)

    async def delete_by_metadata(self, key: str, value: str | int) -> None:
        await self._get_ready()
        await self._driver.delete_by_filter(key, value)

    async def get_chunks_by_metadata(self, key: str, value: str | int) -> list[VectorChunk]:
        await self._get_ready()
        return await self._driver.get_by_filter(key, value)

    async def ping(self) -> bool:
        return await self._driver.ping()

    async def close(self) -> None:
        await self._driver.close()
        await self._provider.aclose()

    async def validate_config(
        self, tenant_id: int | None = None
    ) -> Resolved[OpenAICompatibleEmbeddings]:
        """Resolve and validate embedding config; raises if the upstream config is bad."""
        return await self._get_ready(tenant_id=tenant_id)

    async def reload_credentials(self, tenant_id: int | None = None) -> None:
        """Force-refresh embedding config and clear schema-init cache so next op re-verifies."""
        await self._provider.resolve(tenant_id, force=True)
        self._schema_initialized.clear()

    @property
    def vector_backend(self) -> str:
        """返回当前向量后端的可读名称（例如 'Elasticsearch' / 'PostgreSQL'）。"""
        name = type(self._driver).__name__
        return name.replace("Driver", "") if name.endswith("Driver") else name

    @property
    def last_embedding(self) -> Resolved[OpenAICompatibleEmbeddings] | None:
        """最近一次 ``_get_ready`` 返回的 ``Resolved``，未调用前为 ``None``。

        观测层（RAG pipeline summary card）通过它读 ``.model`` / ``.hash``，
        不需要重新解析配置。``VectorStoreManager.get_instance()`` 由
        :mod:`app.core.vector` 包级 shim 提供，不在本类上定义。
        """
        return self._last_embedding
