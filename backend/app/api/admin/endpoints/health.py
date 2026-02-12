# Copyright 2024 CatWiki Authors
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

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.infra.config import settings
from app.db.database import get_db
from app.schemas.response import ApiResponse, HealthResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get(
    "/",
    response_model=ApiResponse[HealthResponse],
    summary="健康检查",
    description="检查 API 服务、数据库连接和对象存储状态",
    operation_id="getAdminHealth",
)
async def health_check(db: AsyncSession = Depends(get_db)) -> ApiResponse[HealthResponse]:
    """
    增强的健康检查接口
    - 检查 API 服务状态
    - 检查数据库连接状态
    - 检查 RustFS 对象存储状态
    - 返回版本和环境信息

    状态说明:
    - healthy: 所有组件正常
    - degraded: 部分组件异常但核心功能可用
    - unhealthy: 关键组件异常
    """
    from datetime import UTC, datetime

    from app.core.infra.rustfs import get_rustfs_service

    health_status = {
        "status": "healthy",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "demo_mode": settings.DEMO_MODE,
        "timestamp": datetime.now(UTC).isoformat(),
        "checks": {},
    }

    # 1. 检查数据库连接
    try:
        await db.execute(text("SELECT 1"))
        health_status["checks"]["database"] = "ok"
        logger.info("健康检查: 数据库连接正常")
    except Exception as e:
        health_status["checks"]["database"] = f"error: {str(e)}"
        health_status["status"] = "unhealthy"  # 数据库是关键组件
        logger.error(f"健康检查: 数据库连接失败 - {e}")

    # 2. 检查 RustFS 对象存储
    try:
        rustfs = get_rustfs_service()
        if rustfs.is_available():
            # 检查 bucket 是否存在
            if rustfs.client.bucket_exists(rustfs.bucket_name):
                health_status["checks"]["storage"] = "ok"
                logger.info("健康检查: RustFS 存储正常")
            else:
                health_status["checks"]["storage"] = "warning: bucket not found"
                health_status["status"] = "degraded"  # 存储非关键，降级服务
                logger.warning("健康检查: RustFS bucket 不存在")
        else:
            health_status["checks"]["storage"] = "unavailable"
            health_status["status"] = "degraded"  # 存储非关键，降级服务
            logger.warning("健康检查: RustFS 服务不可用")
    except Exception as e:
        health_status["checks"]["storage"] = f"error: {str(e)}"
        health_status["status"] = "degraded"  # 存储异常不影响核心功能
        logger.error(f"健康检查: RustFS 检查失败 - {e}")

    return ApiResponse.ok(data=health_status)
