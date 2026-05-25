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

from app.core.common.i18n import _
from app.db.database import get_db
from app.schemas.response import ApiResponse, PaginatedResponse
from app.schemas.site import ClientSite
from app.services.site_service import SiteService, get_site_service

router = APIRouter()


def _safe_tenant_slug(site) -> str | None:
    """安全获取 tenant_slug，避免 detached ORM 对象触发 lazy load"""
    try:
        from sqlalchemy import inspect as sa_inspect

        state = sa_inspect(site)
        if "tenant" in state.dict:
            return site.tenant.slug if site.tenant else None
        return None
    except Exception:
        return None


async def _get_ee_access(db: AsyncSession, site_id: int) -> dict:
    """EE 钩子：查询站点访问控制状态。CE 中返回空 dict。"""
    try:
        from app.ee.loader import get_ee_site_access_status

        return await get_ee_site_access_status(db, site_id)
    except (ImportError, AttributeError):
        return {}


@router.get(
    "", response_model=ApiResponse[PaginatedResponse[ClientSite]], operation_id="listClientSites"
)
async def list_active_sites(
    page: int = 1,
    size: int = 10,
    is_pager: int = Query(1, description="是否分页，0=返回全部，1=分页"),
    tenant_id: int | None = Query(None, description="租户ID"),
    tenant_slug: str | None = Query(None, description="租户标识 (Portal 入口有效)"),
    keyword: str | None = Query(None, description="搜索关键词（站点名称或描述）"),
    service: SiteService = Depends(get_site_service),
) -> ApiResponse[PaginatedResponse[ClientSite]]:
    """获取激活的站点列表（客户端）

    - 不传 tenant_id：返回所有租户的激活站点（站点广场）
    - 传 tenant_id：仅返回该租户下的激活站点
    """
    client_sites, paginator = await service.list_client_sites(
        page, size, tenant_id, tenant_slug, keyword, is_pager=is_pager
    )

    return ApiResponse.ok(
        data=PaginatedResponse(
            list=client_sites,
            pagination=paginator.to_pagination_info(),
        ),
        msg=_("api.success.get"),
    )


@router.get(
    ":bySlug/{slug}", response_model=ApiResponse[ClientSite], operation_id="getClientSiteBySlug"
)
async def get_site_by_slug(
    slug: str,
    tenant_slug: str | None = Query(None, description="租户标识"),
    service: SiteService = Depends(get_site_service),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[ClientSite]:
    """通过 slug 获取站点详情（客户端）"""
    site = await service.get_client_site(slug=slug, tenant_slug=tenant_slug)
    return await _build_response(site, db)


@router.get("/{site_id}", response_model=ApiResponse[ClientSite], operation_id="getClientSite")
async def get_site(
    site_id: int,
    service: SiteService = Depends(get_site_service),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[ClientSite]:
    """获取站点详情（客户端）"""
    site = await service.get_client_site(site_id=site_id)
    return await _build_response(site, db)


async def _build_response(site, db: AsyncSession) -> ApiResponse[ClientSite]:
    """构建响应：先让 FastAPI 正常序列化 ORM，再补 EE 字段"""
    # 构建基础响应（不触发 lazy load，使用已加载的属性）
    data = {
        "id": site.id,
        "name": site.name,
        "slug": site.slug,
        "description": site.description,
        "icon": site.icon,
        "article_count": site.article_count,
        "view_count": getattr(site, "view_count", 0),
        "tenant_id": site.tenant_id,
        "tenant_slug": _safe_tenant_slug(site),
        "theme_color": site.theme_color,
        "layout_mode": site.layout_mode,
        "quick_questions": site.quick_questions,
        "web_widget": site.web_widget,
        "is_public": True,
        "requires_password": False,
        "has_password": False,
    }

    # EE 钩子补充
    ee = await _get_ee_access(db, site.id)
    if ee:
        data["is_public"] = ee.get("is_public", True)
        data["requires_password"] = ee.get("requires_password", False)
        data["has_password"] = ee.get("has_password", False)

    return ApiResponse.ok(data=data, msg=_("api.success.get"))
