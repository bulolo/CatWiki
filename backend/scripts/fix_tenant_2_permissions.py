
# 修复 Tenant 2 无法使用平台模型的问题
#
# 1. 将 Tenant 2 (baby-care) 的 platform_resources_allowed 更新为 ["models", "doc_processors"]
# 2. 将 Tenant 2 AI 配置的模式重置为 'platform'
# 3. 清除 AI 配置缓存

import asyncio
from app.db.database import AsyncSessionLocal
from app.crud.tenant import crud_tenant
from app.crud.system_config import crud_system_config
from app.core.ai.dynamic_config_manager import dynamic_config_manager
from sqlalchemy import text

async def fix_tenant_2():
    async with AsyncSessionLocal() as db:
        # 1. 获取 Tenant 2
        tenant = await crud_tenant.get_by_slug(db, slug="baby-care")
        if not tenant:
            print("❌ Tenant 'baby-care' (ID 2) not found!")
            return

        tenant_id = tenant.id
        print(f"🔄 Fixing Tenant: {tenant_id} ({tenant.slug})")

        # 2. 更新权限
        tenant.platform_resources_allowed = ["models", "doc_processors"]
        db.add(tenant)
        await db.commit()
        await db.refresh(tenant)
        print(f"✅ Updated platform_resources_allowed: {tenant.platform_resources_allowed}")

        # 3. 重置 AI 配置为 Platform
        config_key = "ai_config"
        model_config = {
            "chat": {
                "provider": "openai",
                "model": "",
                "apiKey": "",
                "baseUrl": "",
                "dimension": None,
                "mode": "platform",
            },
            "embedding": {
                "provider": "openai",
                "model": "",
                "apiKey": "",
                "baseUrl": "",
                "dimension": None,
                "mode": "platform",
            },
            "rerank": {
                "provider": "openai",
                "model": "",
                "apiKey": "",
                "baseUrl": "",
                "dimension": None,
                "mode": "platform",
            },
            "vl": {
                "provider": "openai",
                "model": "",
                "apiKey": "",
                "baseUrl": "",
                "dimension": None,
                "mode": "platform",
            },
        }

        await crud_system_config.update_by_key(
            db, config_key=config_key, config_value=model_config, tenant_id=tenant_id
        )
        print(f"✅ Reset AI Config to Mode: Platform")

        # 4. 清除缓存
        dynamic_config_manager.clear_cache(tenant_id=tenant_id)
        print(f"✅ Cleared AI Config Cache for Tenant {tenant_id}")

        # 5. 验证是否生效 (可选，仅通过 resolve 检查)
        try:
            # 重新初始化 context 以模拟 resolve
            # 但这里是脚本环境，直接调用 resolve_config 即可
            # 注意：resolve_config 内部会 check tenant permissions via DB fresh read?
            # clear_cache 已经做了，所以 get_embedding_config 会重新读 DB
            # 但是 resolve_config 需要 current_tenant context 吗？
            # 是的，所以我们手动传 tenant_id
            
            emb_conf = await dynamic_config_manager.get_embedding_config(tenant_id=tenant_id)
            print(f"🔍 Verified Resolved Config Mode: {emb_conf.get('_mode')} (Source: {emb_conf.get('_source')})")
            
            if emb_conf.get("_mode") == "platform":
                print("🎉 SUCCESS! Tenant 2 is now using Platform Embedding Config.")
            else:
                print("❌ FAILED! Still resolved to Custom?")
        except Exception as e:
            print(f"❌ Verification Failed: {e}")

if __name__ == "__main__":
    asyncio.run(fix_tenant_2())
