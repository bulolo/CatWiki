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
系统配置 API 端点
"""

import logging
from typing import Literal

from fastapi import APIRouter, Depends

from app.core.web.deps import get_current_user_with_tenant
from app.models.user import User
from app.schemas.response import ApiResponse
from app.schemas.system_config import (
    AIConfigResponse,
    AIConfigUpdate,
    DocProcessorResponse,
    DocProcessorsUpdate,
    TestConnectionRequest,
    TestDocProcessorRequest,
)
from app.services.system_config_service import SystemConfigService, get_system_config_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get(
    "/ai-config",
    response_model=ApiResponse[AIConfigResponse],
    operation_id="getAdminAiConfig",
)
async def get_ai_config(
    scope: Literal["platform", "tenant"] = "tenant",
    service: SystemConfigService = Depends(get_system_config_service),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[AIConfigResponse]:
    """获取 AI 模型配置"""
    target_tenant_id = service.resolve_target_tenant_id(scope)

    # 1. 直接获取全量状态 (含 configs, meta, platform_defaults)
    full_state = await service.get_full_ai_state(target_tenant_id)

    return ApiResponse.ok(
        data=AIConfigResponse(**full_state),
        msg="获取成功",
    )


@router.put(
    "/ai-config",
    response_model=ApiResponse[AIConfigResponse],
    operation_id="updateAdminAiConfig",
)
async def update_ai_config(
    config_in: AIConfigUpdate,
    scope: Literal["platform", "tenant"] = "tenant",
    service: SystemConfigService = Depends(get_system_config_service),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[AIConfigResponse]:
    """更新 AI 模型配置 (仅更新传入部分，返回全量状态)"""
    target_tenant_id = service.resolve_target_tenant_id(scope)

    # 1. 执行更新，Service 层现在直接返回全量状态
    full_state = await service.update_ai_config(target_tenant_id, config_in)

    return ApiResponse.ok(
        data=AIConfigResponse(**full_state),
        msg="保存成功",
    )


@router.delete("/{config_key}", response_model=ApiResponse[dict], operation_id="deleteAdminConfig")
async def delete_config(
    config_key: str,
    scope: Literal["platform", "tenant"] = "tenant",
    service: SystemConfigService = Depends(get_system_config_service),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[dict]:
    """
    删除指定配置
    """
    target_tenant_id = service.resolve_target_tenant_id(scope)
    logger.info(
        "🧭 [SystemConfig] delete_config scope=%s target_tenant_id=%s key=%s",
        scope,
        target_tenant_id,
        config_key,
    )

    await service.delete_config(config_key, target_tenant_id)

    return ApiResponse.ok(data={"deleted": True}, msg="配置删除成功")


@router.post(
    "/ai-config/test-connection",
    response_model=ApiResponse[dict],
    operation_id="testModelConnection",
)
async def test_model_connection(
    request: TestConnectionRequest,
    scope: Literal["platform", "tenant"] = "tenant",
    service: SystemConfigService = Depends(get_system_config_service),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[dict]:
    """
    测试模型连接性
    """
    target_tenant_id = service.resolve_target_tenant_id(scope)
    logger.info(
        "🧭 [SystemConfig] test_model_connection scope=%s target_tenant_id=%s model_type=%s",
        scope,
        target_tenant_id,
        request.model_type,
    )

    result = await service.test_model_connection(
        target_tenant_id, request.model_type, request.config
    )
    return ApiResponse.ok(data=result, msg="连接成功")


# ============ 文档处理服务配置端点 ============


@router.get(
    "/doc-processor",
    response_model=ApiResponse[DocProcessorResponse],
    operation_id="getAdminDocProcessorConfig",
)
async def get_doc_processor_config(
    scope: Literal["platform", "tenant"] = "tenant",
    service: SystemConfigService = Depends(get_system_config_service),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[DocProcessorResponse]:
    """获取文档处理服务配置 (自动合并平台资源)"""
    target_tenant_id = service.resolve_target_tenant_id(scope)

    response_val = await service.get_doc_processor_config(target_tenant_id, scope)
    return ApiResponse.ok(data=DocProcessorResponse(**response_val), msg="获取成功")


@router.put(
    "/doc-processor",
    response_model=ApiResponse[DocProcessorResponse],
    operation_id="updateAdminDocProcessorConfig",
)
async def update_doc_processor_config(
    config_in: DocProcessorsUpdate,
    scope: Literal["platform", "tenant"] = "tenant",
    service: SystemConfigService = Depends(get_system_config_service),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[DocProcessorResponse]:
    """更新文档处理服务配置 (仅保存租户私有配置)"""
    target_tenant_id = service.resolve_target_tenant_id(scope)

    # 1. 更新并获取全量状态 (含合并后的平台资源)
    # 注意：service 层 update 后应当返回最新的全量列表，以配合前端更新
    await service.update_doc_processor_config(target_tenant_id, config_in)

    # 2. 重新加载最新全量配置 (含 origin 标记)
    response_val = await service.get_doc_processor_config(target_tenant_id, scope)

    return ApiResponse.ok(data=DocProcessorResponse(**response_val), msg="保存成功")


@router.post(
    "/doc-processor/test-connection",
    response_model=ApiResponse[dict],
    operation_id="testDocProcessorConnection",
)
async def test_doc_processor_connection(
    request: TestDocProcessorRequest,
    scope: Literal["platform", "tenant"] = "tenant",
    service: SystemConfigService = Depends(get_system_config_service),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[dict]:
    """
    测试文档处理服务连接性
    """
    target_tenant_id = service.resolve_target_tenant_id(scope)
    logger.info(
        "🧭 [SystemConfig] test_doc_processor_connection scope=%s target_tenant_id=%s",
        scope,
        target_tenant_id,
    )

    result = await service.test_doc_processor_connection(target_tenant_id, request.config)
    return ApiResponse.ok(data=result, msg="连接成功")
