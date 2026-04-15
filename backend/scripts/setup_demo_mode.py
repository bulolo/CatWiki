import asyncio
import logging
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.infra.config import (
    AI_CHAT_CONFIG_KEY,
    AI_EMBEDDING_CONFIG_KEY,
    AI_RERANK_CONFIG_KEY,
    AI_VL_CONFIG_KEY,
)
from app.crud.system_config import crud_system_config
from app.crud.tenant import crud_tenant
from app.db.database import AsyncSessionLocal

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


async def setup_demo_mode():
    """
    Standalone script to initialize Demo Mode for Tenant 1.
    Sets plan to 'demo', authorizes 'models' and 'doc_processors',
    and forces AI configurations to 'platform' mode.
    """
    logger.info("🛠️ Starting Demo Mode setup for Tenant 1...")

    async with AsyncSessionLocal() as db:
        try:
            # 1. Update Tenant 1 Permissions
            tenant = await crud_tenant.get(db, id=1)
            if tenant:
                try:
                    from app.ee.schemas.tenant_ee import TenantEEUpdate
                    from app.ee.services.tenant_service import tenant_service

                    update_data = {
                        "plan": "demo",
                        "platform_resources_allowed": ["models", "doc_processors"],
                    }
                    await tenant_service.update_tenant(
                        db, tenant_id=1, tenant_in=TenantEEUpdate(**update_data)
                    )
                    logger.info("✅ Tenant 1 plan set to 'demo' and granted platform resources.")
                except ImportError:
                    logger.info(
                        "ℹ️ CE edition does not have 'plan' or platform resources constraints. Skipping EE update."
                    )
            else:
                logger.error("❌ Tenant 1 not found in database!")
                return

            # 2. Force Tenant 1 AI Config to Platform Mode
            ai_keys = {
                "chat": AI_CHAT_CONFIG_KEY,
                "embedding": AI_EMBEDDING_CONFIG_KEY,
                "rerank": AI_RERANK_CONFIG_KEY,
                "vl": AI_VL_CONFIG_KEY,
            }

            for section, key in ai_keys.items():
                config = await crud_system_config.get_by_key(db, config_key=key, tenant_id=1)
                if config:
                    config_val = config.config_value
                    if config_val.get("mode") != "platform":
                        config_val["mode"] = "platform"
                        await crud_system_config.update_by_key(
                            db, config_key=key, config_value=config_val, tenant_id=1
                        )
                        logger.info(
                            f"✅ Tenant 1 AI section '{section}' forced to 'platform' mode."
                        )
                else:
                    logger.warning(f"⚠️ No existing configuration found for key: {key}")

            await db.commit()
            logger.info("🎉 Demo Mode setup completed successfully!")

        except Exception as e:
            logger.error(f"❌ Failed to setup Demo Mode: {e}", exc_info=True)
            await db.rollback()


if __name__ == "__main__":
    asyncio.run(setup_demo_mode())
