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

"""
系统配置 API 端点
"""

import copy
from datetime import datetime
from typing import Any, Literal
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.infra.config import settings
from app.core.web.deps import get_current_user_with_tenant
from app.core.web.exceptions import NotFoundException
from app.core.infra.tenant import get_current_tenant, temporary_tenant_context
from app.crud.system_config import crud_system_config
from app.db.database import get_db
from app.models.user import User
from app.schemas.response import ApiResponse
from app.schemas.system_config import (
    AIConfigUpdate,
    DocProcessorsUpdate,
    SystemConfigResponse,
    TestConnectionRequest,
    TestDocProcessorRequest,
)

router = APIRouter()

# 配置键常量
AI_CONFIG_KEY = "ai_config"
DOC_PROCESSOR_CONFIG_KEY = "doc_processor_config"
SYSTEM_INTEGRITY_KEY = "system_integrity"

# 模型类型常量
MODEL_TYPES = ["chat", "embedding", "rerank", "vl"]



def _format_openai_error(e: Exception) -> str:
    """格式化 OpenAI 错误信息，使其更易读"""
    try:
        # 尝试解析 JSON 错误信息
        error_str = str(e)
        if "Error code:" in error_str:
            # 提取 Error code
            import re

            code_match = re.search(r"Error code: (\d+)", error_str)
            code = code_match.group(1) if code_match else "Unknown"

            # 尝试提取 message
            if "'message':" in error_str:
                msg_match = re.search(r"'message': '([^']*)'", error_str)
                msg = msg_match.group(1) if msg_match else "Unknown error"
                return f"请求失败 ({code}): {msg}"

        return f"请求失败: {error_str}"
    except:
        return f"发生未知错误: {str(e)}"


def _create_openai_client(api_key: str, base_url: str, timeout: float = 10.0):
    from openai import AsyncOpenAI

    return AsyncOpenAI(api_key=api_key, base_url=base_url, timeout=timeout)




