from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cache import cached_response
from app.core.exceptions import NotFoundException
from app.core.utils import Paginator
from app.crud import crud_site
from app.db.database import get_db
from app.schemas import ApiResponse, PaginatedResponse
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

    # 只返回状态为 active 的站点
    sites = await crud_site.list(db, skip=paginator.skip, limit=paginator.size, status="active")

    return ApiResponse.ok(
        data=PaginatedResponse(
            list=sites,
            pagination=paginator.to_pagination_info(),
        ),
        msg="获取成功"
    )


@router.get(":byDomain/{domain}", response_model=ApiResponse[Site], operation_id="getClientSiteByDomain")
@cached_response(ttl=10, key_prefix="client:site:domain")  # 降低缓存时间到 10 秒
async def get_site_by_domain(
    domain: str,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[Site]:
    """通过 domain 获取站点详情（客户端）"""
    site = await crud_site.get_by_domain(db, domain=domain)
    if not site or site.status != "active":
        raise NotFoundException(detail=f"站点 {domain} 不存在")

    return ApiResponse.ok(data=site, msg="获取成功")


@router.get("/{site_id}", response_model=ApiResponse[Site], operation_id="getClientSite")
@cached_response(ttl=10, key_prefix="client:site:id")  # 降低缓存时间到 10 秒
async def get_site(
    site_id: int,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[Site]:
    """获取站点详情（客户端）"""
    site = await crud_site.get(db, id=site_id)
    if not site or site.status != "active":
        raise NotFoundException(detail=f"站点 {site_id} 不存在")

    return ApiResponse.ok(data=site, msg="获取成功")
