# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""Embedding 实例解析与缓存

将 embedding 配置解析、实例构建和缓存逻辑从驱动层中剥离，
使驱动只关注存储操作，不再承担 embedding 生命周期管理职责。
"""

import asyncio
import logging
import time
from contextvars import ContextVar
from typing import Any

logger = logging.getLogger(__name__)

_CONFIG_CACHE_TTL: float = 60.0


class EmbeddingResolver:
    """解析并缓存 embedding 实例，任务安全（ContextVar）、并发安全（Double-check locking）。"""

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        # conf_hash -> embeddings instance
        self._embeddings_cache: dict[str, Any] = {}
        # tenant_id -> (embedding_conf, monotonic_timestamp)
        self._config_cache: dict[int | None, tuple[dict, float]] = {}
        self._context_metadata: ContextVar[dict[str, str]] = ContextVar(
            "embedding_resolver_metadata", default={"model": "N/A", "hash": ""}
        )

    async def resolve(
        self,
        tenant_id: int | None = None,
        force: bool = False,
        purpose: str | None = None,
    ) -> tuple[Any, dict]:
        """Return (embeddings_instance, embedding_conf) for the given tenant.

        Uses a 60-second TTL cache on config lookups and double-check locking
        on the embeddings instance cache. Pass force=True to bypass both caches.
        """
        tid, conf = await self._get_conf(tenant_id, force)
        conf_hash: str = conf.get("_hash", "")
        model: str = conf.get("model", "N/A")

        if not force and conf_hash in self._embeddings_cache:
            self._context_metadata.set({"model": model, "hash": conf_hash})
            return self._embeddings_cache[conf_hash], conf

        async with self._lock:
            if not force and conf_hash in self._embeddings_cache:
                self._context_metadata.set({"model": model, "hash": conf_hash})
                return self._embeddings_cache[conf_hash], conf
            embeddings = await self._build_embeddings(model, conf, tid, conf_hash, purpose)

        return embeddings, conf

    async def reload(self, tenant_id: int | None = None) -> None:
        """Force-refresh the embedding instance for the given tenant."""
        await self.resolve(tenant_id, force=True)

    def clear(self) -> None:
        """Clear all caches (call on close or credential rotation)."""
        self._embeddings_cache.clear()
        self._config_cache.clear()

    @property
    def last_resolved_model(self) -> str:
        """Model name from the most recent resolve() call in this asyncio task."""
        return self._context_metadata.get().get("model", "N/A")

    @property
    def last_resolved_hash(self) -> str:
        """Config hash from the most recent resolve() call in this asyncio task."""
        return self._context_metadata.get().get("hash", "")

    # ──────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ──────────────────────────────────────────────────────────────────────

    async def _get_conf(self, tenant_id: int | None, force: bool) -> tuple[int | None, dict]:
        """Return (resolved_tenant_id, embedding_conf), with TTL cache unless force=True."""
        from app.core.infra.config_resolver import ConfigResolver
        from app.core.infra.tenant import get_current_tenant

        resolved_id = tenant_id if tenant_id is not None else get_current_tenant()

        if not force:
            cached = self._config_cache.get(resolved_id)
            if cached is not None and (time.monotonic() - cached[1]) < _CONFIG_CACHE_TTL:
                return resolved_id, cached[0]

        conf = await ConfigResolver.resolve_section("embedding", tenant_id=resolved_id)
        ConfigResolver.validate_config("embedding", conf)
        self._config_cache[resolved_id] = (conf, time.monotonic())
        return resolved_id, conf

    async def _build_embeddings(
        self,
        model: str,
        conf: dict,
        tenant_id: int | None,
        conf_hash: str,
        purpose: str | None,
    ) -> Any:
        """Construct OpenAICompatibleEmbeddings, cache it, and emit a usage signal.

        Must be called while holding self._lock.
        """
        from app.core.ai.providers.embeddings import OpenAICompatibleEmbeddings
        from app.core.common.utils import log_ai_usage_signal
        from app.core.infra.config import settings

        log_ai_usage_signal(
            "embedding",
            model,
            conf_hash,
            is_hit=False,
            tenant_id=tenant_id,
            extra={
                "Provider": conf.get("provider", "N/A"),
                "Base URL": conf.get("base_url", "N/A"),
                "Dimension": conf.get("dimension", "auto"),
            },
            purpose=purpose,
        )

        embeddings = OpenAICompatibleEmbeddings(
            model=model,
            api_key=conf.get("api_key"),
            base_url=conf.get("base_url"),
            embedding_batch_size=settings.AI_EMBEDDING_BATCH_SIZE,
            extra_body=conf.get("extra_body"),
        )

        self._embeddings_cache[conf_hash] = embeddings
        self._context_metadata.set({"model": model, "hash": conf_hash})
        logger.debug(
            f"[EmbeddingResolver] Built embeddings "
            f"(hash={conf_hash[:8]}, tenant={tenant_id}, "
            f"dim={conf.get('dimension', 'auto')})"
        )
        return embeddings
