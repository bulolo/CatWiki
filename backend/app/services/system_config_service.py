import copy
import logging
from typing import Any
from uuid import uuid4

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.common.i18n import _
from app.core.common.masking import mask_sensitive_data
from app.core.infra.config import (
    DOC_PROCESSOR_CONFIG_KEY,
)
from app.core.infra.config_resolver import MODEL_TYPES, SECTION_TO_KEY
from app.core.infra.tenant import get_current_tenant, temporary_tenant_context
from app.core.web.exceptions import BadRequestException, NotFoundException
from app.crud.system_config import crud_system_config
from app.db.database import get_db
from app.db.transaction import transactional
from app.services.config.configuration_service import configuration_service

logger = logging.getLogger(__name__)


class SystemConfigService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def resolve_target_tenant_id(scope: str) -> int | None:
        """根据 scope 确定目标租户 ID"""
        if scope == "platform":
            return None
        return get_current_tenant()

    @staticmethod
    def _create_openai_client(api_key: str, base_url: str, timeout: float = 10.0):
        from openai import AsyncOpenAI

        return AsyncOpenAI(api_key=api_key, base_url=base_url, timeout=timeout)

    @transactional()
    async def get_ai_config(self, target_tenant_id: int | None) -> dict:
        """获取 AI 模型配置 (返回结构化数据：configs + meta)"""
        with temporary_tenant_context(target_tenant_id):
            # 1. 初始化模型骨架
            configs = {model_type: {} for model_type in MODEL_TYPES}

            # 2. 从数据库加载现有配置
            for model_type in MODEL_TYPES:
                config_key = SECTION_TO_KEY[model_type]
                config = await crud_system_config.get_by_key(
                    self.db, config_key=config_key, tenant_id=target_tenant_id
                )
                if config:
                    val = copy.deepcopy(config.config_value)
                    configs[model_type] = mask_sensitive_data(val)

            # 3. [✨ 亮点] 生成元数据，标记哪些配置正在回退到平台
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
                            # [✨ 逻辑修正] 只有当租户显式保存了 mode 为 'platform' 时，才视为 Fallback 状态
                            # 这样如果租户什么都没配，界面会正确显示为“未配置”，而不是莫名其妙就变成“已配置（平台提供）”
                            is_fallback = configs.get(model_type, {}).get("mode") == "platform"
                            meta["is_platform_fallback"][model_type] = is_fallback
                except Exception as e:
                    logger.warning(f"⚠️ [SystemConfigService] Failed to generate meta: {e}")

            return {"configs": configs, "meta": meta}

    @transactional()
    async def resolve_platform_defaults(self, target_tenant_id: int | None) -> dict:
        """解析并聚合平台默认配置 (脱敏后)"""
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
                    "vl": await ConfigResolver.resolve_section("vl", None),
                }
                return mask_sensitive_data(defaults)
        except Exception as e:
            logger.error(f"❌ Failed to resolve platform defaults: {e}")

        return {}

    @staticmethod
    def _is_masked(val: Any) -> bool:
        """判断字符串是否包含脱敏掩码"""
        return isinstance(val, str) and "****" in val

    @staticmethod
    def _merge_securely(new_dict: dict, old_dict: dict):
        """深度合并配置，实现两个核心能力：
        1. 掩码还原：识别 **** 占位符并从旧数据中恢复真实 Credentials。
        2. 字段保全：如果新提交的字典缺少旧字典中的某些非涉密字段，自动补全它们（防止偏序提交导致的数据丢失）。
        """
        for k, v in old_dict.items():
            if k not in new_dict:
                # 1. 补全：新数据中完全缺失的键，直接从旧数据继承
                new_dict[k] = v
            elif SystemConfigService._is_masked(new_dict[k]):
                # 2. 还原：新数据中是掩码，且旧数据是真实值，则回填真实值
                if not SystemConfigService._is_masked(v) and v:
                    new_dict[k] = v
                else:
                    # 连旧数据也是空的或掩码，说明该字段彻底失效，置空
                    new_dict[k] = ""
            elif isinstance(v, dict) and isinstance(new_dict.get(k), dict):
                # 3. 递归：处理嵌套结构 (如 extra_body)
                SystemConfigService._merge_securely(new_dict[k], v)

    @transactional()
    async def get_full_ai_state(self, target_tenant_id: int | None) -> dict:
        """获取全量 AI 状态 (配置 + 元数据 + 平台默认值)"""
        ai_state = await self.get_ai_config(target_tenant_id)
        platform_defaults = await self.resolve_platform_defaults(target_tenant_id)
        return {
            "configs": ai_state["configs"],
            "meta": ai_state["meta"],
            "platform_defaults": platform_defaults or None,
        }

    @transactional()
    async def delete_config(self, config_key: str, target_tenant_id: int | None) -> None:
        """删除指定配置"""
        with temporary_tenant_context(target_tenant_id):
            db_config = await crud_system_config.get_by_key(
                self.db, config_key=config_key, tenant_id=target_tenant_id
            )

        if not db_config:
            raise NotFoundException(detail=_("config.not_found", key=config_key))

        await self.db.delete(db_config)

    @transactional()
    async def update_ai_config(self, target_tenant_id: int | None, update_data: Any) -> dict:
        """更新 AI 模型配置 (保存后返回全量数据)"""
        new_values = update_data.model_dump(exclude_unset=True)

        # 1. 执行数据库更新
        for model_type in MODEL_TYPES:
            if model_type in new_values:
                config_key = SECTION_TO_KEY[model_type]
                new_config_val = new_values[model_type]

                # [✨ 亮点] 深度合并逻辑：保护真实密钥不被脱敏占位符 (****) 覆盖
                existing = await crud_system_config.get_by_key(
                    self.db, config_key=config_key, tenant_id=target_tenant_id
                )

                if existing and isinstance(existing.config_value, dict):
                    self._merge_securely(new_config_val, existing.config_value)

                await crud_system_config.update_by_key(
                    self.db,
                    config_key=config_key,
                    config_value=new_config_val,
                    tenant_id=target_tenant_id,
                )

        # 2. 注册提交后回调：清理缓存并重新加载向量库
        from app.db.transaction import on_commit

        on_commit(
            self.db, self._after_ai_config_update, target_tenant_id, "embedding" in new_values
        )

        # 3. 返回全量状态
        return await self.get_full_ai_state(target_tenant_id)

    async def _after_ai_config_update(self, tenant_id: int | None, reload_vector: bool):
        """AI 配置更新后的副作用处理"""
        try:
            await configuration_service.clear_cache(tenant_id=tenant_id)
            logger.info(f"🧹 Cleared AI config cache for tenant: {tenant_id}")
        except Exception as e:
            logger.error(f"❌ Failed to clear config cache: {e}")

        if reload_vector:
            try:
                from app.core.vector.vector_store import VectorStoreManager

                manager = await VectorStoreManager.get_instance()
                await manager.reload_credentials(tenant_id=tenant_id)
                logger.info("✅ VectorStore credentials reloaded")
            except Exception as e:
                logger.warning(f"⚠️ Vector store reload failed: {e}")

    @transactional()
    async def _resolve_connection_params(
        self, target_tenant_id: int | None, model_type: str, config: Any
    ) -> tuple[str, str, str]:
        """解析最终用于连接的 (api_key, base_url, model)"""
        api_key = config.api_key
        base_url = config.base_url
        model = config.model

        is_masked = self._is_masked(api_key)
        is_platform = config.mode == "platform"

        if is_masked or is_platform:
            lookup_tenant_id = target_tenant_id if not is_platform else None
            config_key = SECTION_TO_KEY[model_type]

            existing = await crud_system_config.get_by_key(
                self.db, config_key=config_key, tenant_id=lookup_tenant_id
            )
            if existing and isinstance(existing.config_value, dict):
                old_val = existing.config_value
                if is_masked or (is_platform and not api_key):
                    api_key = old_val.get("api_key", api_key)
                if is_platform and not model:
                    model = old_val.get("model", model)
                if is_platform and not base_url:
                    base_url = old_val.get("base_url", base_url)

        return api_key, base_url, model

    @transactional()
    async def test_model_connection(
        self, target_tenant_id: int | None, model_type: str, config: Any
    ) -> dict:
        """测试模型连接性 (支持自动从数据库恢复 **** 占位符)"""
        api_key, base_url, model = await self._resolve_connection_params(
            target_tenant_id, model_type, config
        )

        try:
            if model_type in ["chat", "vl"]:
                return await self._test_chat_connection(api_key, base_url, model)
            elif model_type == "embedding":
                return await self._test_embedding_connection(api_key, base_url, model)
            elif model_type == "rerank":
                return await self._test_rerank_connection(api_key, base_url, model)
        except Exception as e:
            logger.error(f"❌ {model_type.upper()} connection test failed: {e}")
            raise BadRequestException(detail=_("config.connect_failed", error=str(e)))

        raise BadRequestException(detail=_("config.unsupported_test_type", type=model_type))

    @staticmethod
    async def _test_chat_connection(api_key: str, base_url: str, model: str) -> dict:
        client = SystemConfigService._create_openai_client(api_key, base_url)
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Hello"}],
            max_tokens=5,
        )
        return {"details": f"Response: {response.choices[0].message.content[:20]}..."}

    @staticmethod
    async def _test_embedding_connection(api_key: str, base_url: str, model: str) -> dict:
        client = SystemConfigService._create_openai_client(api_key, base_url)
        response = await client.embeddings.create(model=model, input="Hello world")
        return {"dimension": len(response.data[0].embedding)}

    @staticmethod
    async def _test_rerank_connection(api_key: str, base_url: str, model: str) -> dict:
        import httpx

        url = base_url.rstrip("/")
        if not url.endswith("/rerank"):
            url = f"{url}/rerank"

        payload = {
            "model": model,
            "query": "Ping",
            "documents": ["Pong"],
            "top_n": 1,
        }
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code != 200:
                raise Exception(f"HTTP {resp.status_code}: {resp.text[:100]}")
            return {"status": "ok"}

    @transactional()
    async def get_doc_processor_config(
        self, target_tenant_id: int | None, scope: str, mask: bool = True
    ) -> dict:
        """获取文档处理服务配置 (带平台回退合并逻辑)"""
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

        # 3. 获取平台配置 (如果允许)
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
        """解析租户可用的平台文档处理器默认值"""
        # 检查租户是否允许使用平台资源
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

        # 获取平台（None 租户）配置
        with temporary_tenant_context(None):
            platform_config = await crud_system_config.get_by_key(
                self.db, config_key=DOC_PROCESSOR_CONFIG_KEY, tenant_id=None
            )
            if not platform_config:
                return {"processors": []}

            procs = mask_sensitive_data(platform_config.config_value.get("processors", []))
            return {"processors": procs}

    @transactional()
    async def update_doc_processor_config(
        self, target_tenant_id: int | None, update_data: Any
    ) -> dict:
        """更新文档处理服务配置 (自动过滤平台来源，并持久化 ID)"""
        config_value = update_data.model_dump(mode="json")
        if "processors" in config_value:
            # 先取出数据库中未脱敏的旧配置，用于恢复被掩码的字段
            old_configs = await self.get_doc_processor_config(
                target_tenant_id, scope="tenant", mask=False
            )
            old_map = {p["id"]: p for p in old_configs.get("processors", []) if p.get("id")}

            filtered_procs = []
            for p in config_value["processors"]:
                # 1. 过滤：禁止将来源为 platform 的项存入租户私有库
                if p.get("origin") == "platform":
                    continue

                # 2. 稳定 ID：如果新加的项没有 ID，生成一个并固定下来
                if not p.get("id"):
                    p["id"] = str(uuid4())

                # 3. 恢复掩码：如果 api_key 是掩码值，从旧配置取回真实值
                if self._is_masked(p.get("api_key")) and p["id"] in old_map:
                    p["api_key"] = old_map[p["id"]].get("api_key", p["api_key"])

                filtered_procs.append(p)

            config_value["processors"] = filtered_procs

        # 触发数据库更新
        db_config = await crud_system_config.update_by_key(
            self.db,
            config_key=DOC_PROCESSOR_CONFIG_KEY,
            config_value=config_value,
            tenant_id=target_tenant_id,
        )
        return copy.deepcopy(db_config.config_value)

    async def _resolve_doc_processor_config(self, target_tenant_id: int | None, config: Any) -> Any:
        """从数据库恢复 masked 的 DocProcessor 配置"""
        if not self._is_masked(config.api_key):
            return config

        # 如果是掩码，需要从数据库找回原值
        # 注意：DocProcessor 是一个列表，我们需要根据 ID 匹配
        all_configs = await self.get_doc_processor_config(
            target_tenant_id, scope="tenant", mask=False
        )
        processors = all_configs.get("processors", [])
        target = next((p for p in processors if p.get("id") == config.id), None)

        if target:
            config.api_key = target.get("api_key", config.api_key)
            # 如果 base_url 也是空的（对于平台资源），也可以从这里恢复
            if not config.base_url:
                config.base_url = target.get("base_url", config.base_url)

        return config

    async def test_doc_processor_connection(
        self, target_tenant_id: int | None, config: Any
    ) -> dict:
        """测试文档处理服务连接性"""
        # 1. 自动恢复掩码密钥
        config = await self._resolve_doc_processor_config(target_tenant_id, config)

        try:
            from app.core.doc_processor import DocProcessorFactory

            processor = DocProcessorFactory.create(config)
            is_healthy = await processor.is_healthy()
            if is_healthy:
                version = await processor.get_version()
                return {"status": "healthy", "version": version}
            else:
                raise BadRequestException(detail=_("config.service_unavailable"))
        except Exception as e:
            logger.error(f"❌ Doc processor test failed: {e}")
            raise BadRequestException(detail=_("config.connect_failed", error=str(e)))


def get_system_config_service(db: AsyncSession = Depends(get_db)) -> SystemConfigService:
    """获取 SystemConfigService 实例的依赖注入函数"""
    return SystemConfigService(db)
