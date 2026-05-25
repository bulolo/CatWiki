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
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.api.admin.router import api_router as admin_router
from app.api.client.router import api_router as client_router
from app.core.common.logger import setup_logging
from app.core.infra.config import settings
from app.core.lifecycle.manager import LifecycleManager
from app.core.web.exceptions import setup_exception_handlers
from app.core.web.middleware import setup_middleware
from app.core.web.openapi_utils import filter_openapi_by_prefix
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

    # 1. 启动核心生命周期 (配置同步、RustFS、Checkpointer、VectorStore、集成服务等)
    await LifecycleManager.startup()

    # 2. 初始化 EE 功能 (需要 app 实例，故保留在此)
    try:
        from app.ee.loader import init_ee_features

        await init_ee_features(app)
    except ImportError:
        logger.info("🏠 Running in Community Edition mode (Single-Tenant)")

    logger.info(f"{settings.PROJECT_NAME} 启动成功!")
    if app.docs_url:
        logger.info(f"API 文档: http://localhost:3000{app.docs_url}")

    yield

    # 关闭时执行
    logger.info(f"正在关闭 {settings.PROJECT_NAME}...")

    # 1. 关闭所有核心组件 (LLM、VectorStore、Checkpointer、集成服务)
    await LifecycleManager.shutdown()

    # 2. 关闭数据库引擎
    await engine.dispose()
    logger.info(f"{settings.PROJECT_NAME} 已关闭")


def create_application() -> FastAPI:
    """创建 FastAPI 应用实例"""
    # 生产环境禁用 Swagger UI 和 ReDoc
    docs_url = "/docs" if settings.ENVIRONMENT != "prod" else None
    redoc_url = "/redoc" if settings.ENVIRONMENT != "prod" else None
    openapi_url = "/openapi.json" if settings.ENVIRONMENT != "prod" else None

    openapi_tags = [
        {"name": "admin-sites"},
        {"name": "admin-collections"},
        {"name": "admin-documents"},
        {"name": "admin-files"},
        {"name": "admin-users"},
        {"name": "admin-tenants"},
        {"name": "admin-system-configs"},
        {"name": "admin-stats"},
        {"name": "admin-cache"},
        {"name": "admin-tasks"},
        {"name": "admin-health"},
        {"name": "client-sites"},
        {"name": "client-collections"},
        {"name": "client-documents"},
        {"name": "client-files"},
        {"name": "client-chat"},
        {"name": "client-chat-sessions"},
        {"name": "client-bot"},
        {"name": "client-health"},
        {"name": "ee-admin-tenants"},
        {"name": "ee-admin-sites"},
        {"name": "ee-client-sites"},
        {"name": "ee-client-bot"},
    ]

    application = FastAPI(
        title=settings.PROJECT_NAME,
        description=settings.DESCRIPTION,
        version=settings.VERSION,
        openapi_url=openapi_url,
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_tags=openapi_tags,
        lifespan=lifespan,
        debug=settings.DEBUG,
    )

    # 配置中间件
    setup_middleware(application)

    # 注册 EE 诊断中间件 (必须在应用启动前注册)
    try:
        from app.ee.integrity import init_app_diagnostics

        init_app_diagnostics(application)
    except ImportError:
        pass

    # 注册 EE 站点访问守卫中间件
    try:
        from app.ee.middleware.site_access_guard import site_access_guard

        application.middleware("http")(site_access_guard)
    except ImportError:
        pass

    # 配置异常处理器
    setup_exception_handlers(application)

    # 注册 Client API 路由（公开访问）
    application.include_router(client_router, prefix=settings.API_V1_STR)

    # 注册 Admin API 路由（管理后台）
    application.include_router(admin_router, prefix=settings.ADMIN_API_V1_STR)

    # 注册 EE 路由 (同步加载，确保 Swagger 文档能抓取到)
    try:
        from app.ee.api.router import init_ee_routes

        init_ee_routes(application)
    except ModuleNotFoundError:
        logger.debug("[EE] EE routes not available (CE build)")
    except Exception as e:
        logger.error(f"❌ [EE] Failed to initialize EE routes: {e}")

    return application


app = create_application()


# 添加自定义 OpenAPI 端点
@app.get("/openapi-admin.json", include_in_schema=False)
async def get_admin_openapi():
    """获取 Admin API 的 OpenAPI 规范"""
    spec = filter_openapi_by_prefix(app, settings.ADMIN_API_V1_STR)
    spec["info"]["title"] = "CatWiki Admin API"
    spec["info"]["description"] = "管理后台 API - 提供完整的增删改查功能"
    return JSONResponse(content=spec)


@app.get("/openapi-client.json", include_in_schema=False)
async def get_client_openapi():
    """获取 Client API 的 OpenAPI 规范"""
    spec = filter_openapi_by_prefix(app, settings.API_V1_STR)
    spec["info"]["title"] = "CatWiki Client API"
    spec["info"]["description"] = "客户端 API - 仅提供已发布内容的只读访问"
    return JSONResponse(content=spec)
