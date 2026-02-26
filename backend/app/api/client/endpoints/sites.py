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
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.common.masking import filter_client_site_data
from app.core.common.utils import Paginator
from app.core.infra.cache import cached_response
from app.core.web.exceptions import NotFoundException
from app.crud import crud_site
from app.db.database import get_db
from app.schemas.response import ApiResponse, PaginatedResponse
from app.schemas.site import Site

router = APIRouter()


@router.get("", response_model=ApiResponse[PaginatedResponse[Site]], operation_id="listClientSites")
async def list_active_sites(
    page: int = 1,
    size: int = 10,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[PaginatedResponse[Site]]:
    """获取激活的站点列表（客户端）"""
    total = await crud_site.count(db, status="active")
    paginator = Paginator(page=page, size=size, total=total)

    # 只返回状态为 active 的站点，并预加载租户信息
    from sqlalchemy import select
    from app.models.site import Site as SiteModel

    stmt = (
        select(SiteModel).where(SiteModel.status == "active").options(joinedload(SiteModel.tenant))
    )
    result = await db.execute(stmt.offset(paginator.skip).limit(paginator.size))
    sites = list(result.scalars())

    # [Security] 对客户端站点数据进行脱敏
    for site in sites:
        filter_client_site_data(site)

    return ApiResponse.ok(
        data=PaginatedResponse(
            list=sites,
            pagination=paginator.to_pagination_info(),
        ),
        msg="获取成功",
    )


@router.get(":bySlug/{slug}", response_model=ApiResponse[Site], operation_id="getClientSiteBySlug")
@cached_response(ttl=10, key_prefix="client:site:slug")  # 降低缓存时间到 10 秒
async def get_site_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[Site]:
    """通过 slug 获取站点详情（客户端）"""
    from sqlalchemy import select
    from app.models.site import Site as SiteModel

    stmt = select(SiteModel).where(SiteModel.slug == slug).options(joinedload(SiteModel.tenant))
    result = await db.execute(stmt)
    site = result.scalar_one_or_none()
    if not site or site.status != "active":
        raise NotFoundException(detail=f"站点 {slug} 不存在")

    # [Security] 对客户端站点数据进行脱敏
    filter_client_site_data(site)

    return ApiResponse.ok(data=site, msg="获取成功")


@router.get("/{site_id}", response_model=ApiResponse[Site], operation_id="getClientSite")
@cached_response(ttl=10, key_prefix="client:site:id")  # 降低缓存时间到 10 秒
async def get_site(
    site_id: int,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[Site]:
    """获取站点详情（客户端）"""
    from sqlalchemy import select
    from app.models.site import Site as SiteModel

    stmt = select(SiteModel).where(SiteModel.id == site_id).options(joinedload(SiteModel.tenant))
    result = await db.execute(stmt)
    site = result.scalar_one_or_none()
    if not site or site.status != "active":
        raise NotFoundException(detail=f"站点 {site_id} 不存在")

    # [Security] 对客户端站点数据进行脱敏
    filter_client_site_data(site)

    return ApiResponse.ok(data=site, msg="获取成功")
