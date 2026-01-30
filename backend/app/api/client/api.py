from fastapi import APIRouter

from app.api.client.endpoints import collections, documents, files, sites, chat

api_router = APIRouter()

# 注册客户端路由（Client API）
api_router.include_router(sites.router, prefix="/sites", tags=["sites"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(collections.router, prefix="/collections", tags=["collections"])
api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])

