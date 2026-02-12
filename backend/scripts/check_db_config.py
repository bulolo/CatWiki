import asyncio
import json
import os
import sys

# 将项目根目录加入 sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import AsyncSessionLocal
from app.crud.system_config import crud_system_config
from app.crud.tenant import crud_tenant

async def check_configs():
    print("--- [AI Config Database Check] ---")
    async with AsyncSessionLocal() as db:
        # 1. 检查平台配置
        platform_config = await crud_system_config.get_by_key(db, config_key="ai_config", tenant_id=None)
        if platform_config:
            print("\n[Platform Config (Global)]")
            print(json.dumps(platform_config.config_value, indent=4, ensure_ascii=False))
        else:
            print("\n[Platform Config] Not found!")

        # 2. 检查租户 2 配置与权限
        tenant = await crud_tenant.get(db, id=2)
        if tenant:
            print(f"\n[Tenant 2 Info]")
            print(f"Name: {tenant.name}, Slug: {tenant.slug}")
            print(f"Allowed Platform Resources: {tenant.platform_resources_allowed}")
            
            tenant2_config = await crud_system_config.get_by_key(db, config_key="ai_config", tenant_id=2)
            if tenant2_config:
                print("\n[Tenant 2 AI Config]")
                print(json.dumps(tenant2_config.config_value, indent=4, ensure_ascii=False))
            else:
                print("\n[Tenant 2 AI Config] Not found at all!")
        else:
            print("\n[Tenant 2] Not found!")

if __name__ == "__main__":
    asyncio.run(check_configs())
