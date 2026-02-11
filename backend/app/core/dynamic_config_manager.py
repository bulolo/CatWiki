# Copyright 2024 CatWiki Authors
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

"""全局动态配置管理器

提供对数据库中 ai_config 的统一访问和时间缓存 (TTL)，减少重复数据库查询。
"""

import logging
import time
from typing import Dict, Any, Optional

from app.db.database import AsyncSessionLocal
from app.crud.system_config import crud_system_config

logger = logging.getLogger(__name__)

AI_CONFIG_KEY = "ai_config"


class DynamicConfigManager:
    """动态配置管理器 (单例)"""

    _instance: Optional["DynamicConfigManager"] = None

    def __init__(self, cache_ttl: int = 300):
        self._config_cache: Dict[str, Dict[str, Any]] = {}
        self._last_update_map: Dict[str, float] = {}
        self._cache_ttl = cache_ttl  # 默认 5 分钟缓存

    @classmethod
    def get_instance(cls) -> "DynamicConfigManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def _ensure_config(self, tenant_id: int | None = None) -> Dict[str, Any]:
        """确保某个租户（或平台）的配置是最新的"""
        cache_key = f"tenant:{tenant_id}" if tenant_id else "platform"
        now = time.time()
        
        # 检查缓存是否有效
        last_update = self._last_update_map.get(cache_key, 0)
        if now - last_update < self._cache_ttl and cache_key in self._config_cache:
            return self._config_cache[cache_key]

        async with AsyncSessionLocal() as db:
            try:
                config = await crud_system_config.get_by_key(
                    db, config_key=AI_CONFIG_KEY, tenant_id=tenant_id
                )
                self._last_update_map[cache_key] = now

                if config and config.config_value:
                    self._config_cache[cache_key] = config.config_value
                    logger.debug(
                        f"🔄 [ConfigManager] Cache updated for {cache_key} (TTL: {self._cache_ttl}s)"
                    )
                else:
                    # 如果 DB 没有，设为空 dict
                    self._config_cache[cache_key] = {}
            except Exception as e:
                logger.error(f"❌ [ConfigManager] Failed to fetch config for {cache_key}: {e}")
                # 出现异常时缩短重试跨度
                self._last_update_map[cache_key] = now - self._cache_ttl + 10

        return self._config_cache.get(cache_key, {})

    def _extract_section(self, config: Dict[str, Any], section: str) -> Dict[str, Any]:
        """提取特定的配置段并兼容旧结构"""
        # 1. 尝试直接读取扁平结构
        data = config.get(section, {})

        # 2. 兼容 manualConfig 嵌套结构
        if not data and "manualConfig" in config:
            data = config.get("manualConfig", {}).get(section, {})

        return data if isinstance(data, dict) else {}

    async def _get_merged_config(self, section: str, tenant_id: int | None = None) -> Dict[str, Any]:
        """获取合并后的最终配置 (处理租户自定义 vs 平台回退)"""
        # 1. 获取平台默认配置
        platform_full_conf = await self._ensure_config(tenant_id=None)
        platform_section_conf = self._extract_section(platform_full_conf, section)
        
        # 如果没有指定租户，直接返回平台配置
        if not tenant_id:
            return platform_section_conf
            
        # 2. 获取租户配置
        tenant_full_conf = await self._ensure_config(tenant_id=tenant_id)
        tenant_section_conf = self._extract_section(tenant_full_conf, section)
        
        # 3. 判断使用哪个配置
        # 默认模式是 custom (schema 定义如此)，但如果租户没配过，可能是空
        mode = tenant_section_conf.get("mode", "custom")
        
        # 如果是 自定义模式 且 有配置内容 (API Key)，优先使用租户配置
        # 注意：这里我们假设只要配了 apiKey 就视为有效
        if mode == "custom" and tenant_section_conf.get("apiKey"):
            return tenant_section_conf
            
        # 否则 (mode=platform 或 租户未配置)，回退到平台配置
        # 但如果平台也没配，那就只能返回空的租户配置了
        if platform_section_conf.get("apiKey"):
            return platform_section_conf
            
        return tenant_section_conf

    async def get_chat_config(self, tenant_id: int | None = None) -> Dict[str, Any]:
        """获取聊天配置"""
        chat_conf = await self._get_merged_config("chat", tenant_id)

        return {
            "provider": chat_conf.get("provider", "openai"),
            "model": chat_conf.get("model", ""),
            "apiKey": chat_conf.get("apiKey", ""),
            "baseUrl": chat_conf.get("baseUrl", ""),
        }

    async def get_embedding_config(self, tenant_id: int | None = None) -> Dict[str, Any]:
        """获取嵌入配置"""
        return await self._get_merged_config("embedding", tenant_id)

    async def get_rerank_config(self, tenant_id: int | None = None) -> Dict[str, Any]:
        """获取重排序配置"""
        return await self._get_merged_config("rerank", tenant_id)


# 全局单例
dynamic_config_manager = DynamicConfigManager.get_instance()
