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

from fastapi import APIRouter

from app.api.admin.endpoints import (
    cache,
    collections,
    documents,
    files,
    health,
    sites,
    stats,
    system_config,
    tenants,
    users,
)

api_router = APIRouter()

# 注册业务路由（Admin API）
api_router.include_router(sites.router, prefix="/sites", tags=["admin-sites"])
api_router.include_router(documents.router, prefix="/documents", tags=["admin-documents"])
api_router.include_router(collections.router, prefix="/collections", tags=["admin-collections"])
api_router.include_router(users.router, prefix="/users", tags=["admin-users"])
api_router.include_router(
    system_config.router, prefix="/system-configs", tags=["admin-system-configs"]
)
api_router.include_router(stats.router, prefix="/stats", tags=["admin-stats"])
api_router.include_router(files.router, prefix="/files", tags=["admin-files"])
api_router.include_router(cache.router, prefix="/cache", tags=["admin-cache"])
api_router.include_router(health.router, prefix="/health", tags=["admin-health"])
api_router.include_router(tenants.router, prefix="/tenants", tags=["admin-tenants"])
