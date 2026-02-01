"""
统计信息 API 端点
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user
from app.db.database import get_db
from app.models.user import User
from app.schemas import ApiResponse
from app.schemas.stats import SiteStats
from app.services.stats_service import StatsService

router = APIRouter()


@router.get(":siteStats", response_model=ApiResponse[SiteStats], operation_id="getAdminSiteStats")
async def get_site_stats(
    site_id: int = Query(..., description="站点ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[SiteStats]:
    """获取站点统计数据

    返回:
        - total_documents: 文档总数
        - total_views: 总访问次数
    """



    stats = await StatsService.get_site_stats(db, site_id=site_id)

    return ApiResponse.ok(
        data=SiteStats(**stats),
        msg="获取成功"
    )
