"""
系统配置 API 端点
"""
import copy
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user
from app.core.exceptions import NotFoundException
from app.crud.system_config import crud_system_config
from app.db.database import get_db
from app.models.user import User
from app.schemas.response import ApiResponse
from app.schemas.system_config import (
    AIConfigUpdate,
    BotConfigUpdate,
    SystemConfigResponse,
    TestConnectionRequest,
)

router = APIRouter()

# 配置键常量
AI_CONFIG_KEY = "ai_config"
BOT_CONFIG_KEY = "bot_config"

# 掩码常量
MASKED_API_KEY = "********"



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


def mask_variable(value: str) -> str:
    """如果值存在且不为空，则返回掩码，否则返回原值"""
    if value and len(value) > 0:
        return MASKED_API_KEY
    return value



def _mask_ai_config_inplace(config_value: dict) -> None:
    """对 AI 配置进行原地脱敏处理"""
    for model_type in ["chat", "embedding", "rerank", "vl"]:
        if model_type in config_value and "apiKey" in config_value[model_type]:
            config_value[model_type]["apiKey"] = mask_variable(config_value[model_type]["apiKey"])


def _normalize_ai_config_value(value: dict) -> dict:
    """
    将可能的旧配置结构 (nested mode/manualConfig) 转换为扁平结构
    """
    if "manualConfig" in value:
        # 旧结构，提取 manualConfig
        manual = value.get("manualConfig", {})
        return {
            "chat": manual.get("chat", {}),
            "embedding": manual.get("embedding", {}),
            "rerank": manual.get("rerank", {}),
            "vl": manual.get("vl", {})
        }
    # 假设已经是新结构，或者缺失某些字段
    # 确保基本的 keys存在
    normalized = {}
    for key in ["chat", "embedding", "rerank", "vl"]:
        normalized[key] = value.get(key, {})
    return normalized


@router.get("/ai-config", response_model=ApiResponse[SystemConfigResponse | None], operation_id="getAdminAiConfig")
async def get_ai_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[SystemConfigResponse | None]:
    """
    获取 AI 模型配置
    """
    config = await crud_system_config.get_by_key(db, config_key=AI_CONFIG_KEY)

    if not config:
        # 返回默认配置
        return ApiResponse.ok(data=None, msg="暂无配置，将返回默认值")

    # 脱敏处理
    config_response = SystemConfigResponse.model_validate(config)
    
    # 确保返回给前端的是扁平结构 (即使数据库存的是旧的)
    normalized_value = _normalize_ai_config_value(config_response.config_value)
    
    # 脱敏
    masked_value = copy.deepcopy(normalized_value)
    _mask_ai_config_inplace(masked_value)

    config_response.config_value = masked_value
    return ApiResponse.ok(data=config_response, msg="获取成功")


@router.put("/ai-config", response_model=ApiResponse[SystemConfigResponse], operation_id="updateAdminAiConfig")
async def update_ai_config(
    config_in: AIConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[SystemConfigResponse]:
    """
    更新 AI 模型配置 (扁平结构)
    """
    config_value = config_in.model_dump(mode='json')

    # 获取现有配置用于比对
    existing_config = await crud_system_config.get_by_key(db, config_key=AI_CONFIG_KEY)
    
    if existing_config:
        # 获取现有的真实值(未脱敏)，并标准化为扁平结构，以便轻松对比
        existing_value = _normalize_ai_config_value(existing_config.config_value)
        
        # 还原手动模式配置的 API Key
        for model_type in ["chat", "embedding", "rerank", "vl"]:
            if (
                model_type in config_value
                and "apiKey" in config_value[model_type]
                and config_value[model_type]["apiKey"] == MASKED_API_KEY
                and model_type in existing_value
                and "apiKey" in existing_value[model_type]
            ):
                config_value[model_type]["apiKey"] = existing_value[model_type]["apiKey"]

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
                
                from openai import AsyncOpenAI
                client = AsyncOpenAI(
                    api_key=embedding_conf["apiKey"],
                    base_url=embedding_conf["baseUrl"],
                    timeout=10.0
                )
                resp = await client.embeddings.create(
                    model=embedding_conf["model"],
                    input="test"
                )
                if resp.data:
                    dim = len(resp.data[0].embedding)
                    embedding_conf["dimension"] = dim
                    logger.info(f"✅ Detected dimension: {dim}")
            except Exception as e:
                # 探测失败不阻断保存，但记录错误
                import logging
                logging.getLogger(__name__).warning(f"⚠️ Failed to auto-detect dimension: {e}")

    config = await crud_system_config.update_by_key(
        db,
        config_key=AI_CONFIG_KEY,
        config_value=config_value
    )
    
    # 触发 VectorStore 热更新
    try:
        from app.core.vector_store import VectorStoreManager
        manager = await VectorStoreManager.get_instance()
        await manager.reload_credentials(config_value)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"❌ Failed to trigger vector store reload: {e}")

    # 返回处理
    response_data = SystemConfigResponse.model_validate(config)
    # 此时 config_value 已经是新的扁平结构 (因为我们存的就是 config_value)
    # 对返回数据进行脱敏
    response_val = copy.deepcopy(response_data.config_value)
    _mask_ai_config_inplace(response_val)
    response_data.config_value = response_val

    return ApiResponse.ok(data=response_data, msg="AI 配置更新成功")


