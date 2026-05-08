# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""PostgreSQL 向量存储驱动（基于 langchain-postgres）"""

import asyncio
import logging
from collections import OrderedDict
from typing import Any
from urllib.parse import quote_plus

from langchain_core.documents import Document as LangChainDocument
from langchain_postgres import PGEngine, PGVectorStore
from langchain_postgres.v2.engine import Column
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

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

logger = logging.getLogger(__name__)

_STORE_CACHE_MAX = 5  # max PGVectorStore instances kept in LRU cache

# Metadata columns promoted to top-level table columns (indexed for fast filtering)
_PROMOTED_METADATA_COLUMNS = [
    Column(name="source", data_type="TEXT", nullable=True),
    Column(name="id", data_type="TEXT", nullable=True),
    Column(name="site_id", data_type="INTEGER", nullable=True),
    Column(name="collection_id", data_type="INTEGER", nullable=True),
    Column(name="tenant_id", data_type="INTEGER", nullable=True),
    Column(name="summary", data_type="TEXT", nullable=True),
    Column(name="tags", data_type="TEXT", nullable=True),
]
_PROMOTED_COLUMN_NAMES = [col.name for col in _PROMOTED_METADATA_COLUMNS]


class PostgresDriver(VectorDriver):
    """Pure-storage PostgreSQL driver.

    Args:
        collection_name: Vector table name (default: catwiki_documents).
        sa_engine:       Inject a pre-built AsyncEngine for testing; production leaves None.
    """

    def __init__(
        self,
        collection_name: str = "catwiki_documents",
        *,
        sa_engine: AsyncEngine | None = None,
    ) -> None:
        self.collection_name = collection_name
        self._sa_engine: AsyncEngine | None = sa_engine
        self._pg_engine: PGEngine | None = (
            PGEngine.from_engine(engine=sa_engine) if sa_engine else None
        )
        self._lock = asyncio.Lock()
        # id(embeddings) -> PGVectorStore, LRU-capped at _STORE_CACHE_MAX
        self._stores: OrderedDict[int, PGVectorStore] = OrderedDict()

    # ──────────────────────────────────────────────────────────────────────
    # Engine initialisation
    # ──────────────────────────────────────────────────────────────────────

    def _init_engine(self) -> None:
        from app.core.infra.config import settings

        encoded_user = quote_plus(settings.POSTGRES_USER)
        encoded_password = quote_plus(settings.POSTGRES_PASSWORD)
        conn_str = (
            f"postgresql+asyncpg://{encoded_user}:{encoded_password}"
            f"@{settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
        )
        self._sa_engine = create_async_engine(
            conn_str,
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_timeout=settings.DB_POOL_TIMEOUT,
            pool_recycle=settings.DB_POOL_RECYCLE,
            pool_pre_ping=True,
            pool_reset_on_return="commit",
            echo=False,
            future=True,
        )
        self._pg_engine = PGEngine.from_engine(engine=self._sa_engine)

    async def _ensure_engine(self) -> None:
        """Ensure the SQLAlchemy engine exists; safe to call without embedding config."""
        if self._sa_engine is not None:
            return
        async with self._lock:
            if self._sa_engine is None:
                self._init_engine()

    # ──────────────────────────────────────────────────────────────────────
    # Schema
    # ──────────────────────────────────────────────────────────────────────

    async def _table_exists(self) -> bool:
        async with self._sa_engine.connect() as conn:
            result = await conn.execute(
                text(
                    "SELECT 1 FROM information_schema.tables "
                    "WHERE table_name = :table AND table_schema = 'public'"
                ),
                {"table": self.collection_name},
            )
            return result.fetchone() is not None

    async def _create_table(self, dimension: int) -> None:
        logger.info(f"[PG] Creating vector table: {self.collection_name} (dim={dimension})")
        await self._pg_engine.ainit_vectorstore_table(
            table_name=self.collection_name,
            vector_size=dimension,
            metadata_columns=_PROMOTED_METADATA_COLUMNS,
        )

    async def _create_indexes(self) -> None:
        target_cols = ["id", "site_id", "collection_id", "tenant_id"]
        async with self._sa_engine.connect() as conn:
            autocommit = await conn.execution_options(isolation_level="AUTOCOMMIT")
            for col in target_cols:
                index_name = f"idx_{self.collection_name}_{col}"
                await autocommit.execute(
                    text(
                        f"CREATE INDEX IF NOT EXISTS {index_name} ON {self.collection_name} ({col})"
                    )
                )
        logger.info(f"[PG] Indexes created for {self.collection_name}")

    async def _check_table_dimension(self, expected_dim: int) -> None:
        try:
            sql = text(
                "SELECT format_type(atttypid, atttypmod) AS type_def "
                "FROM pg_attribute "
                "WHERE attrelid = CAST(:table AS regclass) AND attname = 'embedding'"
            )
            async with self._sa_engine.connect() as conn:
                result = await conn.execute(sql, {"table": self.collection_name})
                row = result.fetchone()

            if not row or not row.type_def or "vector(" not in row.type_def:
                return

            actual_dim = int(row.type_def.split("(")[1].split(")")[0])
            if actual_dim != expected_dim:
                raise VectorStoreDimensionError(
                    f"Dimension mismatch: table '{self.collection_name}' has {actual_dim}, "
                    f"config requires {expected_dim}. "
                    f"Fix: DROP TABLE {self.collection_name};"
                )
            logger.debug(f"[PG] Dimension check passed: {actual_dim}")
        except VectorStoreDimensionError:
            raise
        except Exception as e:
            if "does not exist" in str(e):
                return
            raise

    async def ensure_schema(self, dimension: int) -> None:
        """Create table + indexes if absent; validate dimension if table already exists."""
        await _ensure_engine_guard(self)
        try:
            if not await self._table_exists():
                await self._create_table(dimension)
                await self._create_indexes()
            else:
                await self._check_table_dimension(dimension)
        except (VectorStoreDimensionError, VectorStoreSchemaError):
            raise
        except Exception as e:
            raise VectorStoreSchemaError(f"PG schema setup failed: {e}") from e

    # ──────────────────────────────────────────────────────────────────────
    # PGVectorStore cache (LRU by id(embeddings))
    # ──────────────────────────────────────────────────────────────────────

    async def _get_or_create_store(self, embeddings: Any) -> PGVectorStore:
        key = id(embeddings)
        if key in self._stores:
            self._stores.move_to_end(key)
            return self._stores[key]

        store = await PGVectorStore.create(
            engine=self._pg_engine,
            table_name=self.collection_name,
            embedding_service=embeddings,
            metadata_columns=_PROMOTED_COLUMN_NAMES,
        )
        self._stores[key] = store
        if len(self._stores) > _STORE_CACHE_MAX:
            self._stores.popitem(last=False)
        return store

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
        await _ensure_engine_guard(self)
        vectors = await embeddings.aembed_documents([doc.page_content for doc in documents])
        store = await self._get_or_create_store(embeddings)
        total = len(documents)
        failed_ids: list[str] = []

        for i in range(0, total, batch_size):
            batch_docs = documents[i : i + batch_size]
            batch_ids = ids[i : i + batch_size]
            batch_vectors = vectors[i : i + batch_size]
            try:
                await store.aadd_embeddings(
                    texts=[doc.page_content for doc in batch_docs],
                    embeddings=batch_vectors,
                    metadatas=[doc.metadata for doc in batch_docs],
                    ids=batch_ids,
                )
                logger.debug(
                    f"[PG] Stored batch {i // batch_size + 1}/"
                    f"{(total + batch_size - 1) // batch_size}"
                )
            except Exception as e:
                logger.error(f"[PG] Batch write failed: {e}", exc_info=True)
                failed_ids.extend(batch_ids)

        if failed_ids:
            raise VectorStoreBulkWriteError(
                f"PG bulk write failed for {len(failed_ids)} documents",
                failed_ids=failed_ids,
            )

        logger.info(f"[PG] Stored {total} documents")
        return ids

    async def search(
        self,
        query: str,
        embeddings: Any,
        k: int,
        metadata_filter: dict | None,
    ) -> list[DriverSearchResult]:
        await _ensure_engine_guard(self)
        query_vector = await embeddings.aembed_query(query)
        store = await self._get_or_create_store(embeddings)
        results = await store.asimilarity_search_with_score_by_vector(
            embedding=query_vector,
            k=k,
            filter=metadata_filter,
        )
        # pgvector returns cosine distance (0=identical), convert to similarity
        return [
            {"doc": doc, "score": 1.0 - distance, "score_comparable": True}
            for doc, distance in results
        ]

    async def delete_by_ids(self, ids: list[str]) -> None:
        await _ensure_engine_guard(self)
        logger.info(f"[PG] Deleting {len(ids)} documents by ID")
        async with self._sa_engine.connect() as conn:
            await conn.execute(
                text(f"DELETE FROM {self.collection_name} WHERE langchain_id::text = ANY(:ids)"),
                {"ids": ids},
            )
            await conn.commit()
        logger.info("[PG] Deleted documents")

    async def delete_by_filter(self, key: str, value: str | int) -> None:
        await _ensure_engine_guard(self)
        logger.info(f"[PG] Deleting by metadata: {key}={value}")
        where_clause = self._build_where_clause(key)
        async with self._sa_engine.connect() as conn:
            await conn.execute(
                text(f"DELETE FROM {self.collection_name} WHERE {where_clause}"),
                {"value": value},
            )
            await conn.commit()
        logger.info(f"[PG] Deleted documents with {key}={value}")

    async def get_by_filter(self, key: str, value: str | int) -> list[VectorChunk]:
        await _ensure_engine_guard(self)
        try:
            where_clause = self._build_where_clause(key)
            sql = text(
                f"SELECT langchain_id, content, langchain_metadata "
                f"FROM {self.collection_name} "
                f"WHERE {where_clause} "
                f"ORDER BY (langchain_metadata->>'chunk_index')::int ASC NULLS LAST"
            )
            async with self._sa_engine.connect() as conn:
                result = await conn.execute(sql, {"value": value})
                rows = result.fetchall()
            return [
                {
                    "id": str(row.langchain_id),
                    "content": row.content,
                    "metadata": row.langchain_metadata,
                }
                for row in rows
            ]
        except Exception as e:
            logger.error(f"[PG] get_by_filter failed: {e}", exc_info=True)
            return []

    async def ping(self) -> bool:
        try:
            await _ensure_engine_guard(self)
            async with self._sa_engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            return True
        except Exception as e:
            logger.warning(f"[PG] ping failed: {e}")
            return False

    async def close(self) -> None:
        if self._sa_engine:
            await self._sa_engine.dispose()
            self._sa_engine = None
            self._pg_engine = None
            self._stores.clear()
            logger.info("[PG] Connection closed")

    # ──────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ──────────────────────────────────────────────────────────────────────

    def _build_where_clause(self, key: str) -> str:
        """Map a metadata key to a safe SQL WHERE fragment.

        Promoted columns use direct column comparison; others route through JSONB path.
        Only ALLOWED_FILTER_KEYS are permitted to prevent injection.
        """
        if key in _PROMOTED_COLUMN_NAMES:
            return f"{key} = :value"
        if key not in ALLOWED_FILTER_KEYS:
            raise ValueError(f"Disallowed metadata key: {key!r}")
        return f"langchain_metadata->>'{key}' = :value"


async def _ensure_engine_guard(driver: PostgresDriver) -> None:
    """Call driver._ensure_engine() and translate connection errors to typed exceptions."""
    try:
        await driver._ensure_engine()
    except Exception as e:
        raise VectorStoreConnectionError(f"PG engine init failed: {e}") from e
