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

"""全局动态配置管理器 (精准日志版)

实现了显式的“获取即解析”路由逻辑。
具备精准的缓存控制与双策略日志系统：
- 🔍 [数据库读取]：当从 DB 全量加载或强制刷新时，展示完整可视化诊断卡片。
- ⚡ [缓存命中]：当命中内存缓存时，仅展示轻量级命中提示，减少日志洗版。
"""

import logging
import copy
import json
import time
from typing import Dict, Any, Optional, Tuple

from app.db.database import AsyncSessionLocal
from app.crud.system_config import crud_system_config
from app.core.infra.tenant import temporary_tenant_context

logger = logging.getLogger(__name__)

# 数据库存储 AI 配置的 Key 标识
AI_CONFIG_KEY = "ai_config"


class DynamicConfigManager:
    """动态配置管理器 (单例)
    
    职责：
    1. 缓存管理：基于 TTL (默认 60s) 的本地内存缓存。
    2. 模式路由：根据 mode 分支，定向到租户或平台配置，无隐式回退。
    3. 安全日志：脱敏处理 API Key，并区分“新鲜加载”与“缓存命中”日志。
    4. 配置身份标识 (Hash/Fingerprint):
       - 系统的物理实例（如向量库连接、Chat 客户端、Reranker 实例等）通过解析后的配置哈希来识别。
       - 哈希组成核心字段：{ "model", "apiKey", "baseUrl", "dimension"(仅向量) }。
       - 当这些核心字段发生变化时，代表该模块的“身份”改变，将触发后端对应实例的重置或重新初始化。
    """

    _instance: Optional["DynamicConfigManager"] = None

    def __init__(self, cache_ttl: int = 60):
        self._config_cache: Dict[str, Dict[str, Any]] = {}
        self._last_update_map: Dict[str, float] = {}
        self._cache_ttl = cache_ttl

    @classmethod
    def get_instance(cls) -> "DynamicConfigManager":
        """获取管理器单例实例"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _mask_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """对敏感字段进行脱敏处理"""
        masked = copy.deepcopy(config)
        # 补全可能出现的密钥键名
        for key in ["apiKey", "api_key", "password", "secret"]:
            if key in masked and isinstance(masked[key], str) and len(masked[key]) > 8:
                val = masked[key]
                masked[key] = f"{val[:4]}***{val[-4:]}"
        return masked

    def _compute_config_hash(self, config: Dict[str, Any]) -> str:
        """计算配置指纹 (Identity Hash)"""
        import hashlib
        # 只选取影响物理连接身份的核心字段
        identity_parts = {
            "model": config.get("model"),
            "apiKey": config.get("apiKey"),
            "baseUrl": str(config.get("baseUrl", "")).rstrip("/"),
            "dimension": config.get("dimension")  # 只有向量模型会有这个字段
        }
        # 排序确保哈希稳定性
        identity_str = json.dumps(identity_parts, sort_keys=True)
        return hashlib.md5(identity_str.encode()).hexdigest()

    def _log_resolved_config(self, section: str, target: str, mode: str, config: Dict[str, Any]):
        """打印全量可视化卡片 (🔍 模式)"""
        masked = self._mask_config(config)
        try:
            pretty_json = json.dumps(masked, indent=4, ensure_ascii=False)
        except:
            pretty_json = str(masked)

        log_msg = (
            f"\n{'='*60}\n"
            f"🔍 [AI Config Routing] -> 🔄 从数据库新鲜加载\n"
            f"   - 模块段: {section}\n"
            f"   - 目标租户: {target}\n"
            f"   - 指纹标识: {config.get('_hash', 'N/A')}\n"
            f"   - 命中模式: {mode}\n"
            f"   - 最终配置内容:\n{pretty_json}\n"
            f"{'='*60}"
        )
        logger.info(log_msg)

    async def _get_raw_db_config(self, tenant_id: int | None = None, force: bool = False) -> Tuple[Dict[str, Any], bool]:
        """
        获取原始配置，返回 (配置字典, 是否触发了数据库读取)
        """
        cache_key = f"tenant:{tenant_id}" if tenant_id else "platform"
        now = time.time()

        # 1. 尝试从缓存获取
        if not force:
            last_update = self._last_update_map.get(cache_key, 0)
            if now - last_update < self._cache_ttl and cache_key in self._config_cache:
                return self._config_cache[cache_key], False

        # 2. 缓存失效，强行查询 DB
        async with AsyncSessionLocal() as db:
            try:
                # 绕过多租户自动过滤拦截器
                with temporary_tenant_context(tenant_id):
                    config = await crud_system_config.get_by_key(
                        db, config_key=AI_CONFIG_KEY, tenant_id=tenant_id
                    )
                
                raw_data = config.config_value if config and config.config_value else {}
                
                # 更新缓存状态
                self._config_cache[cache_key] = raw_data
                self._last_update_map[cache_key] = now
                
                return raw_data, True
            except Exception as e:
                logger.error(f"❌ [ConfigManager] DB 读取异常 (租户: {tenant_id}): {e}")
                # 发生异常时尝试返回过期缓存保证系统不直接崩掉，但返回 False 表示未成功刷新
                return self._config_cache.get(cache_key, {}), False

    def clear_cache(self, tenant_id: int | None = -1):
        """清除缓存
        
        Args:
            tenant_id: 
                - 指定 ID: 清除该租户的缓存
                - None: 清除平台(全局)缓存
                - -1 (默认): 清除所有缓存
        """
        if tenant_id == -1:
            self._config_cache.clear()
            self._last_update_map.clear()
            logger.info("🧹 [ConfigManager] 已清空全部 AI 配置缓存")
        else:
            cache_key = f"tenant:{tenant_id}" if tenant_id else "platform"
            self._config_cache.pop(cache_key, None)
            self._last_update_map.pop(cache_key, None)
            logger.info(f"🧹 [ConfigManager] 已清除 {cache_key} 的 AI 配置缓存")

    async def _resolve_config(self, section: str, tenant_id: int | None = None, force: bool = False) -> Dict[str, Any]:
        """核心路由逻辑 (严格模式)"""
        from app.core.web.exceptions import CatWikiError
        from app.crud.tenant import crud_tenant

        # 1. 第一阶段：租户上下文处理
        if tenant_id:
            # A. 获取租户权限信息
            async with AsyncSessionLocal() as db:
                tenant = await crud_tenant.get(db, id=tenant_id)
                if not tenant:
                    raise CatWikiError(f"租户 {tenant_id} 不存在")
                allowed_resources = tenant.platform_resources_allowed or []

            # B. 获取租户 AI 配置
            raw_tenant, fetched_tenant = await self._get_raw_db_config(tenant_id, force=force)
            tenant_section = copy.deepcopy(raw_tenant.get(section))

            # 情况 1: 租户完全没有配置该模块
            if tenant_section is None:
                raise CatWikiError(f"租户 {tenant_id} 尚未配置 '{section}' 模型相关参数，且禁止隐式回退")

            mode = tenant_section.get("mode")

            # 情况 2: Custom 模式 - 锁定租户数据
            if mode == "custom":
                tenant_section.update({"_mode": "custom", "_source": "tenant"})
                tenant_section["_hash"] = self._compute_config_hash(tenant_section)
                
                if fetched_tenant:
                    self._log_resolved_config(section, f"Tenant {tenant_id}", "Custom (租户锁定)", tenant_section)
                else:
                    logger.debug(f"⚡ [ConfigManager] Cache hit for '{section}' (Tenant {tenant_id}, Mode: custom)")
                return tenant_section

            # 情况 3: Platform 模式 - 校验权限后回退
            if mode == "platform":
                if "models" not in allowed_resources:
                    raise CatWikiError(f"租户 {tenant_id} 尝试使用平台模型资源，但未获得 'models' 授权")
                
                # 授权通过，滑向下方的平台加载逻辑
            else:
                # 既不是 custom 也不是 platform，视为非法配置
                raise CatWikiError(f"租户 {tenant_id} 的 '{section}' 配置模式无效: {mode}")

        # 2. 第二阶段：指向平台或默认配置 (仅限 Platform 模式或全局上下文)
        raw_platform, fetched_platform = await self._get_raw_db_config(None, force=force)
        platform_section = copy.deepcopy(raw_platform.get(section))
        
        if platform_section is None:
            raise CatWikiError(f"全局平台配置中缺失 '{section}' 模块定义")

        platform_section.update({"_mode": "platform", "_source": "platform"})
        platform_section["_hash"] = self._compute_config_hash(platform_section)
        
        target_name = f"Tenant {tenant_id}" if tenant_id else "Platform GLOBAL"
        
        if fetched_platform:
            self._log_resolved_config(section, target_name, "Platform (平台共享)", platform_section)
        else:
            logger.debug(f"⚡ [ConfigManager] Cache hit for '{section}' ({target_name}, Mode: platform)")
            
        return platform_section

    async def get_chat_config(self, tenant_id: int | None = None, force: bool = False) -> Dict[str, Any]:
        """获取 Chat 模型配置"""
        return await self._resolve_config("chat", tenant_id, force=force)

    async def get_embedding_config(self, tenant_id: int | None = None, force: bool = False) -> Dict[str, Any]:
        """获取 Embedding 模型配置"""
        return await self._resolve_config("embedding", tenant_id, force=force)

    async def get_rerank_config(self, tenant_id: int | None = None, force: bool = False) -> Dict[str, Any]:
        """获取 Rerank 模型配置"""
        return await self._resolve_config("rerank", tenant_id, force=force)

    async def get_vl_config(self, tenant_id: int | None = None, force: bool = False) -> Dict[str, Any]:
        """获取视觉语言模型配置"""
        return await self._resolve_config("vl", tenant_id, force=force)


# 全局单例
dynamic_config_manager = DynamicConfigManager.get_instance()
