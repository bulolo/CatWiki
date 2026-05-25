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

import asyncio
import logging
from typing import Any

from app.core.ai.providers.chat import chat_provider
from app.core.infra.rustfs import init_rustfs
from app.core.integration.robot.services.dingtalk_app import DingTalkRobotService
from app.core.integration.robot.services.feishu_app import FeishuRobotService
from app.core.integration.robot.services.telegram_app import TelegramRobotService
from app.core.integration.robot.services.wecom_smart import WeComSmartService
from app.core.integration.robot.wecom_internals import (
    register_resolvers as register_wecom_resolvers,
)
from app.core.lifecycle.config import init_system_configs
from app.core.vector import VectorStoreManager
from app.core.vector.factory import close_vector_store
from app.services.task_service import TaskService

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

        # 3. 初始化 Checkpointer 数据库表（仅启动时创建一次）
        try:
            from app.core.ai.graph.checkpointer import setup_checkpointer_tables

            await setup_checkpointer_tables()
        except Exception as e:
            logger.warning(f"⚠️ [Lifecycle] Checkpointer table setup failed: {e}")

        # 4. 初始化核心管理器
        # VectorStore 现在采用懒加载策略，首次检索时自动初始化
        pass

        # 5. 注册企业微信 context resolver（受 ROBOT_PLUGIN_ALLOWLIST 控制）
        register_wecom_resolvers()

        # 6. 启动集成服务
        try:
            await FeishuRobotService.get_instance().startup(asyncio.get_running_loop())
        except Exception as e:
            logger.warning(f"⚠️ [Lifecycle] Feishu startup failed: {e}")

        try:
            await DingTalkRobotService.get_instance().startup(asyncio.get_running_loop())
        except Exception as e:
            logger.warning(f"⚠️ [Lifecycle] DingTalk Stream startup failed: {e}")

        try:
            await WeComSmartService.get_instance().startup(asyncio.get_running_loop())
        except Exception as e:
            logger.warning(f"⚠️ [Lifecycle] WeCom Smart LongConn startup failed: {e}")

        try:
            await TelegramRobotService.get_instance().startup(asyncio.get_running_loop())
        except Exception as e:
            logger.warning(f"⚠️ [Lifecycle] Telegram LongPoll startup failed: {e}")

        logger.info("✨ [Lifecycle] All core components started.")

    @classmethod
    async def shutdown(cls):
        """应用关闭时的核心组件卸载"""
        logger.info("🛑 [Lifecycle] Stopping core components...")

        # 1. 关闭 Chat Provider
        await chat_provider.aclose()

        # 1.5 关闭 Reranker 常驻 HTTP 客户端
        try:
            from app.core.ai.providers.reranker import reranker

            await reranker.aclose()
        except Exception as e:
            logger.warning(f"⚠️ [Lifecycle] Reranker aclose failed: {e}")

        # 2. 关闭向量存储管理器
        await close_vector_store()

        # 3. 关闭 Checkpointer 连接池
        try:
            from app.core.ai.graph.checkpointer import close_checkpointer_pool

            await close_checkpointer_pool()
        except Exception as e:
            logger.warning(f"⚠️ [Lifecycle] Checkpointer pool close failed: {e}")

        # 4. 关闭集成服务
        try:
            await FeishuRobotService.get_instance().shutdown()
        except Exception as e:
            logger.warning(f"⚠️ [Lifecycle] Feishu shutdown failed: {e}")

        try:
            await DingTalkRobotService.get_instance().shutdown()
        except Exception as e:
            logger.warning(f"⚠️ [Lifecycle] DingTalk shutdown failed: {e}")

        try:
            await WeComSmartService.get_instance().shutdown()
        except Exception as e:
            logger.warning(f"⚠️ [Lifecycle] WeCom Smart LongConn shutdown failed: {e}")

        try:
            await TelegramRobotService.get_instance().shutdown()
        except Exception as e:
            logger.warning(f"⚠️ [Lifecycle] Telegram LongPoll shutdown failed: {e}")

        # 4.5 所有 robot service 关闭完毕后，统一释放 adapter / client 资源
        try:
            from app.core.integration.robot.factory import RobotFactory

            await RobotFactory.shutdown()
        except Exception as e:
            logger.warning(f"⚠️ [Lifecycle] RobotFactory shutdown failed: {e}")

        # 4.6 关闭企业微信共享 HTTP 客户端（send/sync + gettoken）
        try:
            from app.core.integration.robot.clients.wecom import WeComClient

            await WeComClient.aclose()
        except Exception as e:
            logger.warning(f"⚠️ [Lifecycle] WeComClient aclose failed: {e}")

        # 5. 关闭缓存服务
        try:
            from app.core.infra.cache import _cache_instance

            if _cache_instance:
                await _cache_instance.close()
                logger.info("✅ [Lifecycle] Cache service closed.")
        except Exception as e:
            logger.warning(f"⚠️ [Lifecycle] Cache close failed: {e}")

        # 6. 关闭任务服务池
        await TaskService.close()

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
            "cache": "unknown",
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

        # 2. Vector Store 检查（配置校验 + 实际连通性探测）
        try:
            vs_manager = await VectorStoreManager.get_instance()
            await vs_manager.validate_config(tenant_id=None)
            is_alive = await vs_manager.ping()
            results["vector_store"] = "healthy" if is_alive else "unhealthy: backend unreachable"
        except Exception as e:
            results["vector_store"] = f"unhealthy: {str(e)}"

        # 3. Cache 检查
        try:
            from app.core.infra.cache import get_cache

            cache = get_cache()
            results["cache"] = cache.stats()
        except Exception as e:
            results["cache"] = f"unhealthy: {str(e)}"

        # 4. RustFS 检查
        try:
            rustfs = get_rustfs_service()
            rustfs.client.list_buckets()
            results["rustfs"] = "healthy"
        except Exception as e:
            results["rustfs"] = f"unhealthy: {str(e)}"

        # 5. LLM 检查 (仅检查连通性/配置加载)
        try:
            from app.core.ai.providers.chat import chat_provider

            await chat_provider.get_model(tenant_id=None, purpose="健康检查：模型连通性测试")
            results["llm"] = "healthy"
        except Exception as e:
            results["llm"] = f"unhealthy: {str(e)}"

        return results
