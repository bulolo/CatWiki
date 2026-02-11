import asyncio
from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.models.system_config import SystemConfig

async def inspect():
    async with AsyncSessionLocal() as db:
        stmt = select(SystemConfig).where(SystemConfig.config_key == "ai_config")
        result = await db.execute(stmt)
        configs = result.scalars().all()
        
        print(f"Found {len(configs)} ai_config records.")
        for conf in configs:
            print(f"ID: {conf.id}, Tenant: {conf.tenant_id}, Active: {conf.is_active}")
            print(f"Created: {conf.created_at}, Updated: {conf.updated_at}")
            print(f"Value: {conf.config_value}")
            print("-" * 50)

if __name__ == "__main__":
    asyncio.run(inspect())
