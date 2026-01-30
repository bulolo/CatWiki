"""
缓存管理 API 端点
"""
import logging

from fastapi import APIRouter, Depends

from app.core.cache import get_cache
from app.core.deps import get_current_active_user
from app.models.user import User
from app.schemas.response import ApiResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(":stats", response_model=ApiResponse[dict], operation_id="getAdminCacheStats")
async def get_cache_stats(
    current_user: User = Depends(get_current_active_user)
) -> ApiResponse[dict]:
    """获取缓存统计信息"""
    cache = get_cache()
    stats = cache.stats()

    return ApiResponse.ok(
        data=stats,
        msg="获取缓存统计信息成功"
    )


@router.post(":clear", response_model=ApiResponse[dict], operation_id="clearAdminCache")
async def clear_cache(
    current_user: User = Depends(get_current_active_user)
) -> ApiResponse[dict]:
    """清空所有缓存"""
    cache = get_cache()
    cache.clear()
    logger.info("管理员清空了所有缓存")

    return ApiResponse.ok(
        data={"message": "缓存已清空"},
        msg="清空缓存成功"
    )