@router.get("/bot-config", response_model=ApiResponse[SystemConfigResponse | None], operation_id="getAdminBotConfig")
async def get_bot_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[SystemConfigResponse | None]:
    """
    获取机器人配置

    返回当前的机器人配置，包括网页挂件、API 接口和微信公众号设置
    """
    config = await crud_system_config.get_by_key(db, config_key=BOT_CONFIG_KEY)

    if not config:
        # 返回默认配置
        return ApiResponse.ok(data=None, msg="暂无配置，将返回默认值")

    return ApiResponse.ok(data=config, msg="获取成功")


@router.put("/bot-config", response_model=ApiResponse[SystemConfigResponse], operation_id="updateAdminBotConfig")
async def update_bot_config(
    config_in: BotConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[SystemConfigResponse]:
    """
    更新机器人配置

    - **webWidget**: 网页挂件配置
    - **apiBot**: API 机器人配置
    - **wechat**: 微信公众号配置
    """
    config_value = config_in.model_dump(mode='json')

    config = await crud_system_config.update_by_key(
        db,
        config_key=BOT_CONFIG_KEY,
        config_value=config_value
    )

    return ApiResponse.ok(data=config, msg="机器人配置更新成功")


@router.get("", response_model=ApiResponse[dict], operation_id="listAdminConfigs")
async def get_all_configs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[dict]:
    """
    获取所有配置（便捷接口）

    一次性获取所有系统配置
    """
    ai_config = await crud_system_config.get_by_key(db, config_key=AI_CONFIG_KEY)
    bot_config = await crud_system_config.get_by_key(db, config_key=BOT_CONFIG_KEY)

    # 脱敏 AI 配置
    ai_config_value = None
    if ai_config:
        ai_config_value = copy.deepcopy(ai_config.config_value)
        _mask_ai_config_inplace(ai_config_value)

    return ApiResponse.ok(
        data={
            "aiConfig": ai_config_value if ai_config else None,
            "botConfig": bot_config.config_value if bot_config else None,
        },
        msg="获取成功"
    )


@router.delete("/{config_key}", response_model=ApiResponse[dict], operation_id="deleteAdminConfig")
async def delete_config(
    config_key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[dict]:
    """
    删除指定配置

    - **config_key**: 配置键（如 'ai_config' 或 'bot_config'）
    """
    success = await crud_system_config.delete_by_key(db, config_key=config_key)

    if not success:
        raise NotFoundException(detail=f"配置 {config_key} 不存在")

    return ApiResponse.ok(data={"deleted": True}, msg="配置删除成功")


@router.post("/test-connection", response_model=ApiResponse[dict], operation_id="testModelConnection")
async def test_model_connection(
    request: TestConnectionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[dict]:
    """
    测试模型连接性
    """
    model_type = request.model_type
    config = request.config
    
    # 0. 如果 API Key 是掩码，则从数据库读取真实 Key
    if config.apiKey == MASKED_API_KEY:
        existing_config = await crud_system_config.get_by_key(db, config_key=AI_CONFIG_KEY)
        if existing_config:
            # 提取真实值
            existing_value = _normalize_ai_config_value(existing_config.config_value)
            real_key = existing_value.get(model_type, {}).get("apiKey", "")
            if real_key:
                config.apiKey = real_key
            else:
                 return ApiResponse.error(msg="无法获取有效的 API Key，请检查配置。")
        else:
            return ApiResponse.error(msg="未找到现有配置，请先填写有效 API Key。")
            
    if not config.apiKey:
         return ApiResponse.error(msg="API Key 不能为空")

    # 1. 对话/多模态/视觉测试 (使用 OpenAI Chat API)
    if model_type in ["chat", "vl"]:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(
                api_key=config.apiKey,
                base_url=config.baseUrl,
                timeout=10.0
            )
            # 发送简单的 Hello 消息
            response = await client.chat.completions.create(
                model=config.model,
                messages=[{"role": "user", "content": "Hello"}],
                max_tokens=5
            )
            return ApiResponse.ok(
                data={
                    "details": f"Response: {response.choices[0].message.content[:20]}..."
                }, 
                msg="连接成功"
            )
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"❌ [TestConnection] Chat/VL failed: {e}", exc_info=True)
            return ApiResponse.error(msg=_format_openai_error(e))

    # 2. 向量测试 (使用 OpenAI Embedding API)
    elif model_type == "embedding":
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(
                api_key=config.apiKey,
                base_url=config.baseUrl,
                timeout=10.0
            )
            # 发送简单的嵌入请求
            resp = await client.embeddings.create(
                model=config.model,
                input="test"
            )
            dim = len(resp.data[0].embedding)
            return ApiResponse.ok(
                data={"dimension": dim},
                msg=f"连接成功 (Detected Dimension: {dim})"
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
                "top_n": 1
            }
            headers = {
                "Authorization": f"Bearer {config.apiKey}",
                "Content-Type": "application/json"
            }
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                
                # 兼容性处理
                if resp.status_code != 200:
                    return ApiResponse.error(msg=f"请求失败 (Status {resp.status_code}): {resp.text[:100]}")
                
                # 检查返回格式
                data = resp.json()
                # ...

                return ApiResponse.ok(msg="连接成功")

        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"❌ [TestConnection] Rerank failed: {e}", exc_info=True)
            return ApiResponse.error(msg=f"连接失败: {str(e)}")

    return ApiResponse.error(msg="未知的模型类型")
