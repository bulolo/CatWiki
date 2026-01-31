from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.api.admin.endpoints.system_config import AI_CONFIG_KEY
from app.crud.system_config import crud_system_config
import logging

logger = logging.getLogger(__name__)

async def get_dynamic_chat_config(db: AsyncSession) -> dict:
    """
    获取动态 Chat 模组配置
    优先从数据库读取，如果未配置则回退到环境变量
    """
    config = await crud_system_config.get_by_key(db, config_key=AI_CONFIG_KEY)
    
    # 默认回退值 (若数据库无配置)
    result = {
        "provider": "openai",
        "model": "",
        "apiKey": "",
        "baseUrl": ""
    }

    if not config:
        return result

    config_value = config.config_value
    # 由于系统已重构为纯 OpenAI 兼容模式
    # 先尝试直接读取扁平结构的 chat
    chat_conf = config_value.get("chat", {})
    
    # 兼容旧结构: 如果扁平结构为空且存在 manualConfig
    if not chat_conf and "manualConfig" in config_value:
        chat_conf = config_value.get("manualConfig", {}).get("chat", {})

    if chat_conf.get("apiKey") and chat_conf.get("baseUrl"):
        result["provider"] = chat_conf.get("provider", "openai")
        result["model"] = chat_conf.get("model", result["model"])
        result["apiKey"] = chat_conf.get("apiKey")
        result["baseUrl"] = chat_conf.get("baseUrl")

    return result
