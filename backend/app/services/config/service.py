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

"""全局配置服务 (Configuration Service)

负责管理系统级与租户级的动态配置。
现已接入系统统一缓存层，支持多机环境下的配置同步。
"""

import logging
from typing import Any, Optional

from app.core.infra.cache import get_cache

logger = logging.getLogger(__name__)


class ConfigurationService:
    """配置服务 (单例模式)

    职责：
    1. 配置获取：作为业务层访问 AI 模型、系统组件配置的统一入口。
    2. 多级路由：根据 mode 分支，定向到租户或平台配置。
    3. 集群缓存：利用系统 BaseCache 实现配置缓存，支持 Redis 下的单点更新、全网生效。
    """

    _instance: Optional["ConfigurationService"] = None

    def __init__(self, cache_ttl: int = 60):
        self._cache_ttl = cache_ttl

    @classmethod
    def get_instance(cls) -> "ConfigurationService":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _get_cache_key(self, section: str, tenant_id: int | None) -> str:
        """生成配置专用的缓存键"""
        target = f"tenant:{tenant_id}" if tenant_id else "platform"
        return f"config:{section}:{target}"

    def _log_resolved_config(self, section: str, target: str, config: dict[str, Any]):
        """缓存填充日志（DEBUG 级别）。

        说明：触发条件是"外层 60s 缓存过期，重新跑 fetcher"。配置 hash 一般不变，
        所以默认 DEBUG + 单行 + 不打 JSON。真要看完整快照走 log_ai_stack。
        """
        logger.debug(
            f"🔍 [Config Refill] {section} | {target} | hash={config.get('_hash', 'N/A')[:12]}"
        )

    async def clear_cache(self, tenant_id: int | None = -1):
        """
        清空配置缓存。
        调用此方法后，系统缓存（内存或 Redis）中相关的配置项将被移除。
        同时清空 ConfigResolver 的进程级 TTL 缓存，确保管理端改配置后立即生效。
        """
        from app.core.infra.config_resolver import ConfigResolver

        cache = get_cache()
        sections = ["chat", "embedding", "rerank"]

        if tenant_id == -1:
            await cache.clear()
            ConfigResolver.invalidate()
            logger.info("🧹 已清空系统全部缓存（含配置）")
        else:
            for sec in sections:
                key = self._get_cache_key(sec, tenant_id)
                await cache.delete(key)
            ConfigResolver.invalidate(tenant_id=tenant_id)
            logger.info(f"🧹 已清除租户 {tenant_id} 的模型配置缓存")

    async def _resolve_config(
        self, section: str, tenant_id: int | None = None, force: bool = False
    ) -> dict[str, Any]:
        """统一配置解析逻辑 (接入 BaseCache)"""
        from app.core.infra.config_resolver import ConfigResolver

        cache = get_cache()
        cache_key = self._get_cache_key(section, tenant_id)

        if force:
            await cache.delete(cache_key)

        async def _fetcher():
            # 实际搬砖逻辑：force 透传到 ConfigResolver，
            # 否则其进程级缓存可能屏蔽掉本次刷新意图
            config = await ConfigResolver.resolve_section(section, tenant_id=tenant_id, force=force)
            # 把"配置可用性校验"作为 get_*_config 的契约：坏配置抛 BadRequestException
            # 而不会被缓存（fetcher 抛异常时 cache 不写入），调用方拿到的一定是已校验的配置
            ConfigResolver.validate_config(section, config)
            target_display = f"Tenant {tenant_id}" if tenant_id else "Platform"
            self._log_resolved_config(section, target_display, config)
            return config

        # 使用 get_or_set 极简实现
        return await cache.get_or_set(cache_key, _fetcher, ttl=self._cache_ttl)

    async def get_chat_config(
        self, tenant_id: int | None = None, force: bool = False
    ) -> dict[str, Any]:
        return await self._resolve_config("chat", tenant_id, force=force)

    async def get_embedding_config(
        self, tenant_id: int | None = None, force: bool = False
    ) -> dict[str, Any]:
        return await self._resolve_config("embedding", tenant_id, force=force)

    async def get_rerank_config(
        self, tenant_id: int | None = None, force: bool = False
    ) -> dict[str, Any]:
        return await self._resolve_config("rerank", tenant_id, force=force)


# 全局单例
configuration_service = ConfigurationService.get_instance()
