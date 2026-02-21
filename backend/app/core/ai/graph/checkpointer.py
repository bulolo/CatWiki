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

"""PostgreSQL Checkpointer 管理器

使用 langgraph-checkpoint-postgres 实现聊天状态持久化。
通过 thread_id 隔离不同会话。
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool

from app.core.infra.config import settings

logger = logging.getLogger(__name__)

# 全局连接池（用于 Checkpointer）
_pool: AsyncConnectionPool | None = None


async def init_checkpointer_pool() -> AsyncConnectionPool:
    """初始化 Checkpointer 连接池

    Returns:
        AsyncConnectionPool 实例
    """
    global _pool

    if _pool is not None:
        return _pool

    # 构建 psycopg3 格式的连接字符串
    # 从 asyncpg 格式 (postgresql+asyncpg://...) 转换为 psycopg 格式
    db_url = settings.DATABASE_URL
    if "postgresql+asyncpg://" in db_url:
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

    logger.info("🔗 [Checkpointer] Initializing PostgreSQL connection pool...")

    _pool = AsyncConnectionPool(
        conninfo=db_url,
        min_size=2,
        max_size=10,
        open=False,  # 延迟打开
    )
    await _pool.open()

    logger.info("✅ [Checkpointer] Connection pool initialized")
    return _pool


async def close_checkpointer_pool() -> None:
    """关闭 Checkpointer 连接池"""
    global _pool

    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("🔌 [Checkpointer] Connection pool closed")


@asynccontextmanager
async def get_checkpointer() -> AsyncGenerator[AsyncPostgresSaver, None]:
    """获取 Checkpointer 上下文管理器

    使用方式:
        async with get_checkpointer() as checkpointer:
            graph = create_agent_graph(checkpointer=checkpointer)
            result = await graph.ainvoke(state, config)

    Yields:
        AsyncPostgresSaver 实例
    """
    pool = await init_checkpointer_pool()

    async with pool.connection() as conn:
        # 设置 autocommit 模式，因为 setup() 会执行 CREATE INDEX CONCURRENTLY
        # 该语句不能在事务块内运行
        await conn.set_autocommit(True)

        checkpointer = AsyncPostgresSaver(conn)

        # 确保表已创建
        await checkpointer.setup()

        yield checkpointer


async def setup_checkpointer_tables() -> None:
    """初始化 Checkpointer 数据库表

    在应用启动时调用，确保表结构存在。
    """
    async with get_checkpointer() as checkpointer:
        logger.info("📦 [Checkpointer] Database tables ready")
