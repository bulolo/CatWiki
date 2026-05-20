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
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

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

    [关键] AsyncPostgresSaver 持有 *pool* 而非单根连接，内部每次读写经
    ``pool.connection()`` 临时借一根连接 (~毫秒级)，操作完归还。
    与原先"整条流式期间独占一根连接"相比，并发上限不再受 ``max_size`` 限制。

    为何每请求新建实例而不复用单例：``AsyncPostgresSaver.__init__`` 会创建
    一个 ``asyncio.Lock``，所有该实例上的 checkpoint 操作都共享这把锁，
    复用单例会让跨请求的写入彼此串行化。每请求新建实例代价极低
    （仅几个对象引用 + 一把 Lock），却保留了真正的并发。

    使用方式:
        async with get_checkpointer() as checkpointer:
            graph = create_agent_graph(checkpointer=checkpointer)
            result = await graph.ainvoke(state, config)
    """
    pool = await init_checkpointer_pool()
    # AsyncPostgresSaver 既接受 AsyncConnection 也接受 AsyncConnectionPool；
    # 传 pool 时其内部 get_connection 会按操作借/还连接。
    yield AsyncPostgresSaver(pool)


async def setup_checkpointer_tables() -> None:
    """初始化 Checkpointer 数据库表

    在应用启动时调用，确保表结构存在。
    """
    pool = await init_checkpointer_pool()

    async with pool.connection() as conn:
        # setup() 会执行 CREATE INDEX CONCURRENTLY，需要 autocommit 模式
        await conn.set_autocommit(True)
        checkpointer = AsyncPostgresSaver(conn)
        await checkpointer.setup()

    logger.info("📦 [Checkpointer] Database tables ready")
