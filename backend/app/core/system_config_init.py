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
    规则：如果数据库中已存在 AI 配置，则跳过同步，以保护手动修改的配置。
    """
    async with AsyncSessionLocal() as db:
        # 1. 检查数据库中是否已存在 AI 配置
        existing_config = await crud_system_config.get_by_key(db, config_key=AI_CONFIG_KEY)
        if existing_config:
            logger.info("📡 [跳过] 数据库中已存在 AI 配置，不从环境变量覆盖。")
            return

        # 2. 从环境变量构建初始配置
        # 只有在提供了 API Key 的情况下才认为是有意义的配置
        ai_config = {
            "chat": {
                "provider": "openai",
                "model": settings.AI_CHAT_MODEL or "",
                "apiKey": settings.AI_CHAT_API_KEY or "",
                "baseUrl": settings.AI_CHAT_API_BASE or "",
            },
            "embedding": {
                "provider": "openai",
                "model": settings.AI_EMBEDDING_MODEL or "",
                "apiKey": settings.AI_EMBEDDING_API_KEY or "",
                "baseUrl": settings.AI_EMBEDDING_API_BASE or "",
                "dimension": settings.AI_EMBEDDING_DIMENSION,
            },
            "rerank": {
                "provider": "openai",
                "model": settings.AI_RERANK_MODEL or "",
                "apiKey": settings.AI_RERANK_API_KEY or "",
                "baseUrl": settings.AI_RERANK_API_BASE or "",
            },
            "vl": {
                "provider": "openai",
                "model": settings.AI_VL_MODEL or "",
                "apiKey": settings.AI_VL_API_KEY or "",
                "baseUrl": settings.AI_VL_API_BASE or "",
            }
        }

        # 检查是否至少配置了一个关键变量（如 Chat API Key）
        if not any([
            settings.AI_CHAT_API_KEY,
            settings.AI_EMBEDDING_API_KEY,
            settings.AI_RERANK_API_KEY,
            settings.AI_VL_API_KEY
        ]):
            logger.info("📡 [跳过] 未检测到 AI 相关的环境变量配置。")
            return

        # 3. 写入数据库
        try:
            await crud_system_config.update_by_key(
                db,
                config_key=AI_CONFIG_KEY,
                config_value=ai_config
            )
            logger.info("📡 [同步] 已成功将环境变量中的 AI 配置加载到数据库。")
        except Exception as e:
            logger.error(f"❌ [同步失败] 无法将 AI 配置同步到数据库: {e}")

