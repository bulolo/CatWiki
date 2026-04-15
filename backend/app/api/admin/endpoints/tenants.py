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
租户管理 API 端点 (基础版)
"""

import logging

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.common.i18n import _
from app.core.web.deps import get_db, set_tenant_context
from app.core.web.exceptions import NotFoundException
from app.crud.tenant import crud_tenant
from app.schemas.response import ApiResponse
from app.schemas.tenant import TenantSchema

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get(
    "/current",
    response_model=ApiResponse[TenantSchema | None],
    summary="获取当前生效租户",
    description="根据 Token 和 X-Selected-Tenant-ID Header 获取当前生效的租户详情",
    operation_id="getAdminCurrentTenant",
)
async def get_current_tenant_info(
    db: AsyncSession = Depends(get_db),
    tenant_id: int | None = Depends(set_tenant_context),
) -> ApiResponse[TenantSchema | None]:
    """
    获取当前租户信息
    - 用于前端判断演示模式 (is_demo)
    - 用于平台管理员识别当前所处的租户视图
    """
    if tenant_id is None:
        logger.info("🧭 [Tenants] getCurrentTenant: No tenant context (Global View)")
        return ApiResponse.ok(data=None, msg=_("tenant.global_view"))

    tenant = await crud_tenant.get(db, id=tenant_id)
    if not tenant:
        logger.warning(f"⚠️ [Tenants] getCurrentTenant: Tenant {tenant_id} not found")
        raise NotFoundException(detail=_("tenant.identified_not_found"))

    schema_data = TenantSchema.model_validate(tenant)
    logger.info(
        "🧭 [Tenants] getCurrentTenant: ID=%s, is_demo=%s",
        tenant.id,
        schema_data.is_demo,
    )
    return ApiResponse.ok(data=schema_data)
