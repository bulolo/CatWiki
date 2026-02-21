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
统计信息 API 端点
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.web.deps import get_current_user_with_tenant
from app.db.database import get_db
from app.models.user import User
from app.schemas.response import ApiResponse
from app.crud.user import crud_user
from app.schemas.stats import SiteStats
from app.services.stats import StatsService

router = APIRouter()


@router.get(":siteStats", response_model=ApiResponse[SiteStats], operation_id="getAdminSiteStats")
async def get_site_stats(
    site_id: int = Query(..., description="站点ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[SiteStats]:
    """获取站点统计数据

    返回:
        - total_documents: 文档总数
        - total_views: 总访问次数
    """

    stats = await StatsService.get_site_stats(db, site_id=site_id)

    return ApiResponse.ok(data=SiteStats(**stats), msg="获取成功")
