import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.api.admin.api import api_router as admin_router
from app.api.admin.endpoints import health
from app.api.client.api import api_router as client_router
from app.core.config import settings
from app.core.exceptions import setup_exception_handlers
from app.core.logger import setup_logging
from app.core.middleware import setup_middleware
from app.core.openapi_utils import filter_openapi_by_prefix
from app.core.rustfs import init_rustfs
from app.core.system_config_init import sync_ai_config_to_db
from app.db.database import engine

# 配置日志
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时执行
    logger.info(f"正在启动 {settings.PROJECT_NAME}...")
    logger.info(f"环境: {settings.ENVIRONMENT}")
    logger.info(f"调试模式: {settings.DEBUG}")

    # 检查数据库连接
    try:
        from sqlalchemy import text
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("✅ 数据库连接成功")
    except Exception as e:
        logger.error(f"❌ 数据库连接失败: {e}")
        raise

    logger.info("数据库由 Alembic 管理")

    # 初始化 RustFS 服务
    try:
        init_rustfs()
    except Exception as e:
        logger.warning(f"RustFS 初始化失败: {e}")

    # 同步 AI 配置到数据库
    await sync_ai_config_to_db()

    logger.info(f"{settings.PROJECT_NAME} 启动成功!")
    logger.info("API 文档: http://localhost:3000/docs")
    logger.info("健康检查: http://localhost:3000/health")

    yield

    # 关闭时执行
    logger.info(f"正在关闭 {settings.PROJECT_NAME}...")
    await engine.dispose()
    logger.info(f"{settings.PROJECT_NAME} 已关闭")


def create_application() -> FastAPI:
    """创建 FastAPI 应用实例"""
    application = FastAPI(
        title=settings.PROJECT_NAME,
        description=settings.DESCRIPTION,
        version=settings.VERSION,
        openapi_url="/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
        debug=settings.DEBUG,
    )

    # 配置中间件
    setup_middleware(application)

    # 配置异常处理器
    setup_exception_handlers(application)

    # 注册根路由（health 等）
    application.include_router(health.router, tags=["health"])

    # 注册 Client API 路由（公开访问）
    application.include_router(client_router, prefix=settings.API_V1_STR)

    # 注册 Admin API 路由（管理后台）
    application.include_router(admin_router, prefix=settings.ADMIN_API_V1_STR)

    return application


app = create_application()


# 添加自定义 OpenAPI 端点
@app.get("/openapi-admin.json", include_in_schema=False)
async def get_admin_openapi():
    """获取 Admin API 的 OpenAPI 规范"""
    spec = filter_openapi_by_prefix(app, settings.ADMIN_API_V1_STR)
    spec['info']['title'] = "CatWiki Admin API"
    spec['info']['description'] = "管理后台 API - 提供完整的增删改查功能"
    return JSONResponse(content=spec)


@app.get("/openapi-client.json", include_in_schema=False)
async def get_client_openapi():
    """获取 Client API 的 OpenAPI 规范"""
    spec = filter_openapi_by_prefix(app, settings.API_V1_STR)
    spec['info']['title'] = "CatWiki Client API"
    spec['info']['description'] = "客户端 API - 仅提供已发布内容的只读访问"
    return JSONResponse(content=spec)

