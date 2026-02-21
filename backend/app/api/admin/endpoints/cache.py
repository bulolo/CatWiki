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

"""
缓存管理 API 端点
"""

import logging

from fastapi import APIRouter, Depends

from app.core.infra.cache import get_cache
from app.core.web.deps import get_current_user_with_tenant
from app.models.user import User
from app.schemas.response import ApiResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(":stats", response_model=ApiResponse[dict], operation_id="getAdminCacheStats")
async def get_cache_stats(
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[dict]:
    """获取缓存统计信息"""
    cache = get_cache()
    stats = cache.stats()

    return ApiResponse.ok(data=stats, msg="获取缓存统计信息成功")


@router.post(":clear", response_model=ApiResponse[dict], operation_id="clearAdminCache")
async def clear_cache(
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[dict]:
    """清空所有缓存"""
    cache = get_cache()
    cache.clear()
    logger.info("管理员清空了所有缓存")

    return ApiResponse.ok(data={"message": "缓存已清空"}, msg="清空缓存成功")
