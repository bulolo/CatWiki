# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

from app.core.vector.driver.base import DriverSearchResult, VectorChunk
from app.core.vector.exceptions import (
    VectorStoreAuthError,
    VectorStoreBulkWriteError,
    VectorStoreConnectionError,
    VectorStoreDimensionError,
    VectorStoreError,
    VectorStoreSchemaError,
)
from app.core.vector.factory import close_vector_store, get_vector_store
from app.core.vector.manager import VectorStoreManager as _VectorStoreManagerImpl


class VectorStoreManager:
    """Backward-compatibility shim.

    All existing callers can continue to use VectorStoreManager.get_instance();
    the actual instance is the engine-specific implementation returned by the factory.
    """

    @classmethod
    async def get_instance(cls) -> _VectorStoreManagerImpl:
        return await get_vector_store()


__all__ = [
    "VectorStoreManager",
    "get_vector_store",
    "close_vector_store",
    "VectorChunk",
    "DriverSearchResult",
    "VectorStoreError",
    "VectorStoreConnectionError",
    "VectorStoreAuthError",
    "VectorStoreDimensionError",
    "VectorStoreBulkWriteError",
    "VectorStoreSchemaError",
]