@router.get(
    "/ai-config",
    response_model=ApiResponse[SystemConfigResponse | None],
    operation_id="getAdminAiConfig",
)
async def get_ai_config(
    scope: Literal["platform", "tenant"] = "tenant",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[SystemConfigResponse | None]:
    """
    获取 AI 模型配置
    """
    target_tenant_id = None if scope == "platform" else get_current_tenant()

    # 如果是租户级别，且不是平台管理员查看全局，需要检查是否允许使用平台资源
    platform_fallback_allowed = False
    if scope == "tenant" and target_tenant_id:
        from app.crud.tenant import crud_tenant

        tenant = await crud_tenant.get(db, id=target_tenant_id)
        if tenant and "models" in (tenant.platform_resources_allowed or []):
            platform_fallback_allowed = True

    # 1. 获取租户自身配置
    with temporary_tenant_context(target_tenant_id):
        config = await crud_system_config.get_by_key(
            db, config_key=AI_CONFIG_KEY, tenant_id=target_tenant_id
        )

    # 2. 如果允许且租户没配置或配置不全，获取平台配置作为补充 (仅作为参考值返回，不合并)
    platform_defaults = {}
    if platform_fallback_allowed:
        with temporary_tenant_context(None):
            platform_config = await crud_system_config.get_by_key(
                db, config_key=AI_CONFIG_KEY, tenant_id=None
            )
            if platform_config:
                platform_defaults = platform_config.config_value

    if not config and not platform_defaults:
        # 返回默认配置
        return ApiResponse.ok(data=None, msg="暂无配置，将返回默认值")

    # 构造返回数据
    tenant_config_value = config.config_value if config else {}

    config_response = (
        SystemConfigResponse.model_validate(config)
        if config
        else SystemConfigResponse(
            id=0,
            tenant_id=target_tenant_id,
            config_key=AI_CONFIG_KEY,
            config_value=tenant_config_value,
            is_active=True,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
    )

    # 显式设置 platform_defaults
    config_response.platform_defaults = platform_defaults
    # config_value 使用租户配置
    config_response.config_value = tenant_config_value

    return ApiResponse.ok(data=config_response, msg="获取成功")


@router.put(
    "/ai-config",
    response_model=ApiResponse[SystemConfigResponse],
    operation_id="updateAdminAiConfig",
)
async def update_ai_config(
    config_in: AIConfigUpdate,
    scope: Literal["platform", "tenant"] = "tenant",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[SystemConfigResponse]:
    """
    更新 AI 模型配置 (扁平结构)
    """
    config_value = config_in.model_dump(mode="json")
    target_tenant_id = None if scope == "platform" else get_current_tenant()

    with temporary_tenant_context(target_tenant_id):
        # 获取现有配置用于比对
        existing_config = await crud_system_config.get_by_key(
            db, config_key=AI_CONFIG_KEY, tenant_id=target_tenant_id
        )


    # 自动探测 Embedding Dimension
    embedding_conf = config_value.get("embedding", {})
    # 如果有配置，且 apiKey/baseUrl 存在
    if embedding_conf and embedding_conf.get("apiKey") and embedding_conf.get("baseUrl"):
        # 如果 dimension 为空 (None or 0)，尝试探测
        if not embedding_conf.get("dimension"):
            try:
                import logging

                logger = logging.getLogger(__name__)
                logger.info("🔍 Auto-detecting embedding dimension...")

                client = _create_openai_client(
                    api_key=embedding_conf["apiKey"], base_url=embedding_conf["baseUrl"]
                )
                resp = await client.embeddings.create(model=embedding_conf["model"], input="test")
                if resp.data:
                    dim = len(resp.data[0].embedding)
                    embedding_conf["dimension"] = dim
                    logger.info(f"✅ Detected dimension: {dim}")
            except Exception as e:
                # 探测失败不阻断保存，但记录错误
                import logging

                logging.getLogger(__name__).warning(f"⚠️ Failed to auto-detect dimension: {e}")

    with temporary_tenant_context(target_tenant_id):
        import logging

        logger = logging.getLogger(__name__)
        logger.info(f"💾 Saving AI Config to DB: {config_value}")

        config = await crud_system_config.update_by_key(
            db,
            config_key=AI_CONFIG_KEY,
            config_value=config_value,
            tenant_id=target_tenant_id,
        )

    # 强制清除配置缓存，确保所有的 Manager 都能读取到最新写入数据库的值
    try:
        from app.services.configuration_service import configuration_service

        configuration_service.clear_cache(tenant_id=target_tenant_id)
        logger.info(f"🧹 Cleared AI config cache for tenant: {target_tenant_id}")
    except Exception as e:
        logger.error(f"❌ Failed to clear config cache: {e}")

    # 触发 VectorStore 热更新
    try:
        from app.core.vector.vector_store import VectorStoreManager

        # 注意：get_instance() 内部会尝试初始化。
        # 如果当前配置有问题，可能会抛出异常。我们应该捕获它，但这不应阻断配置保存成功。
        manager = await VectorStoreManager.get_instance()
        await manager.reload_credentials()
    except Exception as e:
        import logging

        logging.getLogger(__name__).warning(
            f"⚠️ Vector store reload skipped or failed (safe to ignore if config is incomplete): {e}"
        )

    # 返回处理
    response_data = SystemConfigResponse.model_validate(config)
    
    return ApiResponse.ok(data=response_data, msg="AI 配置更新成功")


@router.delete("/{config_key}", response_model=ApiResponse[dict], operation_id="deleteAdminConfig")
async def delete_config(
    config_key: str,
    scope: Literal["platform", "tenant"] = "tenant",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[dict]:
    """
    删除指定配置
    """
    target_tenant_id = None if scope == "platform" else current_user.tenant_id

    with temporary_tenant_context(target_tenant_id):
        db_config = await crud_system_config.get_by_key(
            db, config_key=config_key, tenant_id=target_tenant_id
        )

    if not db_config:
        raise NotFoundException(detail=f"配置 {config_key} 不存在")

    await db.delete(db_config)
    await db.commit()

    return ApiResponse.ok(data={"deleted": True}, msg="配置删除成功")


@router.post(
    "/ai-config/test-connection",
    response_model=ApiResponse[dict],
    operation_id="testModelConnection",
)
async def test_model_connection(
    request: TestConnectionRequest,
    scope: Literal["platform", "tenant"] = "tenant",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[dict]:
    """
    测试模型连接性
    """
    model_type = request.model_type
    config = request.config
    target_tenant_id = None if scope == "platform" else get_current_tenant()

    target_tenant_id = None if scope == "platform" else get_current_tenant()

    # 1. 对话/多模态/视觉测试 (使用 OpenAI Chat API)
    if model_type in ["chat", "vl"]:
        try:
            client = _create_openai_client(api_key=config.apiKey, base_url=config.baseUrl)
            # 发送简单的 Hello 消息
            response = await client.chat.completions.create(
                model=config.model, messages=[{"role": "user", "content": "Hello"}], max_tokens=5
            )
            return ApiResponse.ok(
                data={"details": f"Response: {response.choices[0].message.content[:20]}..."},
                msg="连接成功",
            )
        except Exception as e:
            import logging

            logger = logging.getLogger(__name__)
            logger.error(f"❌ [TestConnection] Chat/VL failed: {e}", exc_info=True)
            return ApiResponse.error(msg=_format_openai_error(e))

    # 2. 向量测试 (使用 OpenAI Embedding API)
    elif model_type == "embedding":
        try:
            client = _create_openai_client(api_key=config.apiKey, base_url=config.baseUrl)
            # 发送简单的嵌入请求
            resp = await client.embeddings.create(model=config.model, input="test")
            dim = len(resp.data[0].embedding)
            return ApiResponse.ok(
                data={"dimension": dim}, msg=f"连接成功 (Detected Dimension: {dim})"
            )
        except Exception as e:
            import logging

            logger = logging.getLogger(__name__)
            logger.error(f"❌ [TestConnection] Embedding failed: {e}", exc_info=True)
            return ApiResponse.error(msg=_format_openai_error(e))

    # 3. 重排序测试 (使用 Standard/Cohere-like Rerank API)
    elif model_type == "rerank":
        try:
            import httpx

            # 构建 URL
            url = config.baseUrl.rstrip("/")
            if not url.endswith("/rerank"):
                url = f"{url}/rerank"

            payload = {
                "model": config.model,
                "query": "What is Deep Learning?",
                "documents": ["Deep Learning is ...", "Hello World"],
                "top_n": 1,
            }
            headers = {
                "Authorization": f"Bearer {config.apiKey}",
                "Content-Type": "application/json",
            }

            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload, headers=headers)

                # 兼容性处理
                if resp.status_code != 200:
                    return ApiResponse.error(
                        msg=f"请求失败 (Status {resp.status_code}): {resp.text[:100]}"
                    )

                # 检查返回格式
                data = resp.json()
                # ...

                return ApiResponse.ok(msg="连接成功")

        except Exception as e:
            import logging

            logger = logging.getLogger(__name__)
            logger.error(f"❌ [TestConnection] Rerank failed: {e}", exc_info=True)
            # 统一错误格式
            return ApiResponse.error(msg=f"请求失败: {str(e)}")

    return ApiResponse.error(msg="未知的模型类型")


# ============ 文档处理服务配置端点 ============




@router.get(
    "/doc-processor",
    response_model=ApiResponse[dict | None],
    operation_id="getAdminDocProcessorConfig",
)
async def get_doc_processor_config(
    scope: Literal["platform", "tenant"] = "tenant",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[dict | None]:
    """
    获取文档处理服务配置
    """
    target_tenant_id = None if scope == "platform" else get_current_tenant()

    # 如果是租户级别，检查是否允许使用平台资源
    platform_fallback_allowed = False
    if scope == "tenant" and target_tenant_id:
        from app.crud.tenant import crud_tenant

        tenant = await crud_tenant.get(db, id=target_tenant_id)
        if tenant and "doc_processors" in (tenant.platform_resources_allowed or []):
            platform_fallback_allowed = True

    # 1. 获取租户自身配置
    with temporary_tenant_context(target_tenant_id):
        config = await crud_system_config.get_by_key(
            db, config_key=DOC_PROCESSOR_CONFIG_KEY, tenant_id=target_tenant_id
        )

    # 2. 获取平台配置 (如果允许)
    platform_processors = []
    if platform_fallback_allowed:
        with temporary_tenant_context(None):
            platform_config = await crud_system_config.get_by_key(
                db, config_key=DOC_PROCESSOR_CONFIG_KEY, tenant_id=None
            )
            if platform_config:
                platform_processors = platform_config.config_value.get("processors", [])
                # 标记来源
                for p in platform_processors:
                    p["origin"] = "platform"

    tenant_processors = []
    if config:
        tenant_processors = config.config_value.get("processors", [])
        for p in tenant_processors:
            p["origin"] = "tenant"

    # 如果两边都没有，返回空
    if not tenant_processors and not platform_processors:
        return ApiResponse.ok(data={"processors": []}, msg="暂无配置")

    # 合并配置 (租户在前，平台在后)
    merged_processors = tenant_processors + platform_processors

    return ApiResponse.ok(data={"processors": merged_processors}, msg="获取成功")


@router.put(
    "/doc-processor", response_model=ApiResponse[dict], operation_id="updateAdminDocProcessorConfig"
)
async def update_doc_processor_config(
    config_in: DocProcessorsUpdate,
    scope: Literal["platform", "tenant"] = "tenant",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[dict]:
    """
    更新文档处理服务配置
    """
    config_value = config_in.model_dump(mode="json")
    target_tenant_id = None if scope == "platform" else get_current_tenant()

    # 过滤掉平台资源 (防止前端误传导致覆盖)
    if "processors" in config_value:
        config_value["processors"] = [
            p for p in config_value["processors"] if p.get("origin") != "platform"
        ]

    with temporary_tenant_context(target_tenant_id):
        config = await crud_system_config.update_by_key(
            db,
            config_key=DOC_PROCESSOR_CONFIG_KEY,
            config_value=config_value,
            tenant_id=target_tenant_id,
        )

    # 返回数据
    response_val = copy.deepcopy(config.config_value)

    return ApiResponse.ok(data=response_val, msg="文档处理服务配置更新成功")


@router.post(
    "/doc-processor/test-connection",
    response_model=ApiResponse[dict],
    operation_id="testDocProcessorConnection",
)
async def test_doc_processor_connection(
    request: TestDocProcessorRequest,
    scope: Literal["platform", "tenant"] = "tenant",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[dict]:
    """
    测试文档处理服务连接性
    """
    config = request.config
    target_tenant_id = None if scope == "platform" else get_current_tenant()

    try:
        from app.core.doc_processor import DocProcessorFactory

        # 使用工厂创建对应的处理器实例
        processor = DocProcessorFactory.create(config)

        # 执行健康检查
        is_healthy = await processor.check_health()

        if is_healthy:
            return ApiResponse.ok(data={"status": "healthy"}, msg="连接成功")
        else:
            return ApiResponse.error(msg="连接失败：无法连接到服务或服务异常")

    except ValueError as e:
        # 工厂抛出的不支持类型错误
        return ApiResponse.error(msg=str(e))
    except Exception as e:
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"❌ [TestDocProcessor] Failed: {e}", exc_info=True)
        return ApiResponse.error(msg=f"连接失败: {str(e)}")
