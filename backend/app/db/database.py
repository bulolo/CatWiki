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

import logging
from collections.abc import AsyncGenerator

from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from starlette.exceptions import HTTPException

from app.core.infra.config import settings
from app.core.web.exceptions import CatWikiError
from app.db.events import register_core_db_events

logger = logging.getLogger(__name__)

# 创建异步数据库引擎
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # 连接前检查连接是否有效
    pool_size=settings.DB_POOL_SIZE,  # 连接池大小
    max_overflow=settings.DB_MAX_OVERFLOW,  # 最大溢出连接数
    pool_timeout=settings.DB_POOL_TIMEOUT,  # 连接超时时间（秒）
    pool_recycle=settings.DB_POOL_RECYCLE,  # 连接回收时间（秒）
    echo=settings.DB_ECHO,  # 是否输出 SQL 日志
    connect_args={"ssl": False},  # 禁用 SSL 连接（解决 Docker 网络中的 conn lost 问题）
)

# 创建异步会话工厂
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,  # 提交后不过期对象
)

register_core_db_events()


async def get_db() -> AsyncGenerator[AsyncSession]:
    """
    异步数据库会话依赖注入

    使用示例：
        @app.get("/items/")
        async def read_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            # 忽略业务和验证异常，避免不必要的数据库错误日志
            from starlette.requests import ClientDisconnect

            if not isinstance(
                e,
                HTTPException
                | RequestValidationError
                | ValidationError
                | CatWikiError
                | ClientDisconnect,
            ):
                logger.error(f"数据库会话错误: {e}")
            await session.rollback()
            raise
        # async with 自动处理 session.close()
