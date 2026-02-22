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

from fastapi import APIRouter, Depends

from app.api.client.endpoints import (
    bots,
    chat,
    chat_sessions,
    collections,
    documents,
    files,
    health,
    sites,
)
from app.core.web.deps import set_client_tenant_context

api_router = APIRouter()

# 注册客户端路由（Client API），并自动读取 X-Tenant-Slug 确定当前租户
client_deps = [Depends(set_client_tenant_context)]

api_router.include_router(sites.router, prefix="/sites", tags=["sites"], dependencies=client_deps)
api_router.include_router(
    documents.router, prefix="/documents", tags=["documents"], dependencies=client_deps
)
api_router.include_router(
    collections.router, prefix="/collections", tags=["collections"], dependencies=client_deps
)
api_router.include_router(files.router, prefix="/files", tags=["files"], dependencies=client_deps)
api_router.include_router(chat.router, prefix="/chat", tags=["chat"], dependencies=client_deps)
api_router.include_router(
    chat_sessions.router, prefix="/chat", tags=["chat-sessions"], dependencies=client_deps
)
api_router.include_router(
    health.router, prefix="/health", tags=["health"], dependencies=client_deps
)
api_router.include_router(bots.router, prefix="/bot", tags=["bot"], dependencies=client_deps)
