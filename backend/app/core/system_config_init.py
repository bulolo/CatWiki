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
    (已废弃：配置现已由数据库 fully managed)
    """
    # logger.info("📡 [已跳过] AI 配置目前完全由数据库管理，不再从环境变量同步。")
    pass

