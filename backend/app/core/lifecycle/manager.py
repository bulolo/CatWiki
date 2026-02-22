# Copyright 2026 CatWiki Authors
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

import logging
from typing import Any

from app.core.ai.providers.llm_manager import llm_manager
from app.core.infra.rustfs import init_rustfs
from app.core.lifecycle.config import init_system_configs
from app.core.vector.vector_store import VectorStoreManager

logger = logging.getLogger(__name__)


class LifecycleManager:
    """核心组件生命周期管理器"""

    @classmethod
    async def startup(cls):
        """应用启动时的核心组件初始化"""
        logger.info("🚀 [Lifecycle] Starting core components...")

        # 1. 初始化系统配置 (环境变量同步到DB)
        await init_system_configs()

        # 2. 初始化 RustFS
        try:
            await init_rustfs()
            logger.info("✅ [Lifecycle] RustFS initialized.")
        except Exception as e:
            logger.warning(f"⚠️ [Lifecycle] RustFS initialization failed: {e}")

        # 3. 初始化核心管理器 (预热平台实例)
        # 注意：这里我们只初始化默认实例/平台实例
        try:
            await VectorStoreManager.get_instance()
            logger.info("✅ [Lifecycle] VectorStoreManager pre-warmed.")
        except Exception as e:
            logger.warning(f"⚠️ [Lifecycle] VectorStoreManager pre-warm failed: {e}")

        logger.info("✨ [Lifecycle] All core components started.")

    @classmethod
    async def shutdown(cls):
        """应用关闭时的核心组件卸载"""
        logger.info("🛑 [Lifecycle] Stopping core components...")

        # 1. 关闭 LLM 管理器
        await llm_manager.close()

        # 2. 关闭向量存储管理器
        vs_manager = await VectorStoreManager.get_instance()
        await vs_manager.close()

        logger.info("🏁 [Lifecycle] All core components stopped.")

    @classmethod
    async def check_health(cls) -> dict[str, Any]:
        """系统健康检查诊断"""
        from sqlalchemy import text

        from app.core.infra.rustfs import get_rustfs_service
        from app.db.database import engine

        results = {
            "database": "unknown",
            "vector_store": "unknown",
            "rustfs": "unknown",
            "llm": "unknown",
        }

        # 1. DB 检查
        try:
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            results["database"] = "healthy"
        except Exception as e:
            results["database"] = f"unhealthy: {str(e)}"

        # 2. Vector Store 检查
        try:
            vs_manager = await VectorStoreManager.get_instance()
            # 尝试获取一次 site_id=0 的实例 (平台实例)
            await vs_manager._ensure_initialized(tenant_id=None)
            results["vector_store"] = "healthy"
        except Exception as e:
            results["vector_store"] = f"unhealthy: {str(e)}"

        # 3. RustFS 检查
        try:
            rustfs = get_rustfs_service()
            rustfs.client.list_buckets()
            results["rustfs"] = "healthy"
        except Exception as e:
            results["rustfs"] = f"unhealthy: {str(e)}"

        # 4. LLM 检查 (仅检查连通性/配置加载)
        try:
            from app.core.ai.providers.llm_manager import llm_manager

            await llm_manager.get_model(tenant_id=None)
            results["llm"] = "healthy"
        except Exception as e:
            results["llm"] = f"unhealthy: {str(e)}"

        return results
