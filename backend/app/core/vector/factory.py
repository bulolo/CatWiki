# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""向量存储工厂

根据 VECTOR_STORE_TYPE 配置分发引擎实例。
对外只需调用 get_vector_store()，无需感知底层引擎类型。
"""

import asyncio
import logging

from app.core.vector.embedding_resolver import EmbeddingResolver
from app.core.vector.manager import VectorStoreManager

logger = logging.getLogger(__name__)

_instance: VectorStoreManager | None = None
_lock = asyncio.Lock()


async def get_vector_store() -> VectorStoreManager:
    """Return the singleton VectorStoreManager (lazily created, engine from VECTOR_STORE_TYPE)."""
    global _instance

    if _instance is not None:
        return _instance

    async with _lock:
        if _instance is not None:
            return _instance

        from app.core.infra.config import settings

        resolver = EmbeddingResolver()

        if settings.VECTOR_STORE_TYPE == "elasticsearch":
            from app.core.vector.driver.elasticsearch import ElasticsearchDriver

            driver = ElasticsearchDriver()
        elif settings.VECTOR_STORE_TYPE == "postgres":
            from app.core.vector.driver.postgres import PostgresDriver

            driver = PostgresDriver()
        else:
            raise ValueError(
                f"不支持的 VECTOR_STORE_TYPE: {settings.VECTOR_STORE_TYPE!r}，"
                "可选值：'postgres' | 'elasticsearch'"
            )

        _instance = VectorStoreManager(resolver, driver)
        logger.info(f"[Factory] 向量存储引擎: {settings.VECTOR_STORE_TYPE}")

    return _instance


async def close_vector_store() -> None:
    """Close and release the current vector store instance (call on application shutdown)."""
    global _instance
    if _instance is not None:
        await _instance.close()
        _instance = None
