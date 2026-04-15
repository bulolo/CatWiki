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

import hashlib
import json
import logging
from typing import Any

from app.core.infra.config import (
    AI_CHAT_CONFIG_KEY,
    AI_EMBEDDING_CONFIG_KEY,
    AI_RERANK_CONFIG_KEY,
    AI_VL_CONFIG_KEY,
)
from app.core.infra.tenant import temporary_tenant_context
from app.core.web.exceptions import BadRequestException, CatWikiError
from app.crud.system_config import crud_system_config
from app.db.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

SECTION_TO_KEY = {
    "chat": AI_CHAT_CONFIG_KEY,
    "embedding": AI_EMBEDDING_CONFIG_KEY,
    "rerank": AI_RERANK_CONFIG_KEY,
    "vl": AI_VL_CONFIG_KEY,
}

MODEL_TYPES = ["chat", "embedding", "rerank", "vl"]


class ConfigResolver:
    """Core configuration resolver logic.

    This class handles the retrieval and resolution of configurations from the database,
    supporting tenant-specific overrides and platform fallbacks.
    It is placed in the core layer to avoid circular dependencies.
    """

    @staticmethod
    def compute_config_hash(config: dict[str, Any]) -> str:
        """Compute Identity Hash for a configuration block."""
        identity_parts = {
            "model": config.get("model"),
            "api_key": config.get("api_key"),
            "base_url": str(config.get("base_url") or "").rstrip("/"),
            "dimension": config.get("dimension"),
            "extra_body": config.get("extra_body"),
        }
        identity_str = json.dumps(identity_parts, sort_keys=True)
        return hashlib.md5(identity_str.encode()).hexdigest()

    @staticmethod
    async def get_raw_db_config(config_key: str, tenant_id: int | None = None) -> dict[str, Any]:
        """Fetch raw configuration from database by key."""
        async with AsyncSessionLocal() as db:
            try:
                with temporary_tenant_context(tenant_id):
                    config = await crud_system_config.get_by_key(
                        db, config_key=config_key, tenant_id=tenant_id
                    )
                return config.config_value if config and config.config_value else {}
            except Exception as e:
                logger.error(
                    f"❌ [ConfigResolver] DB read error (Key: {config_key}, Tenant: {tenant_id}): {e}"
                )
                return {}

    @classmethod
    async def resolve_section(cls, section: str, tenant_id: int | None = None) -> dict[str, Any]:
        """Resolve a specific configuration section (e.g., 'chat', 'embedding')."""

        # 1. Tenant Level
        if tenant_id:
            from app.crud.tenant import crud_tenant

            async with AsyncSessionLocal() as db:
                tenant = await crud_tenant.get(db, id=tenant_id)
                if not tenant:
                    raise CatWikiError(f"租户 {tenant_id} 不存在")

                try:
                    from app.ee.loader import get_ee_tenant_platform_resources

                    allowed_resources = await get_ee_tenant_platform_resources(db, tenant_id)
                except ImportError:
                    allowed_resources = ["models", "doc_processors"]

            # 1.1 Try Specific Module Key
            specific_key = SECTION_TO_KEY.get(section)
            if not specific_key:
                raise CatWikiError(f"Unknown AI section: {section}")

            tenant_section = await cls.get_raw_db_config(specific_key, tenant_id)

            if not tenant_section:
                # 如果是必选模块 (chat/embedding)，则报错
                if section in ["chat", "embedding"]:
                    raise CatWikiError(f"未配置 '{section}' 模块，请联系管理员配置模型")
                # 如果是可选模块 (rerank/vl)，返回禁用状态
                return {
                    "mode": "custom",
                    "enabled": False,
                    "_hash": "disabled",
                }

            mode = tenant_section.get("mode")
            if mode == "custom":
                tenant_section.update({"mode": "custom", "enabled": True})
                tenant_section["_hash"] = cls.compute_config_hash(tenant_section)
                return tenant_section

            if mode == "platform":
                if "models" not in allowed_resources:
                    # 如果是必选模块没授权，报错
                    if section in ["chat", "embedding"]:
                        raise CatWikiError(
                            f"租户 {tenant_id} 尝试使用平台模型资源，但未获得 'models' 授权"
                        )
                    # 如果是可选模块没授权，回退到禁用
                    return {
                        "mode": "platform",
                        "enabled": False,
                        "_hash": "unauthorized",
                    }
                # 授权通过，继续走下方平台流程
            else:
                # mode 未设置或无效
                if section in ["chat", "embedding"]:
                    raise CatWikiError(
                        f"租户 {tenant_id} 的 '{section}' 配置无效，请重新检查配置项"
                    )
                return {
                    "mode": "custom",
                    "enabled": False,
                    "_hash": "invalid_mode",
                }

        # 2. Platform Level
        specific_key = SECTION_TO_KEY.get(section)
        if not specific_key:
            raise CatWikiError(f"Unknown AI section: {section}")

        platform_section = await cls.get_raw_db_config(specific_key, None)

        if not platform_section:
            # 必选模块缺失平台配置，报错
            if section in ["chat", "embedding"]:
                raise CatWikiError(f"平台未配置 '{section}' 模块，请在系统设置中完成 AI 模型配置")
            # 可选模块缺失平台配置，返回禁用状态
            return {
                "mode": "platform",
                "enabled": False,
                "_hash": "platform_missing",
            }

        # [✨ 优化] 上下文感知：
        # 如果是租户在回退使用，其逻辑模式应为 platform。
        # 如果是平台自己在查看，其逻辑模式应为 custom。
        resolved_mode = "platform" if tenant_id is not None else "custom"

        platform_section.update(
            {
                "mode": resolved_mode,  # 逻辑判定结果：当前运行模式
                "enabled": True,
            }
        )
        platform_section["_hash"] = cls.compute_config_hash(platform_section)
        return platform_section

    @staticmethod
    def validate_config(section: str, config: dict[str, Any]) -> None:
        """[✨ 亮点] 统一 AI 配置校验逻辑"""

        mode = config.get("mode", "platform")
        api_key = config.get("api_key")
        enabled = config.get("enabled", True)

        # 如果是被显式禁用的可选模块，不触发校验（由业务层自己处理 enabled 标志）
        if not enabled and section not in ["chat", "embedding"]:
            return

        if mode == "custom" and not api_key:
            type_display = {
                "chat": "模型对话",
                "embedding": "向量化",
                "rerank": "重排序 (Rerank)",
                "vl": "视觉理解 (VL)",
            }.get(section, section)
            raise BadRequestException(f"已开启自定义{type_display}模式，但未配置 API Key。")

    @classmethod
    async def log_ai_stack(cls, tenant_id: int | None = None):
        """[✨ 亮点] 打印全量 AI 栈配置快照 (用于 Request 启动时)"""
        try:
            from app.core.common.masking import mask_sensitive_data

            stack = {}
            for section in ["chat", "embedding", "rerank", "vl"]:
                try:
                    conf = await cls.resolve_section(section, tenant_id)
                    stack[section] = mask_sensitive_data(conf)
                except Exception:
                    stack[section] = {"error": "Not configured"}

            target_display = f"Tenant {tenant_id}" if tenant_id else "Platform GLOBAL"

            # 构造精简的摘要表格/列表
            summary_lines = []
            for section, conf in stack.items():
                if "error" in conf:
                    summary_lines.append(f"   [{section:9}] -> ❌ 未配置")
                    continue

                provider = conf.get("provider", "N/A")
                model = conf.get("model", "N/A")
                eb = conf.get("extra_body")
                mode = conf.get("mode", "platform")
                h = conf.get("_hash", "N/A")[:8]

                eb_str = f" | Extra: {json.dumps(eb)}" if eb else ""
                summary_lines.append(
                    f"   [{section:9}] -> {provider:8} | {model:15} | Mode: {mode:8} | Hash: {h}{eb_str}"
                )

            pretty_stack = "\n".join(summary_lines)

            log_msg = (
                f"\n{'=' * 80}\n"
                f"🧠 [AI Context] -> 🚀 正在初始化推理引擎 (Request Session)\n"
                f"   - 目标范围: {target_display}\n"
                f"{pretty_stack}\n"
                f"{'=' * 80}"
            )
            logger.debug(log_msg)
        except Exception as e:
            logger.warning(f"⚠️ [ConfigResolver] 打印 AI 栈日志失败: {e}")
