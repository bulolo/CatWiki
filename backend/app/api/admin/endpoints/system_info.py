# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""系统引擎信息 API 端点"""

import asyncio
import logging
import urllib.parse

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.common.i18n import _
from app.core.web.deps import get_current_user_with_tenant
from app.db.database import get_db
from app.models.user import User
from app.schemas.response import ApiResponse

router = APIRouter()
logger = logging.getLogger(__name__)

_EDITION_DISPLAY = {"community": "Community", "enterprise": "Enterprise"}
_ENV_DISPLAY = {"local": "Local", "dev": "Development", "prod": "Production"}
_CACHE_DISPLAY = {"redis": "Redis", "memory": "In-Memory"}


async def _ping_vector(vector_type: str) -> tuple[str, bool]:
    from app.core.vector import VectorStoreManager

    backend_name = vector_type.capitalize()
    try:
        mgr = await VectorStoreManager.get_instance()
        ok = await mgr.ping()
        backend_name = mgr.vector_backend
        return backend_name, ok
    except Exception as e:
        logger.warning("system_info: vector ping failed: %s", e)
        return backend_name, False


async def _ping_db(db: AsyncSession) -> bool:
    try:
        await db.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.warning("system_info: db ping failed: %s", e)
        return False


async def _ping_cache() -> tuple[str, bool]:
    from app.core.infra.cache import RedisCache, get_cache

    cache = get_cache()
    raw = cache.stats().get("backend", "memory")
    backend = _CACHE_DISPLAY.get(raw, raw.capitalize())
    if isinstance(cache, RedisCache):
        try:
            await cache.client.ping()
            return backend, True
        except Exception as e:
            logger.warning("system_info: cache ping failed: %s", e)
            return backend, False
    return backend, True  # InMemoryCache always available


async def _ping_rustfs() -> bool:
    from app.core.infra.rustfs import get_rustfs_service

    svc = get_rustfs_service()
    if not svc.is_available():
        return False
    try:
        return await asyncio.to_thread(svc.client.bucket_exists, svc.bucket_name)
    except Exception as e:
        logger.warning("system_info: rustfs ping failed: %s", e)
        return False


@router.get(
    "",
    response_model=ApiResponse[dict],
    summary="获取系统引擎信息",
    operation_id="getSystemInfo",
)
async def get_system_info(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[dict]:
    """并发探活四大基础引擎，返回当前系统运行时状态。"""
    from app.core.infra.config import settings

    vector_type = settings.VECTOR_STORE_TYPE

    # 并发 ping 四个组件
    (vector_backend, vector_ok), db_ok, (cache_backend, cache_ok), rustfs_ok = await asyncio.gather(
        _ping_vector(vector_type),
        _ping_db(db),
        _ping_cache(),
        _ping_rustfs(),
        return_exceptions=False,
    )

    # Vector connection hint
    if vector_type == "elasticsearch":
        vector_conn = settings.ES_URL
    else:
        vector_conn = f"{settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}"

    # Cache connection hint
    if settings.REDIS_ENABLED and settings.REDIS_URL:
        parsed = urllib.parse.urlparse(settings.REDIS_URL)
        cache_conn = f"{parsed.hostname}:{parsed.port or 6379}"
    else:
        cache_conn = "in-process"

    return ApiResponse.ok(
        data={
            "system": {
                "version": settings.VERSION,
                "environment": _ENV_DISPLAY.get(
                    settings.ENVIRONMENT, settings.ENVIRONMENT.capitalize()
                ),
                "edition": _EDITION_DISPLAY.get(
                    settings.CATWIKI_EDITION, settings.CATWIKI_EDITION.capitalize()
                ),
            },
            "database": {
                "connection": f"{settings.POSTGRES_SERVER}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}",
                "ping": db_ok,
            },
            "vector_store": {
                "backend": vector_backend,
                "connection": vector_conn,
                "ping": vector_ok,
            },
            "cache": {
                "backend": cache_backend,
                "connection": cache_conn,
                "ping": cache_ok,
            },
            "object_storage": {
                "endpoint": settings.RUSTFS_ENDPOINT,
                "bucket": settings.RUSTFS_BUCKET_NAME,
                "ping": rustfs_ok,
            },
        },
        msg=_("api.success.get"),
    )
