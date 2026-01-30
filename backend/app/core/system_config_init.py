import logging
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.crud.system_config import crud_system_config
from app.db.database import AsyncSessionLocal
from app.api.admin.endpoints.system_config import AI_CONFIG_KEY

logger = logging.getLogger(__name__)

async def sync_ai_config_to_db():
    """
    将 .env 中的 AI 配置同步到数据库。
    逻辑：补全 manualConfig 中缺失的模型配置。
    """
    logger.info("📡 开始检查 AI 配置同步状态...")
    
    # 检查环境变量中是否有起码的配置
    if not settings.AI_CHAT_API_KEY and not settings.AI_EMBEDDING_API_KEY:
        logger.info("ℹ️ 环境变量中未检测到有效的 AI 配置，跳过同步。")
        return

    async with AsyncSessionLocal() as db:
        try:
            # 获取现有配置
            db_config = await crud_system_config.get_by_key(db, config_key=AI_CONFIG_KEY)
            config_value = db_config.config_value if db_config else {}
            
            updated = False

            # 1. 确保基础结构存在
            if "mode" not in config_value:
                config_value["mode"] = "manual"
                updated = True
            
            if "manualConfig" not in config_value:
                config_value["manualConfig"] = {}
                updated = True

            # 2. 补全缺失的手动模型配置 (Only sync manualConfig)
            models_to_sync = [
                ("chat", settings.AI_CHAT_MODEL, settings.AI_CHAT_API_KEY, settings.AI_CHAT_API_BASE),
                ("embedding", settings.AI_EMBEDDING_MODEL, settings.AI_EMBEDDING_API_KEY, settings.AI_EMBEDDING_API_BASE),
                ("rerank", settings.AI_RERANK_MODEL, settings.AI_RERANK_API_KEY, settings.AI_RERANK_API_BASE),
                ("vl", settings.AI_VL_MODEL, settings.AI_VL_API_KEY, settings.AI_VL_API_BASE),
            ]

            for key, model, api_key, base_url in models_to_sync:
                # 仅补全 manualConfig
                if key not in config_value["manualConfig"]:
                    config_value["manualConfig"][key] = {
                        "provider": "openai",
                        "model": model,
                        "apiKey": api_key,
                        "baseUrl": base_url
                    }
                    updated = True

            # 3. 如果有更新，则回写数据库
            if updated:
                logger.info(f"🔄 正在补全/初始化数据库中的 AI 配置 (Key: {AI_CONFIG_KEY})...")
                await crud_system_config.update_by_key(
                    db, 
                    config_key=AI_CONFIG_KEY, 
                    config_value=config_value
                )
                logger.info("✅ AI 配置同步成功！")
            else:
                logger.info("ℹ️ 数据库 AI 配置已是最新，无需同步。")
            
        except Exception as e:
            logger.error(f"❌ 同步 AI 配置到数据库失败: {e}")
            # 不抛出异常，以免导致整个系统无法启动
