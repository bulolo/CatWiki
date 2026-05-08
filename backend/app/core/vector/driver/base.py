# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""向量存储驱动抽象接口 — 纯存储，不参与 embedding 配置解析"""

from abc import ABC, abstractmethod
from typing import Any, TypedDict

from langchain_core.documents import Document as LangChainDocument

ALLOWED_FILTER_KEYS: frozenset[str] = frozenset(
    ["source", "id", "site_id", "collection_id", "tenant_id", "chunk_index"]
)


class VectorChunk(TypedDict):
    id: str
    content: str
    metadata: dict


class DriverSearchResult(TypedDict):
    doc: LangChainDocument
    score: float
    score_comparable: bool  # True=余弦相似度可与阈值比; False=排名得分无绝对意义


class VectorDriver(ABC):
    @abstractmethod
    async def ensure_schema(self, dimension: int) -> None:
        """确保 Schema 与 dimension 匹配（幂等）"""

    @abstractmethod
    async def add_documents(
        self,
        documents: list[LangChainDocument],
        ids: list[str],
        embeddings: Any,
        batch_size: int = 100,
    ) -> list[str]: ...

    @abstractmethod
    async def search(
        self,
        query: str,
        embeddings: Any,
        k: int,
        metadata_filter: dict | None,
    ) -> list[DriverSearchResult]: ...

    @abstractmethod
    async def delete_by_ids(self, ids: list[str]) -> None: ...

    @abstractmethod
    async def delete_by_filter(self, key: str, value: str | int) -> None: ...

    @abstractmethod
    async def get_by_filter(self, key: str, value: str | int) -> list[VectorChunk]: ...

    @abstractmethod
    async def ping(self) -> bool: ...

    @abstractmethod
    async def close(self) -> None: ...
