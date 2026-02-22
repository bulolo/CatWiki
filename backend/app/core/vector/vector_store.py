# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://github.com/CatWiki/CatWiki/blob/main/LICENSE
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""向量存储管理器

使用 langchain-postgres 最佳实践实现
"""

import asyncio
import logging
from typing import Any, Optional
from urllib.parse import quote_plus

from langchain_core.documents import Document as LangChainDocument
from langchain_postgres import PGEngine, PGVectorStore
from langchain_postgres.v2.engine import Column
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.infra.config import settings

logger = logging.getLogger(__name__)


class VectorStoreManager:
    """向量存储管理器（单例模式）

    基于 langchain-postgres 文档最佳实践：
    - 使用 PGEngine.from_engine() 管理连接池
    - 使用 ainit_vectorstore_table() 初始化表
    - 使用 PGVectorStore.create() 创建向量存储
    """

    _instance: Optional["VectorStoreManager"] = None
    _lock = asyncio.Lock()
    _initialized: bool = False

    def __init__(self, collection_name: str = "catwiki_documents"):
        """初始化向量存储管理器"""
        self.collection_name = collection_name
        self._sa_engine = None  # 底层 SQLAlchemy 异步引擎 (进程内共享)
        self._engine: PGEngine | None = None  # PGEngine (进程内共享)

        # 核心缓存：基于配置哈希，实现多租户/多模型配置的实例隔离
        # key: config_hash, value: PGVectorStore
        self._vector_stores: dict[str, PGVectorStore] = {}
        # key: config_hash, value: Embeddings
        self._embeddings_cache: dict[str, Any] = {}

        # 当前上下文选中的实例 (由 _ensure_initialized 动态指向)
        self._current_store: PGVectorStore | None = None
        self._current_embeddings = None

    async def _ensure_initialized(self, tenant_id: int | None = None, force: bool = False):
        """确保向量存储已初始化（线程安全，支持多实例池）"""
        async with self._lock:
            try:
                from app.core.infra.config_resolver import ConfigResolver
                from app.core.infra.tenant import get_current_tenant

                # 1. 获取目标租户配置
                if tenant_id is None:
                    tenant_id = get_current_tenant()

                embedding_conf = await ConfigResolver.resolve_section(
                    "embedding", tenant_id=tenant_id
                )

                # 2. 校验配置
                api_key = embedding_conf.get("apiKey")
                base_url = embedding_conf.get("baseUrl")
                model = embedding_conf.get("model")
                mode = embedding_conf.get("_mode", "platform")

                if not api_key:
                    source = embedding_conf.get("_source", "unknown")
                    error_msg = (
                        f"❌ [VectorStore] 未找到有效的 Embedding 配置 (租户: {tenant_id}, 模式: {mode})。 "
                        f"请在管理后台检查 AI 模型配置。"
                    )
                    logger.error(error_msg)

                    if mode == "custom":
                        from app.core.web.exceptions import BadRequestException

                        raise BadRequestException(
                            f"租户 {tenant_id} 已开启自定义向量化模式，但未配置 API Key。"
                        )

                    raise ValueError(error_msg)

                dimension = int(embedding_conf.get("dimension") or 1024)
                source = embedding_conf.get("_source", "platform")
                mode = embedding_conf.get("_mode", "platform")

                # 3. 使用配置管理器计算的统一指纹
                conf_hash = embedding_conf.get("_hash")

                # 4. 如果缓存中已有该配置的实例，直接指向它并返回
                if conf_hash in self._vector_stores:
                    self._current_store = self._vector_stores[conf_hash]
                    self._current_embeddings = self._embeddings_cache[conf_hash]
                    return

                # 5. 否则，初始化新实例
                logger.info(
                    f"🔄 [VectorStore] 检测到新配置或实例缺失，开始初始化... (租户: {tenant_id}, 模式: {mode}, 来源: {source}, Model: {model})"
                )

                # 初始化 Embeddings
                from app.core.ai.providers.embeddings import OpenAICompatibleEmbeddings

                new_embeddings = OpenAICompatibleEmbeddings(
                    model=model,
                    api_key=api_key,
                    base_url=base_url,
                    embedding_batch_size=settings.AI_EMBEDDING_BATCH_SIZE,
                )

                # 初始化 SQL Engine (单例共享，跨租户复用连接池)
                if self._sa_engine is None:
                    encoded_user = quote_plus(settings.POSTGRES_USER)
                    encoded_password = quote_plus(settings.POSTGRES_PASSWORD)
                    async_conn_str = (
                        f"postgresql+asyncpg://{encoded_user}:{encoded_password}"
                        f"@{settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
                    )

                    self._sa_engine = create_async_engine(
                        async_conn_str,
                        pool_size=settings.DB_POOL_SIZE,
                        max_overflow=settings.DB_MAX_OVERFLOW,
                        pool_timeout=settings.DB_POOL_TIMEOUT,
                        pool_recycle=settings.DB_POOL_RECYCLE,
                        pool_pre_ping=True,
                        pool_reset_on_return="commit",
                        echo=False,
                        future=True,
                    )
                    self._engine = PGEngine.from_engine(engine=self._sa_engine)

                # 定义元数据列
                metadata_columns = [
                    Column(name="source", data_type="TEXT", nullable=True),
                    Column(name="id", data_type="TEXT", nullable=True),
                    Column(name="site_id", data_type="INTEGER", nullable=True),
                    Column(name="collection_id", data_type="INTEGER", nullable=True),
                    Column(name="tenant_id", data_type="INTEGER", nullable=True),
                ]

                # 初始化表 (仅在第一次物理访问时执行，dim 由第一个配置决定)
                try:
                    from sqlalchemy import text

                    check_sql = text(
                        "SELECT 1 FROM information_schema.tables WHERE table_name = :table"
                    )
                    async with self._sa_engine.connect() as conn:
                        result = await conn.execute(check_sql, {"table": self.collection_name})
                        exists = result.fetchone() is not None

                    if not exists:
                        logger.info(
                            f"✨ 创建向量存储表: {self.collection_name} (必选维度: {dimension})"
                        )
                        await self._engine.ainit_vectorstore_table(
                            table_name=self.collection_name,
                            vector_size=dimension,
                            metadata_columns=metadata_columns,
                        )
                except Exception as e:
                    if "already exists" not in str(e) and "DuplicateTable" not in str(e):
                        raise e

                # 维度匹配性检查
                await self._check_database_dimension(dimension)

                # Schema 检查与迁移（确保 optimized_columns 对应的物理列存在）
                await self._ensure_columns()

                # 索引检查与创建
                await self._ensure_indexes()

                # 创建 PGVectorStore 实例并存入缓存
                self.optimized_columns = [
                    "source",
                    "id",
                    "site_id",
                    "collection_id",
                    "tenant_id",
                ]
                new_store = await PGVectorStore.create(
                    engine=self._engine,
                    table_name=self.collection_name,
                    embedding_service=new_embeddings,
                    metadata_columns=self.optimized_columns,
                )

                # 存入实例池
                self._vector_stores[conf_hash] = new_store
                self._embeddings_cache[conf_hash] = new_embeddings

                # 指向当前
                self._current_store = new_store
                self._current_embeddings = new_embeddings

                logger.info(
                    f"✅ [VectorStore] 实例初始化完成 (哈希: {conf_hash[:8]}, 租户: {tenant_id}, 来源: {source})"
                )

            except Exception as e:
                logger.error(f"向量存储初始化失败: {e}", exc_info=True)
                raise

    async def reload_credentials(self) -> None:
        """热更新向量存储凭证 (强制刷新由于修改可能带来的配置变更)"""
        # 注意：强制刷新配置缓存已经在 Manager 外部完成 (通过 clear_cache)
        # 这里我们需要强制 _ensure_initialized 重新读取 Manager
        try:
            await self._ensure_initialized(force=True)
        except Exception as e:
            logger.warning(
                f"⚠️ [VectorStore] Reload credentials failed (possibly due to incomplete config): {e}"
            )

        # 如果初始化成功，则更新 Embeddings 实例（如果有必要）
        # _ensure_initialized 内部已经重新指向了 _current_embeddings，这里无需额外操作
        # 除非我们要处理跨请求的引用更新，但在单例模式下 _ensure_initialized 足矣。

    @classmethod
    async def get_instance(cls) -> "VectorStoreManager":
        """获取向量存储管理器单例（自动感知当前租户上下文并返回合法的实例）"""
        if cls._instance is None:
            async with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()

        # 由于管理器内部通过 _current_store 代理了多实例，每次获取时需刷新指向
        # 注意：这里我们捕获初始化错误，防止因配置暂不可用导致整个应用崩溃
        try:
            await cls._instance._ensure_initialized()
        except Exception as e:
            logger.warning(
                f"⚠️ [VectorStore] get_instance initialized with errors (possibly waiting for config): {e}"
            )

        return cls._instance

    async def add_documents(
        self, documents: list[LangChainDocument], ids: list[str], storage_batch_size: int = 100
    ) -> list[str]:
        """添加文档到向量存储

        Args:
            documents: 要存储的文档列表
            ids: 文档 ID 列表
            storage_batch_size: 每批写入数据库的档数量（Embedding API 分批由 AI_EMBEDDING_BATCH_SIZE 配置控制）
        """
        await self._ensure_initialized()

        try:
            import time

            start_time = time.time()
            total = len(documents)

            # 分批写入数据库
            for i in range(0, total, storage_batch_size):
                batch_docs = documents[i : i + storage_batch_size]
                batch_ids = ids[i : i + storage_batch_size]

                await self._current_store.aadd_documents(documents=batch_docs, ids=batch_ids)
                logger.debug(
                    f"已存储批次 {i // storage_batch_size + 1}/{(total + storage_batch_size - 1) // storage_batch_size}"
                )

            elapsed = time.time() - start_time
            logger.info(f"✅ [VectorStore] 已存储 {total} 个文档 | 耗时: {elapsed:.3f}s")
            return ids

        except Exception as e:
            logger.error(f"添加文档失败: {e}", exc_info=True)
            raise

    async def delete_documents(self, ids: list[str]) -> None:
        """从向量存储删除文档"""
        await self._ensure_initialized()

        try:
            logger.info(f"开始删除 {len(ids)} 个文档")

            # 使用异步方法删除文档
            await self._current_store.adelete(ids=ids)

            logger.info("✅ 成功删除文档")

        except Exception as e:
            logger.error(f"删除文档失败: {e}", exc_info=True)
            raise

    def _get_metadata_where_clause(self, key: str) -> str:
        """生成元数据查询条件的 WHERE 子句部分"""
        if key in self.optimized_columns:
            return f"{key} = :value"
        else:
            return f"langchain_metadata->>'{key}' = :value"

    async def delete_by_metadata(self, key: str, value: str) -> None:
        """根据元数据删除文档"""
        await self._ensure_initialized()

        try:
            logger.info(f"开始根据元数据删除文档: {key}={value}")

            from sqlalchemy import text

            where_clause = self._get_metadata_where_clause(key)
            sql = text(f"DELETE FROM {self.collection_name} WHERE {where_clause}")

            logger.debug(f"执行删除 SQL: {sql} with value={value}")

            async with self._sa_engine.connect() as conn:
                await conn.execute(sql, {"value": value})
                await conn.commit()

            logger.info(f"✅ 成功删除元数据 {key}={value} 的相关向量")

        except Exception as e:
            logger.error(f"根据元数据删除文档失败: {e}", exc_info=True)
            raise

    async def similarity_search(
        self, query: str, k: int = 5, filter: dict | None = None
    ) -> list[LangChainDocument]:
        """相似度搜索"""
        await self._ensure_initialized()

        try:
            logger.info(f"执行相似度搜索: query='{query[:50]}...', k={k}")

            results = await self._current_store.asimilarity_search(query=query, k=k, filter=filter)

            logger.info(f"✅ 搜索完成，找到 {len(results)} 个结果")
            return results

        except Exception as e:
            logger.error(f"向量搜索失败: {e}", exc_info=True)
            raise

    async def similarity_search_with_score(
        self, query: str, k: int = 5, filter: dict | None = None
    ) -> list[tuple[LangChainDocument, float]]:
        """带相似度分数的搜索"""
        await self._ensure_initialized()

        try:
            results = await self._current_store.asimilarity_search_with_score(
                query=query, k=k, filter=filter
            )
            return results

        except Exception as e:
            logger.error(f"向量搜索（带分数）失败: {e}", exc_info=True)
            raise

    async def get_chunks_by_metadata(self, key: str, value: str) -> list[dict]:
        """根据元数据获取文档片段"""
        await self._ensure_initialized()
        try:
            from sqlalchemy import text

            # 自动判断是否可以使用优化列
            where_clause = self._get_metadata_where_clause(key)

            sql = text(f"""
                SELECT langchain_id, content, langchain_metadata
                FROM {self.collection_name}
                WHERE {where_clause}
                ORDER BY (langchain_metadata->>'chunk_index')::int ASC
            """)

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
            logger.error(f"获取文档片段失败: {e}", exc_info=True)
            return []

    async def _check_database_dimension(self, expected_dim: int):
        """检查数据库中的向量维度是否与配置匹配"""
        try:
            from sqlalchemy import text

            # 查询列类型定义
            # format_type(atttypid, atttypmod) 会返回如 'vector(1024)' 的字符串
            sql = text(
                "SELECT format_type(atttypid, atttypmod) as type_def FROM pg_attribute WHERE attrelid = CAST(:table AS regclass) AND attname = 'embedding'"
            )

            async with self._sa_engine.connect() as conn:
                try:
                    result = await conn.execute(sql, {"table": self.collection_name})
                    row = result.fetchone()
                except Exception:
                    # 表可能不存在，那就不需要检查
                    return

                if row and row.type_def:
                    type_def = row.type_def  # e.g., "vector(1024)"
                    if "vector(" in type_def:
                        try:
                            # 提取括号内的数字
                            actual_dim = int(type_def.split("(")[1].split(")")[0])

                            if actual_dim != expected_dim:
                                error_msg = (
                                    f"CRITICAL: Database vector dimension mismatch! "
                                    f"DB Table '{self.collection_name}' has dimension {actual_dim}, "
                                    f"but configuration requires {expected_dim}. "
                                    f"Please DROP the table to reset: 'DROP TABLE {self.collection_name};'"
                                )
                                logger.critical(error_msg)
                                raise ValueError(error_msg)
                            else:
                                logger.info(
                                    f"✅ [VectorStore] Dimension check passed: {actual_dim}"
                                )
                        except ValueError:
                            logger.warning(
                                f"⚠️ [VectorStore] Could not parse vector dimension from '{type_def}'"
                            )
        except Exception as e:
            # 如果是 "relation does not exist" 之类的错误，说明表还没建，可以忽略
            if "does not exist" in str(e):
                return
            raise e

    async def _ensure_columns(self):
        """确保所有优化列在数据库表中存在（Schema Evolution）"""
        try:
            from sqlalchemy import text

            # 需要检查的额外列 (id, source, site_id 是基础列，这里主要关注新增的优化列)
            target_columns = ["collection_id", "tenant_id"]

            async with self._sa_engine.connect() as conn:
                # 使用 AUTOCOMMIT 模式执行 Schema 修改
                conn = await conn.execution_options(isolation_level="AUTOCOMMIT")

                # 获取当前所有列名
                result = await conn.execute(
                    text(
                        f"SELECT column_name FROM information_schema.columns WHERE table_name = '{self.collection_name}'"
                    )
                )
                existing_columns = [row[0] for row in result.fetchall()]

                for col in target_columns:
                    if col not in existing_columns:
                        logger.info(f"🔄 [Schema] 检测到缺少列 '{col}'，正在添加...")
                        # 添加列
                        await conn.execute(
                            text(f"ALTER TABLE {self.collection_name} ADD COLUMN {col} INTEGER")
                        )
                        logger.info(f"✅ [Schema] 成功添加列 '{col}'")

        except Exception as e:
            logger.error(f"❌ [Schema] 列检查/迁移失败: {e}", exc_info=True)
            # 不抛出异常，允许应用继续启动（可能只需降级使用 JSON 查询）

    async def _ensure_indexes(self):
        """确保关键查询字段拥有索引"""
        try:
            from sqlalchemy import text

            # 需要索引的字段
            # 注意: langchain_id 是主键，自动有索引
            target_indexes = ["id", "site_id", "collection_id", "tenant_id"]

            async with self._sa_engine.connect() as conn:
                # 关键：必须设置 isolation_level 为 AUTOCOMMIT
                # 否则 CREATE INDEX CONCURRENTLY 会因为在事务块中执行而报错
                conn = await conn.execution_options(isolation_level="AUTOCOMMIT")

                # 获取当前所有索引
                result = await conn.execute(
                    text(
                        f"SELECT indexname FROM pg_indexes WHERE tablename = '{self.collection_name}'"
                    )
                )
                existing_indexes = [row[0] for row in result.fetchall()]

                for col in target_indexes:
                    index_name = f"idx_{self.collection_name}_{col}"
                    # 简单的命名约定检查，不严谨但够用
                    if index_name not in existing_indexes:
                        logger.info(f"🔄 [Index] 检测到缺少索引 '{index_name}'，正在创建...")
                        await conn.execute(
                            text(
                                f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {index_name} ON {self.collection_name} ({col})"
                            )
                        )
                        logger.info(f"✅ [Index] 成功创建索引 '{index_name}'")

        except Exception as e:
            logger.warning(f"⚠️ [Index] 索引维护失败 (可能是权限不足或已存在): {e}")

    async def close(self):
        """关闭数据库连接"""
        if self._engine and hasattr(self._engine, "_pool"):
            try:
                await self._engine._pool.dispose()
                logger.info("✅ 向量存储连接已关闭")
            except Exception as e:
                logger.warning(f"关闭连接时出错: {e}")
