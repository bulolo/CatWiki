# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""向量存储管理器 — 组合 EmbeddingResolver + VectorDriver"""

import asyncio
import logging
from typing import Any, TypedDict

from langchain_core.documents import Document as LangChainDocument

from app.core.vector.driver.base import DriverSearchResult, VectorChunk, VectorDriver
from app.core.vector.embedding_resolver import EmbeddingResolver

logger = logging.getLogger(__name__)


class VectorSearchResult(TypedDict):
    doc: LangChainDocument
    score: float
    score_comparable: bool


class VectorStoreManager:
    """Orchestrates EmbeddingResolver and VectorDriver.

    Responsible for:
    - Resolving the correct embeddings instance for the current tenant
    - Ensuring the storage schema is initialised before the first write/read
    - Delegating all actual storage operations to the injected VectorDriver
    """

    def __init__(self, resolver: EmbeddingResolver, driver: VectorDriver) -> None:
        self._resolver = resolver
        self._driver = driver
        self._lock = asyncio.Lock()
        # conf_hashes for which schema has already been verified this process lifetime
        self._schema_initialized: set[str] = set()

    # ──────────────────────────────────────────────────────────────────────
    # Internal: resolve embeddings + ensure schema
    # ──────────────────────────────────────────────────────────────────────

    async def _get_ready(
        self,
        tenant_id: int | None = None,
        force: bool = False,
        purpose: str | None = None,
    ) -> tuple[Any, dict]:
        embeddings, conf = await self._resolver.resolve(tenant_id, force=force, purpose=purpose)
        conf_hash: str = conf.get("_hash", "")

        if conf_hash not in self._schema_initialized:
            async with self._lock:
                if conf_hash not in self._schema_initialized:
                    dimension = int(conf.get("dimension") or 1024)
                    await self._driver.ensure_schema(dimension)
                    self._schema_initialized.add(conf_hash)

        return embeddings, conf

    # ──────────────────────────────────────────────────────────────────────
    # Public interface
    # ──────────────────────────────────────────────────────────────────────

    async def add_documents(
        self,
        documents: list[LangChainDocument],
        ids: list[str],
        storage_batch_size: int = 100,
    ) -> list[str]:
        embeddings, _ = await self._get_ready()
        return await self._driver.add_documents(documents, ids, embeddings, storage_batch_size)

    async def search(
        self,
        query: str,
        k: int = 5,
        metadata_filter: dict | None = None,
        purpose: str | None = None,
    ) -> list[VectorSearchResult]:
        embeddings, _ = await self._get_ready(purpose=purpose)
        raw: list[DriverSearchResult] = await self._driver.search(
            query, embeddings, k, metadata_filter
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
        self._resolver.clear()

    async def validate_config(self, tenant_id: int | None = None) -> tuple[int | None, dict]:
        """Kept for backward compatibility — resolves and validates embedding config."""
        return await self._resolver._get_conf(tenant_id, force=False)

    async def reload_credentials(self, tenant_id: int | None = None) -> None:
        """Force-refresh embedding config and clear schema-init cache so next op re-verifies."""
        await self._resolver.reload(tenant_id)
        self._schema_initialized.clear()

    @property
    def vector_backend(self) -> str:
        """返回当前向量后端的可读名称（例如 'Elasticsearch' / 'PostgreSQL'）。"""
        name = type(self._driver).__name__
        return name.replace("Driver", "") if name.endswith("Driver") else name

    @property
    def last_resolved_model(self) -> str:
        return self._resolver.last_resolved_model

    @property
    def last_resolved_hash(self) -> str:
        return self._resolver.last_resolved_hash
