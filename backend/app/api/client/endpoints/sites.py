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

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.core.common.utils import Paginator
from app.core.infra.cache import cached_response
from app.core.web.exceptions import NotFoundException
from app.db.database import get_db
from app.schemas.response import ApiResponse, PaginatedResponse
from app.schemas.site import ClientSite

router = APIRouter()


@router.get(
    "", response_model=ApiResponse[PaginatedResponse[ClientSite]], operation_id="listClientSites"
)
async def list_active_sites(
    page: int = 1,
    size: int = 10,
    tenant_id: int | None = Query(None, description="租户ID"),
    tenant_slug: str | None = Query(None, description="租户标识 (Portal 入口有效)"),
    keyword: str | None = Query(None, description="搜索关键词（站点名称或描述）"),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[PaginatedResponse[ClientSite]]:
    """获取激活的站点列表（客户端）

    - 不传 tenant_id：返回所有租户的激活站点（站点广场）
    - 传 tenant_id：仅返回该租户下的激活站点
    """
    from sqlalchemy import func, or_, select

    from app.models.site import Site as SiteModel

    # 构建基础查询条件
    base_filters = [SiteModel.status == "active"]
    if tenant_id is not None:
        base_filters.append(SiteModel.tenant_id == tenant_id)
    elif tenant_slug:
        from app.models.tenant import Tenant as TenantModel

        # 通过 Join 租户表过滤
        stmt_tenant = select(TenantModel.id).where(TenantModel.slug == tenant_slug)
        tenant_id_res = (await db.execute(stmt_tenant)).scalar_one_or_none()
        if tenant_id_res:
            base_filters.append(SiteModel.tenant_id == tenant_id_res)
        else:
            # 租户不存在，直接返回空结果
            return ApiResponse.ok(data=PaginatedResponse(list=[], total=0, page=page, size=size))

    if keyword:
        base_filters.append(
            or_(
                SiteModel.name.icontains(keyword),
                SiteModel.description.icontains(keyword),
            )
        )

    # 统计总数
    count_stmt = select(func.count()).select_from(SiteModel).where(*base_filters)
    total = (await db.execute(count_stmt)).scalar_one()
    paginator = Paginator(page=page, size=size, total=total)

    # 查询站点列表，预加载租户信息
    stmt = select(SiteModel).where(*base_filters).options(joinedload(SiteModel.tenant))
    result = await db.execute(stmt.offset(paginator.skip).limit(paginator.size))
    sites = list(result.scalars())

    # [Security] 使用 ClientSite Schema 自动过滤敏感字段
    client_sites = [ClientSite.model_validate(site, from_attributes=True) for site in sites]

    return ApiResponse.ok(
        data=PaginatedResponse(
            list=client_sites,
            pagination=paginator.to_pagination_info(),
        ),
        msg="获取成功",
    )


@router.get(
    ":bySlug/{slug}", response_model=ApiResponse[ClientSite], operation_id="getClientSiteBySlug"
)
@cached_response(ttl=10, key_prefix="client:site:slug")  # 降低缓存时间到 10 秒
async def get_site_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[ClientSite]:
    """通过 slug 获取站点详情（客户端）"""
    from sqlalchemy import select

    from app.models.site import Site as SiteModel

    stmt = select(SiteModel).where(SiteModel.slug == slug).options(joinedload(SiteModel.tenant))
    result = await db.execute(stmt)
    site = result.scalar_one_or_none()
    if not site or site.status != "active":
        raise NotFoundException(detail=f"站点 {slug} 不存在")

    # [Security] 使用 ClientSite Schema 自动过滤敏感字段
    return ApiResponse.ok(
        data=ClientSite.model_validate(site, from_attributes=True), msg="获取成功"
    )


@router.get("/{site_id}", response_model=ApiResponse[ClientSite], operation_id="getClientSite")
@cached_response(ttl=10, key_prefix="client:site:id")  # 降低缓存时间到 10 秒
async def get_site(
    site_id: int,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[ClientSite]:
    """获取站点详情（客户端）"""
    from sqlalchemy import select

    from app.models.site import Site as SiteModel

    stmt = select(SiteModel).where(SiteModel.id == site_id).options(joinedload(SiteModel.tenant))
    result = await db.execute(stmt)
    site = result.scalar_one_or_none()
    if not site or site.status != "active":
        raise NotFoundException(detail=f"站点 {site_id} 不存在")

    # [Security] 使用 ClientSite Schema 自动过滤敏感字段
    return ApiResponse.ok(
        data=ClientSite.model_validate(site, from_attributes=True), msg="获取成功"
    )
