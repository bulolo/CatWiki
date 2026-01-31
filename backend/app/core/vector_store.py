"""向量存储管理器

使用 langchain-postgres 最佳实践实现
"""

import logging
from typing import Optional
from urllib.parse import quote_plus

from langchain_core.documents import Document as LangChainDocument
from langchain_postgres import PGEngine, PGVectorStore
from langchain_postgres.v2.engine import Column
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings

logger = logging.getLogger(__name__)


class VectorStoreManager:
    """向量存储管理器（单例模式）

    基于 langchain-postgres 文档最佳实践：
    - 使用 PGEngine.from_engine() 管理连接池
    - 使用 ainit_vectorstore_table() 初始化表
    - 使用 PGVectorStore.create() 创建向量存储
    """

    _instance: Optional['VectorStoreManager'] = None
    _initialized: bool = False

    def __init__(self, collection_name: str = "catwiki_documents"):
        """初始化向量存储管理器"""
        self.collection_name = collection_name
        self._engine: PGEngine | None = None
        self._sa_engine = None  # Underlying SQLAlchemy AsyncEngine
        self._vector_store: PGVectorStore | None = None

        # 初始化 OpenAI 兼容 Embeddings
        from app.core.embeddings import OpenAICompatibleEmbeddings

        self.embeddings = OpenAICompatibleEmbeddings(
            model=settings.AI_EMBEDDING_MODEL,
            api_key=settings.AI_EMBEDDING_API_KEY,
            base_url=settings.AI_EMBEDDING_API_BASE
        )

        logger.info(f"向量存储配置: model={settings.AI_EMBEDDING_MODEL}, dim={settings.AI_EMBEDDING_DIMENSION}")

    async def _ensure_initialized(self):
        """确保向量存储已初始化（懒加载）"""
        if self._initialized:
            return

        try:
            # 构建异步连接字符串
            encoded_user = quote_plus(settings.POSTGRES_USER)
            encoded_password = quote_plus(settings.POSTGRES_PASSWORD)
            async_conn_str = (
                f"postgresql+asyncpg://{encoded_user}:{encoded_password}"
                f"@{settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"
            )

            # 创建配置好的 AsyncEngine
            logger.debug("创建数据库引擎...")
            async_engine = create_async_engine(
                async_conn_str,
                pool_size=10,
                max_overflow=20,
                pool_timeout=30,
                pool_recycle=1800,
                pool_pre_ping=True,
                pool_reset_on_return="commit",
                echo=False,
                future=True,
            )
            
            self._sa_engine = async_engine

            # 使用 PGEngine.from_engine()（文档推荐）
            logger.debug("创建 PGEngine...")
            self._engine = PGEngine.from_engine(engine=async_engine)

            # 定义元数据列
            metadata_columns = [
                Column(name="source", data_type="TEXT", nullable=True),
                Column(name="id", data_type="TEXT", nullable=True),
                Column(name="site_id", data_type="INTEGER", nullable=True),
            ]

            # 初始化向量存储表
            logger.debug(f"检查并初始化向量存储表: {self.collection_name}")
            try:
                from sqlalchemy import text
                # 先检查表是否存在，避免 ainit_vectorstore_table 抛出 DuplicateTable 异常触发 Postgres 日志报错
                check_sql = text(f"SELECT 1 FROM information_schema.tables WHERE table_name = :table")
                async with self._sa_engine.connect() as conn:
                    result = await conn.execute(check_sql, {"table": self.collection_name})
                    exists = result.fetchone() is not None
                
                if not exists:
                    logger.info(f"创建向量存储表: {self.collection_name}")
                    await self._engine.ainit_vectorstore_table(
                        table_name=self.collection_name,
                        vector_size=settings.AI_EMBEDDING_DIMENSION,
                        metadata_columns=metadata_columns,
                    )
                else:
                    logger.debug(f"表 {self.collection_name} 已存在，跳过初始化")
            except Exception as e:
                logger.error(f"初始化向量存储表失败: {e}")
                # 依然尝试捕获并发情况下的 "already exists"
                if "already exists" not in str(e) and "DuplicateTable" not in str(e):
                    raise e

            # 创建向量存储实例
            logger.debug("创建 PGVectorStore 实例...")
            self.optimized_columns = ["source", "id", "site_id"]
            
            self._vector_store = await PGVectorStore.create(
                engine=self._engine,
                table_name=self.collection_name,
                embedding_service=self.embeddings,
                metadata_columns=self.optimized_columns,
            )

            self._initialized = True
            logger.info(f"✅ [VectorStore] 初始化完成 (Model: {settings.AI_EMBEDDING_MODEL})")

        except Exception as e:
            logger.error(f"向量存储初始化失败: {e}", exc_info=True)
            raise

    @classmethod
    async def get_instance(cls) -> 'VectorStoreManager':
        """获取单例实例（异步）"""
        if cls._instance is None:
            cls._instance = cls()

        # 确保已初始化
        await cls._instance._ensure_initialized()
        return cls._instance

    async def reload_credentials(self, config_value: dict) -> None:
        """
        热更新向量存储的凭证信息
        :param config_value: 最新的 system_config["config_value"]
        """
        await self._ensure_initialized()
        
        try:
            # 提取 Embedding 配置
            # 逻辑类似 dynamic_config，但专门针对 embedding
            
            new_model = ""
            new_api_key = ""
            new_base_url = ""
            
            # 1. 尝试读取扁平配置
            embedding_conf = config_value.get("embedding", {})
            
            # 2. 兼容旧结构
            if not embedding_conf and "manualConfig" in config_value:
                 embedding_conf = config_value.get("manualConfig", {}).get("embedding", {})

            if embedding_conf.get("apiKey") and embedding_conf.get("baseUrl"):
                new_api_key = embedding_conf.get("apiKey")
                new_base_url = embedding_conf.get("baseUrl")
                new_model = embedding_conf.get("model", "")
            else:
                 logger.warning("⚠️ [VectorStore] Reload triggered but Config for Embedding is missing or incomplete.")

            if new_api_key and new_base_url:
                logger.info(f"🔄 [VectorStore] Reloading credentials. Model: {new_model}, Base: {new_base_url}")
                
                # 更新 Embeddings 实例
                if hasattr(self.embeddings, "update_credentials"):
                    self.embeddings.update_credentials(
                        api_key=new_api_key,
                        base_url=new_base_url,
                        model=new_model
                    )
                else:
                    logger.warning("⚠️ Current embeddings instance does not support update_credentials")
            else:
                logger.warning("❌ [VectorStore] Failed to reload: Missing API Key or Base URL in config.")

        except Exception as e:
            logger.error(f"❌ Failed to reload vector store credentials: {e}")

    async def add_documents(
        self,
        documents: list[LangChainDocument],
        ids: list[str],
        batch_size: int = 100
    ) -> list[str]:
        """添加文档到向量存储（支持分批处理）"""
        await self._ensure_initialized()

        try:
            import time
            start_time = time.time()
            total = len(documents)
            
            # 分批处理
            for i in range(0, total, batch_size):
                batch_docs = documents[i : i + batch_size]
                batch_ids = ids[i : i + batch_size]
                
                await self._vector_store.aadd_documents(
                    documents=batch_docs,
                    ids=batch_ids
                )
                logger.debug(f"已存储批次 {i // batch_size + 1}/{(total + batch_size - 1) // batch_size}")

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
            await self._vector_store.adelete(ids=ids)

            logger.info("✅ 成功删除文档")

        except Exception as e:
            logger.error(f"删除文档失败: {e}", exc_info=True)
            raise

    async def delete_by_metadata(self, key: str, value: str) -> None:
        """根据元数据删除文档"""
        await self._ensure_initialized()

        try:
            logger.info(f"开始根据元数据删除文档: {key}={value}")

            from sqlalchemy import text

            # 自动判断是否可以使用优化列
            # 如果 key 是我们在 init 中定义的 optimized_columns 之一，直接使用 SQL 列查询
            if key in self.optimized_columns:
                sql = text(f"DELETE FROM {self.collection_name} WHERE {key} = :value")
                logger.debug(f"使用优化列删除: {key}")
            else:
                # 否则使用 JSONB 查询
                sql = text(f"DELETE FROM {self.collection_name} WHERE langchain_metadata->>'{key}' = :value")
                logger.debug(f"使用 Metadata JSON 删除: {key}")

            async with self._sa_engine.connect() as conn:
                await conn.execute(sql, {"value": value})
                await conn.commit()

            logger.info(f"✅ 成功删除元数据 {key}={value} 的相关向量")

        except Exception as e:
            logger.error(f"根据元数据删除文档失败: {e}", exc_info=True)
            raise

    async def similarity_search(
        self,
        query: str,
        k: int = 5,
        filter: dict | None = None
    ) -> list[LangChainDocument]:
        """相似度搜索"""
        await self._ensure_initialized()

        try:
            logger.info(f"执行相似度搜索: query='{query[:50]}...', k={k}")

            results = await self._vector_store.asimilarity_search(
                query=query,
                k=k,
                filter=filter
            )

            logger.info(f"✅ 搜索完成，找到 {len(results)} 个结果")
            return results

        except Exception as e:
            logger.error(f"向量搜索失败: {e}", exc_info=True)
            raise

    async def similarity_search_with_score(
        self,
        query: str,
        k: int = 5,
        filter: dict | None = None
    ) -> list[tuple[LangChainDocument, float]]:
        """带相似度分数的搜索"""
        await self._ensure_initialized()

        try:
            results = await self._vector_store.asimilarity_search_with_score(
                query=query,
                k=k,
                filter=filter
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
            where_clause = ""
            if key in self.optimized_columns:
                where_clause = f"{key} = :value"
            else:
                where_clause = f"langchain_metadata->>'{key}' = :value"

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
                    "metadata": row.langchain_metadata
                }
                for row in rows
            ]
        except Exception as e:
            logger.error(f"获取文档片段失败: {e}", exc_info=True)
            return []

    async def close(self):
        """关闭数据库连接"""
        if self._engine and hasattr(self._engine, '_pool'):
            try:
                await self._engine._pool.dispose()
                logger.info("✅ 向量存储连接已关闭")
            except Exception as e:
                logger.warning(f"关闭连接时出错: {e}")

