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

负责管理系统级与租户级的动态配置，核心职责：
1. 配置路由：根据 mode (Custom/Platform) 决定配置源。
2. 缓存管理：基于 TTL 的多级缓存策略。
3. 安全审计：敏感信息脱敏与访问日志。
"""

import copy
import json
import logging
import time
from typing import Any, Optional

from app.core.common.masking import mask_sensitive_data
from app.core.infra.config import AI_CONFIG_KEY
from app.core.infra.tenant import temporary_tenant_context
from app.crud import crud_system_config
from app.db.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


class ConfigurationService:
    """配置服务 (单例模式)

    职责：
    1. 缓存管理：基于 TTL (默认 60s) 的本地内存缓存。
    2. 模式路由：根据 mode 分支，定向到租户或平台配置，无隐式回退。
    3. 安全日志：脱敏处理 API Key，并区分“新鲜加载”与“缓存命中”日志。
    4. 配置身份标识 (Hash/Fingerprint):
       - 系统的物理实例（如向量库连接、Chat 客户端、Reranker 实例等）通过解析后的配置哈希来识别。
       - 哈希组成核心字段：{ "model", "apiKey", "baseUrl", "dimension"(仅向量) }。
       - 当这些核心字段发生变化时，代表该模块的“身份”改变，将触发后端对应实例的重置或重新初始化。
    """

    _instance: Optional["ConfigurationService"] = None

    def __init__(self, cache_ttl: int = 60):
        self._config_cache: dict[str, dict[str, Any]] = {}
        self._last_update_map: dict[str, float] = {}
        self._cache_ttl = cache_ttl

    @classmethod
    def get_instance(cls) -> "ConfigurationService":
        """获取服务单例实例"""
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _mask_config(self, config: dict[str, Any]) -> dict[str, Any]:
        """对敏感字段进行脱敏处理"""
        return mask_sensitive_data(config)

    def _compute_config_hash(self, config: dict[str, Any]) -> str:
        """计算配置指纹 (Identity Hash)"""
        import hashlib

        # 只选取影响物理连接身份的核心字段
        identity_parts = {
            "model": config.get("model"),
            "apiKey": config.get("apiKey"),
            "baseUrl": str(config.get("baseUrl", "")).rstrip("/"),
            "dimension": config.get("dimension"),  # 只有向量模型会有这个字段
        }
        # 排序确保哈希稳定性
        identity_str = json.dumps(identity_parts, sort_keys=True)
        return hashlib.md5(identity_str.encode()).hexdigest()

    def _log_resolved_config(self, section: str, target: str, mode: str, config: dict[str, Any]):
        """打印全量可视化卡片 (🔍 模式)"""
        masked = self._mask_config(config)
        try:
            pretty_json = json.dumps(masked, indent=4, ensure_ascii=False)
        except Exception:
            pretty_json = str(masked)

        log_msg = (
            f"\n{'=' * 60}\n"
            f"🔍 [Config Service] -> 🔄 从数据库新鲜加载\n"
            f"   - 模块段: {section}\n"
            f"   - 目标租户: {target}\n"
            f"   - 指纹标识: {config.get('_hash', 'N/A')}\n"
            f"   - 命中模式: {mode}\n"
            f"   - 最终配置内容:\n{pretty_json}\n"
            f"{'=' * 60}"
        )
        logger.info(log_msg)

    async def _get_raw_db_config(
        self, tenant_id: int | None = None, force: bool = False
    ) -> tuple[dict[str, Any], bool]:
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
                logger.error(f"❌ [ConfigService] DB 读取异常 (租户: {tenant_id}): {e}")
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
            logger.info("🧹 [ConfigService] 已清空全部配置缓存")
        else:
            cache_key = f"tenant:{tenant_id}" if tenant_id else "platform"
            self._config_cache.pop(cache_key, None)
            self._last_update_map.pop(cache_key, None)
            logger.info(f"🧹 [ConfigService] 已清除 {cache_key} 的配置缓存")

    async def _resolve_config(
        self, section: str, tenant_id: int | None = None, force: bool = False
    ) -> dict[str, Any]:
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
                raise CatWikiError(
                    f"租户 {tenant_id} 尚未配置 '{section}' 模型相关参数，且禁止隐式回退"
                )

            mode = tenant_section.get("mode")

            # 情况 2: Custom 模式 - 锁定租户数据
            if mode == "custom":
                tenant_section.update({"_mode": "custom", "_source": "tenant"})
                tenant_section["_hash"] = self._compute_config_hash(tenant_section)

                if fetched_tenant:
                    self._log_resolved_config(
                        section, f"Tenant {tenant_id}", "Custom (租户锁定)", tenant_section
                    )
                else:
                    logger.debug(
                        f"⚡ [ConfigService] Cache hit for '{section}' (Tenant {tenant_id}, Mode: custom)"
                    )
                return tenant_section

            # 情况 3: Platform 模式 - 校验权限后回退
            if mode == "platform":
                if "models" not in allowed_resources:
                    raise CatWikiError(
                        f"租户 {tenant_id} 尝试使用平台模型资源，但未获得 'models' 授权"
                    )

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
            logger.debug(
                f"⚡ [ConfigService] Cache hit for '{section}' ({target_name}, Mode: platform)"
            )

        return platform_section

    async def get_chat_config(
        self, tenant_id: int | None = None, force: bool = False
    ) -> dict[str, Any]:
        """获取 Chat 模型配置"""
        return await self._resolve_config("chat", tenant_id, force=force)

    async def get_embedding_config(
        self, tenant_id: int | None = None, force: bool = False
    ) -> dict[str, Any]:
        """获取 Embedding 模型配置"""
        return await self._resolve_config("embedding", tenant_id, force=force)

    async def get_rerank_config(
        self, tenant_id: int | None = None, force: bool = False
    ) -> dict[str, Any]:
        """获取 Rerank 模型配置"""
        return await self._resolve_config("rerank", tenant_id, force=force)

    async def get_vl_config(
        self, tenant_id: int | None = None, force: bool = False
    ) -> dict[str, Any]:
        """获取视觉语言模型配置"""
        return await self._resolve_config("vl", tenant_id, force=force)


# 全局单例
configuration_service = ConfigurationService.get_instance()
