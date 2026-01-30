import logging
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

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
            logger.error(f"数据库会话错误: {e}")
            await session.rollback()
            raise
        # async with 自动处理 session.close()
