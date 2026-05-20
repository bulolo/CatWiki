# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""文档处理器配置管理 mixin —— MinerU / Docling / PaddleOCR 等解析服务。

挂在 ``SystemConfigService`` 上的方法集合，由其提供 ``self.db``。包含：
- 读：``get_doc_processor_config`` (含平台回退合并) / ``resolve_platform_doc_processor_defaults``
- 写：``update_doc_processor_config`` (过滤 platform 来源 + 还原掩码 + 稳定 ID)
- 测：``test_doc_processor_connection``
"""

import copy
import logging
from typing import Any
from uuid import uuid4

from app.core.common.i18n import _
from app.core.common.masking import mask_sensitive_data
from app.core.infra.config import DOC_PROCESSOR_CONFIG_KEY
from app.core.infra.tenant import temporary_tenant_context
from app.core.web.exceptions import BadRequestException
from app.crud.system_config import crud_system_config
from app.db.transaction import transactional
from app.services.system_config._secrets import is_masked

logger = logging.getLogger(__name__)


class DocProcessorMixin:
    """文档解析器配置相关方法。Mixin —— 假定 ``self.db: AsyncSession``。"""

    db: Any  # 由 SystemConfigService 提供

    # ──────────────────────────────────────────────────────────────────────
    # 读
    # ──────────────────────────────────────────────────────────────────────

    @transactional()
    async def get_doc_processor_config(
        self, target_tenant_id: int | None, scope: str, mask: bool = True
    ) -> dict:
        """获取文档处理服务配置 (带平台回退合并逻辑)。"""
        # 1. 检查平台回退权限
        platform_fallback_allowed = False
        if scope == "tenant" and target_tenant_id:
            from app.crud.tenant import crud_tenant

            tenant = await crud_tenant.get(self.db, id=target_tenant_id)
            allowed_resources = ["models", "doc_processors"]
            try:
                from app.ee.loader import get_ee_tenant_platform_resources

                allowed_resources = await get_ee_tenant_platform_resources(
                    self.db, target_tenant_id
                )
            except ImportError:
                pass
            if tenant and "doc_processors" in allowed_resources:
                platform_fallback_allowed = True

        # 2. 读取租户私有配置
        tenant_processors = []
        with temporary_tenant_context(target_tenant_id):
            config = await crud_system_config.get_by_key(
                self.db, config_key=DOC_PROCESSOR_CONFIG_KEY, tenant_id=target_tenant_id
            )
            if config:
                tenant_processors = config.config_value.get("processors", [])
                for p in tenant_processors:
                    p["origin"] = "tenant"
                    if "id" not in p:
                        p["id"] = str(uuid4())

        # 3. 读取平台配置 (如果允许)
        platform_processors = []
        if platform_fallback_allowed:
            with temporary_tenant_context(None):
                platform_config = await crud_system_config.get_by_key(
                    self.db, config_key=DOC_PROCESSOR_CONFIG_KEY, tenant_id=None
                )
                if platform_config:
                    platform_processors = platform_config.config_value.get("processors", [])
                    for p in platform_processors:
                        p["origin"] = "platform"
                        if "id" not in p:
                            p["id"] = str(uuid4())

        # 4. 根据视角进行脱敏并合并
        if mask:
            if tenant_processors:
                tenant_processors = mask_sensitive_data(tenant_processors)
            if platform_processors:
                platform_processors = mask_sensitive_data(platform_processors)

        return {"processors": tenant_processors + platform_processors}

    @transactional()
    async def resolve_platform_doc_processor_defaults(self, target_tenant_id: int | None) -> dict:
        """解析租户可用的平台文档处理器默认值。"""
        from app.crud.tenant import crud_tenant

        tenant = await crud_tenant.get(self.db, id=target_tenant_id)
        allowed_resources = ["models", "doc_processors"]
        try:
            from app.ee.loader import get_ee_tenant_platform_resources

            allowed_resources = await get_ee_tenant_platform_resources(self.db, target_tenant_id)
        except ImportError:
            pass
        if not tenant or "doc_processors" not in allowed_resources:
            return {"processors": []}

        with temporary_tenant_context(None):
            platform_config = await crud_system_config.get_by_key(
                self.db, config_key=DOC_PROCESSOR_CONFIG_KEY, tenant_id=None
            )
            if not platform_config:
                return {"processors": []}

            procs = mask_sensitive_data(platform_config.config_value.get("processors", []))
            return {"processors": procs}

    # ──────────────────────────────────────────────────────────────────────
    # 写
    # ──────────────────────────────────────────────────────────────────────

    @transactional()
    async def update_doc_processor_config(
        self, target_tenant_id: int | None, update_data: Any
    ) -> dict:
        """更新文档处理服务配置 (自动过滤平台来源，并持久化 ID)。"""
        config_value = update_data.model_dump(mode="json")
        if "processors" in config_value:
            # 取数据库中未脱敏的旧配置，用于恢复被掩码的字段
            old_configs = await self.get_doc_processor_config(
                target_tenant_id, scope="tenant", mask=False
            )
            old_map = {p["id"]: p for p in old_configs.get("processors", []) if p.get("id")}

            filtered_procs = []
            for p in config_value["processors"]:
                # 1. 过滤：禁止把 platform 来源项存入租户私有库
                if p.get("origin") == "platform":
                    continue

                # 2. 稳定 ID：新加项无 ID 则生成并固定下来
                if not p.get("id"):
                    p["id"] = str(uuid4())

                # 3. 恢复掩码：如果 api_key 是掩码值，从旧配置取回真实值
                if is_masked(p.get("api_key")) and p["id"] in old_map:
                    p["api_key"] = old_map[p["id"]].get("api_key", p["api_key"])

                filtered_procs.append(p)

            config_value["processors"] = filtered_procs

        db_config = await crud_system_config.update_by_key(
            self.db,
            config_key=DOC_PROCESSOR_CONFIG_KEY,
            config_value=config_value,
            tenant_id=target_tenant_id,
        )
        return copy.deepcopy(db_config.config_value)

    # ──────────────────────────────────────────────────────────────────────
    # 测试连通性
    # ──────────────────────────────────────────────────────────────────────

    async def _resolve_doc_processor_config(self, target_tenant_id: int | None, config: Any) -> Any:
        """从数据库恢复 masked 的 DocProcessor 配置。"""
        if not is_masked(config.api_key):
            return config

        # DocProcessor 是列表，按 ID 匹配
        all_configs = await self.get_doc_processor_config(
            target_tenant_id, scope="tenant", mask=False
        )
        processors = all_configs.get("processors", [])
        target = next((p for p in processors if p.get("id") == config.id), None)

        if target:
            config.api_key = target.get("api_key", config.api_key)
            # 如果 base_url 也是空（对于平台资源），也可以从这里恢复
            if not config.base_url:
                config.base_url = target.get("base_url", config.base_url)

        return config

    async def test_doc_processor_connection(
        self, target_tenant_id: int | None, config: Any
    ) -> dict:
        """测试文档处理服务连接性。"""
        config = await self._resolve_doc_processor_config(target_tenant_id, config)

        try:
            from app.core.doc_processor import DocProcessorFactory

            processor = DocProcessorFactory.create(config)
            is_healthy = await processor.is_healthy()
            if is_healthy:
                version = await processor.get_version()
                return {"status": "healthy", "version": version}
            raise BadRequestException(detail=_("config.service_unavailable"))
        except Exception as e:
            logger.error(f"❌ Doc processor test failed: {e}")
            raise BadRequestException(detail=_("config.connect_failed", error=str(e)))
