from fastapi import APIRouter

from app.api.admin.endpoints import (
    cache,
    collections,
    documents,
    files,
    sites,
    stats,
    system_config,
    users,
)

api_router = APIRouter()

# 注册业务路由（Admin API）
api_router.include_router(sites.router, prefix="/sites", tags=["admin-sites"])
api_router.include_router(documents.router, prefix="/documents", tags=["admin-documents"])
api_router.include_router(collections.router, prefix="/collections", tags=["admin-collections"])
api_router.include_router(users.router, prefix="/users", tags=["admin-users"])
api_router.include_router(system_config.router, prefix="/system-configs", tags=["admin-system-configs"])
api_router.include_router(stats.router, prefix="/stats", tags=["admin-stats"])
api_router.include_router(files.router, prefix="/files", tags=["admin-files"])
api_router.include_router(cache.router, prefix="/cache", tags=["admin-cache"])


