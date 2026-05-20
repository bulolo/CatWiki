# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""AI 模型配置管理 mixin —— chat / embedding / rerank 三类。

挂在 ``SystemConfigService`` 上的方法集合，由其提供 ``self.db``。包含：
- 读：``get_ai_config`` / ``resolve_platform_defaults`` / ``get_full_ai_state``
- 写：``update_ai_config`` + ``_after_ai_config_update`` 回调
- 测：``test_model_connection`` + 3 个 ``_test_*_connection`` 子方法

不包含 ``delete_config``（通用单 key 删除，保留在 service.py）和 generic helper。
"""

import copy
import logging
from typing import Any

from openai import AsyncOpenAI

from app.core.ai.providers import resolve_rerank_url
from app.core.common.i18n import _
from app.core.common.masking import mask_sensitive_data
from app.core.infra.config_resolver import MODEL_TYPES, SECTION_TO_KEY
from app.core.infra.tenant import temporary_tenant_context
from app.core.web.exceptions import BadRequestException
from app.crud.system_config import crud_system_config
from app.db.transaction import on_commit, transactional
from app.services.config import configuration_service
from app.services.system_config._secrets import is_masked, merge_securely

logger = logging.getLogger(__name__)


def _create_openai_client(api_key: str, base_url: str, timeout: float = 10.0) -> AsyncOpenAI:
    """连通性测试用的临时 AsyncOpenAI 客户端（短超时）。"""
    return AsyncOpenAI(api_key=api_key, base_url=base_url, timeout=timeout)


class AIConfigMixin:
    """AI 模型配置相关方法。Mixin —— 假定 ``self.db: AsyncSession``。"""

    db: Any  # 由 SystemConfigService 提供

    # ──────────────────────────────────────────────────────────────────────
    # 读
    # ──────────────────────────────────────────────────────────────────────

    @transactional()
    async def get_ai_config(self, target_tenant_id: int | None) -> dict:
        """获取 AI 模型配置 (返回结构化数据：configs + meta)。"""
        with temporary_tenant_context(target_tenant_id):
            configs = {model_type: {} for model_type in MODEL_TYPES}

            for model_type in MODEL_TYPES:
                config_key = SECTION_TO_KEY[model_type]
                config = await crud_system_config.get_by_key(
                    self.db, config_key=config_key, tenant_id=target_tenant_id
                )
                if config:
                    val = copy.deepcopy(config.config_value)
                    configs[model_type] = mask_sensitive_data(val)

            # 标记哪些配置正在回退到平台
            meta = {"is_platform_fallback": {model_type: False for model_type in MODEL_TYPES}}

            if target_tenant_id:
                try:
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

                    if tenant and "models" in allowed_resources:
                        for model_type in MODEL_TYPES:
                            # 只有当租户显式保存 mode='platform' 时才算 Fallback
                            is_fallback = configs.get(model_type, {}).get("mode") == "platform"
                            meta["is_platform_fallback"][model_type] = is_fallback
                except Exception as e:
                    logger.warning(f"⚠️ [AIConfig] Failed to generate meta: {e}")

            return {"configs": configs, "meta": meta}

    @transactional()
    async def resolve_platform_defaults(self, target_tenant_id: int | None) -> dict:
        """解析并聚合平台默认配置 (脱敏后)。"""
        if not target_tenant_id:
            return {}

        try:
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

            if tenant and "models" in allowed_resources:
                from app.core.infra.config_resolver import ConfigResolver

                defaults = {
                    "chat": await ConfigResolver.resolve_section("chat", None),
                    "embedding": await ConfigResolver.resolve_section("embedding", None),
                    "rerank": await ConfigResolver.resolve_section("rerank", None),
                }
                return mask_sensitive_data(defaults)
        except Exception as e:
            logger.error(f"❌ Failed to resolve platform defaults: {e}")

        return {}

    @transactional()
    async def get_full_ai_state(self, target_tenant_id: int | None) -> dict:
        """获取全量 AI 状态 (配置 + 元数据 + 平台默认值)。"""
        ai_state = await self.get_ai_config(target_tenant_id)
        platform_defaults = await self.resolve_platform_defaults(target_tenant_id)
        return {
            "configs": ai_state["configs"],
            "meta": ai_state["meta"],
            "platform_defaults": platform_defaults or None,
        }

    # ──────────────────────────────────────────────────────────────────────
    # 写
    # ──────────────────────────────────────────────────────────────────────

    @transactional()
    async def update_ai_config(self, target_tenant_id: int | None, update_data: Any) -> dict:
        """更新 AI 模型配置 (保存后返回全量数据)。"""
        new_values = update_data.model_dump(exclude_unset=True)

        for model_type in MODEL_TYPES:
            if model_type in new_values:
                config_key = SECTION_TO_KEY[model_type]
                new_config_val = new_values[model_type]

                # 深度合并：保护真实密钥不被脱敏占位符 (****) 覆盖
                existing = await crud_system_config.get_by_key(
                    self.db, config_key=config_key, tenant_id=target_tenant_id
                )

                if existing and isinstance(existing.config_value, dict):
                    merge_securely(new_config_val, existing.config_value)

                await crud_system_config.update_by_key(
                    self.db,
                    config_key=config_key,
                    config_value=new_config_val,
                    tenant_id=target_tenant_id,
                )

        # 注册 on_commit 副作用（清缓存 + 可能重载向量库凭证）
        on_commit(
            self.db, self._after_ai_config_update, target_tenant_id, "embedding" in new_values
        )

        return await self.get_full_ai_state(target_tenant_id)

    async def _after_ai_config_update(self, tenant_id: int | None, reload_vector: bool):
        """AI 配置更新后的副作用处理：清缓存 + 按需重载向量库凭证。"""
        try:
            await configuration_service.clear_cache(tenant_id=tenant_id)
            logger.info(f"🧹 Cleared AI config cache for tenant: {tenant_id}")
        except Exception as e:
            logger.error(f"❌ Failed to clear config cache: {e}")

        if reload_vector:
            try:
                from app.core.vector import VectorStoreManager

                manager = await VectorStoreManager.get_instance()
                await manager.reload_credentials(tenant_id=tenant_id)
                logger.info("✅ VectorStore credentials reloaded")
            except Exception as e:
                logger.warning(f"⚠️ Vector store reload failed: {e}")

    # ──────────────────────────────────────────────────────────────────────
    # 测试连通性
    # ──────────────────────────────────────────────────────────────────────

    @transactional()
    async def _resolve_connection_params(
        self, target_tenant_id: int | None, model_type: str, config: Any
    ) -> tuple[str, str, str]:
        """解析最终用于连接的 (api_key, base_url, model)，恢复掩码值。"""
        api_key = config.api_key
        base_url = config.base_url
        model = config.model

        masked = is_masked(api_key)
        platform_mode = config.mode == "platform"

        if masked or platform_mode:
            lookup_tenant_id = target_tenant_id if not platform_mode else None
            config_key = SECTION_TO_KEY[model_type]

            existing = await crud_system_config.get_by_key(
                self.db, config_key=config_key, tenant_id=lookup_tenant_id
            )
            if existing and isinstance(existing.config_value, dict):
                old_val = existing.config_value
                if masked or (platform_mode and not api_key):
                    api_key = old_val.get("api_key", api_key)
                if platform_mode and not model:
                    model = old_val.get("model", model)
                if platform_mode and not base_url:
                    base_url = old_val.get("base_url", base_url)

        return api_key, base_url, model

    @transactional()
    async def test_model_connection(
        self, target_tenant_id: int | None, model_type: str, config: Any
    ) -> dict:
        """测试模型连接性 (支持自动从数据库恢复 **** 占位符)。"""
        api_key, base_url, model = await self._resolve_connection_params(
            target_tenant_id, model_type, config
        )

        try:
            if model_type == "chat":
                return await _test_chat_connection(api_key, base_url, model)
            if model_type == "embedding":
                return await _test_embedding_connection(api_key, base_url, model)
            if model_type == "rerank":
                return await _test_rerank_connection(
                    api_key, base_url, model, getattr(config, "endpoint_path", None)
                )
        except Exception as e:
            logger.error(f"❌ {model_type.upper()} connection test failed: {e}")
            raise BadRequestException(detail=_("config.connect_failed", error=str(e)))

        raise BadRequestException(detail=_("config.unsupported_test_type", type=model_type))


# ──────────────────────────────────────────────────────────────────────────
# 具体测试实现 (模块级 free function；不依赖 self)
# ──────────────────────────────────────────────────────────────────────────


async def _test_chat_connection(api_key: str, base_url: str, model: str) -> dict:
    client = _create_openai_client(api_key, base_url)
    response = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": "Hello"}],
        max_tokens=5,
    )
    content = response.choices[0].message.content or ""
    return {"details": f"Response: {content[:20]}..."}


async def _test_embedding_connection(api_key: str, base_url: str, model: str) -> dict:
    client = _create_openai_client(api_key, base_url)
    response = await client.embeddings.create(model=model, input="Hello world")
    return {"dimension": len(response.data[0].embedding)}


async def _test_rerank_connection(
    api_key: str, base_url: str, model: str, endpoint_path: str | None = None
) -> dict:
    """测试 rerank endpoint 连通性。

    复用 ``resolve_rerank_url`` 与生产路径一致：默认追加 ``/rerank``，已含则原样，
    ``endpoint_path`` 显式覆盖（如 DashScope 的特殊路径）。
    """
    import httpx

    url = resolve_rerank_url(base_url, endpoint_path)
    payload = {"model": model, "query": "Ping", "documents": ["Pong"], "top_n": 1}
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, json=payload, headers=headers)
        if resp.status_code != 200:
            raise Exception(f"HTTP {resp.status_code}: {resp.text[:100]}")
        return {"status": "ok"}
