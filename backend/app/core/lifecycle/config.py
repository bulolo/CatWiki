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

import json
import logging
from uuid import uuid4

from app.core.infra.config import (
    AI_CHAT_CONFIG_KEY,
    AI_EMBEDDING_CONFIG_KEY,
    AI_RERANK_CONFIG_KEY,
    AI_VL_CONFIG_KEY,
    DOC_PROCESSOR_CONFIG_KEY,
    settings,
)
from app.crud.system_config import crud_system_config
from app.db.database import AsyncSessionLocal
from app.schemas.system_config import DocProcessorConfig

logger = logging.getLogger(__name__)


def _get_default_tenant_id():
    """根据版本决定初始配置的归属：EE版作为平台全局配置(None)，CE版作为单租户配置(1)"""
    return None if settings.CATWIKI_EDITION == "enterprise" else 1


async def sync_ai_config_to_db():
    """
    将 .env 中的 AI 配置同步到数据库。
    规则：如果数据库中已存在 AI 配置，则跳过同步，以保护手动修改的配置。
    """
    tenant_id = _get_default_tenant_id()
    async with AsyncSessionLocal() as db:
        # 1. 检查数据库中是否已存在 AI 配置 (检查 Chat 即可代表系统已初始化)
        existing_config = await crud_system_config.get_by_key(
            db, config_key=AI_CHAT_CONFIG_KEY, tenant_id=tenant_id
        )

        # 如果存在且未开启强制覆盖，则跳过
        if existing_config and not settings.FORCE_UPDATE_AI_CONFIG:
            logger.info(
                "📡 [跳过] 数据库中已存在 AI 配置 (检测到 ai_chat)，且 FORCE_UPDATE_AI_CONFIG=False"
            )
            return

        if settings.FORCE_UPDATE_AI_CONFIG:
            logger.info(
                "⚠️ [强制覆盖] 检测到 FORCE_UPDATE_AI_CONFIG=True，将使用环境变量覆盖数据库配置"
            )

        # 从环境变量构建初始配置
        # 只有在提供了 API Key 的情况下才认为是有意义的配置
        # 解析额外参数
        extra_body = {}
        if settings.AI_CHAT_EXTRA_BODY:
            try:
                extra_body = json.loads(settings.AI_CHAT_EXTRA_BODY)
            except Exception as e:
                logger.warning(f"⚠️ 无法解析 AI_CHAT_EXTRA_BODY: {e}")

        ai_config = {
            "chat": {
                "provider": "openai",
                "model": settings.AI_CHAT_MODEL or "",
                "api_key": settings.AI_CHAT_API_KEY or "",
                "base_url": settings.AI_CHAT_API_BASE or "",
                "extra_body": extra_body,
                "mode": "custom",
            },
            "embedding": {
                "provider": "openai",
                "model": settings.AI_EMBEDDING_MODEL or "",
                "api_key": settings.AI_EMBEDDING_API_KEY or "",
                "base_url": settings.AI_EMBEDDING_API_BASE or "",
                "dimension": settings.AI_EMBEDDING_DIMENSION,
                "mode": "custom",
            },
            "rerank": {
                "provider": "openai",
                "model": settings.AI_RERANK_MODEL or "",
                "api_key": settings.AI_RERANK_API_KEY or "",
                "base_url": settings.AI_RERANK_API_BASE or "",
                "mode": "custom",
            },
            "vl": {
                "provider": "openai",
                "model": settings.AI_VL_MODEL or "",
                "api_key": settings.AI_VL_API_KEY or "",
                "base_url": settings.AI_VL_API_BASE or "",
                "mode": "custom",
            },
        }

        # 检查是否至少配置了一个关键变量（如 Chat API Key）
        if not any(
            [
                settings.AI_CHAT_API_KEY,
                settings.AI_EMBEDDING_API_KEY,
                settings.AI_RERANK_API_KEY,
                settings.AI_VL_API_KEY,
            ]
        ):
            logger.info("📡 [跳过] 未检测到 AI 相关的环境变量配置。")
            return

        # 3. 写入数据库 (物理隔离 Key)

        try:
            # 分别写入 4 个 Key
            configs_to_sync = {
                AI_CHAT_CONFIG_KEY: ai_config["chat"],
                AI_EMBEDDING_CONFIG_KEY: ai_config["embedding"],
                AI_RERANK_CONFIG_KEY: ai_config["rerank"],
                AI_VL_CONFIG_KEY: ai_config["vl"],
            }

            for key, value in configs_to_sync.items():
                await crud_system_config.update_by_key(
                    db, config_key=key, config_value=value, tenant_id=tenant_id
                )

            logger.info("📡 [同步] 已成功将环境变量中的 AI 配置加载到独立数据库 Key。")
        except Exception as e:
            logger.error(f"❌ [同步失败] 无法将 AI 配置同步到数据库: {e}")


async def sync_doc_processor_config_to_db():
    """
    将 .env 中的文档解析服务配置同步到数据库。
    """
    tenant_id = _get_default_tenant_id()
    async with AsyncSessionLocal() as db:
        # 1. 检查数据库中是否已存在
        existing_config = await crud_system_config.get_by_key(
            db, config_key=DOC_PROCESSOR_CONFIG_KEY, tenant_id=tenant_id
        )

        # 如果存在且未开启强制覆盖，则跳过
        if existing_config and not settings.FORCE_UPDATE_DOC_PROCESSOR:
            logger.info("📡 [跳过] 数据库中已存在文档解析配置，且 FORCE_UPDATE_DOC_PROCESSOR=False")
            return

        if settings.FORCE_UPDATE_DOC_PROCESSOR:
            logger.info(
                "⚠️ [强制覆盖] 检测到 FORCE_UPDATE_DOC_PROCESSOR=True，将使用环境变量覆盖数据库配置"
            )

        # 2. 提取现有配置中的 ID 以保持幂等性 (如果名字匹配，则复用其 ID)
        name_to_id = {}
        if existing_config and "processors" in existing_config.config_value:
            for p in existing_config.config_value["processors"]:
                if "name" in p and "id" in p:
                    name_to_id[p["name"]] = p["id"]

        # 3. 构建配置列表
        processors_list = []
        processor_defs = [
            {
                "name": settings.DOCLING_NAME,
                "type": "Docling",
                "base_url": settings.DOCLING_BASE_URL,
                "api_key": settings.DOCLING_API_KEY,
                "enabled": settings.DOCLING_ENABLED,
            },
            {
                "name": settings.MINERU_NAME,
                "type": "MinerU",
                "base_url": settings.MINERU_BASE_URL,
                "api_key": settings.MINERU_API_KEY,
                "enabled": settings.MINERU_ENABLED,
            },
            {
                "name": settings.PADDLEOCR_NAME,
                "type": "PaddleOCR",
                "base_url": settings.PADDLEOCR_BASE_URL,
                "api_key": settings.PADDLEOCR_API_KEY,
                "enabled": settings.PADDLEOCR_ENABLED,
            },
        ]

        for defn in processor_defs:
            if not defn["base_url"]:
                continue

            processors_list.append(
                DocProcessorConfig(
                    id=name_to_id.get(defn["name"]) or str(uuid4()),
                    name=defn["name"],
                    type=defn["type"],
                    base_url=defn["base_url"],
                    api_key=defn["api_key"] or "",
                    enabled=defn["enabled"],
                    config={"is_ocr": True, "extract_tables": True, "extract_images": False},
                ).model_dump(mode="json")
            )

        if not processors_list:
            logger.info(
                "📡 [跳过] 未检测到文档解析服务的相关环境变量 (DOCLING_BASE_URL/MINERU_BASE_URL/PADDLEOCR_BASE_URL)。"
            )
            return

        config_value = {"processors": processors_list}

        # 4. 写入数据库
        try:
            await crud_system_config.update_by_key(
                db,
                config_key=DOC_PROCESSOR_CONFIG_KEY,
                config_value=config_value,
                tenant_id=tenant_id,
            )
            logger.info("📡 [同步] 已成功将环境变量中的文档解析配置加载到数据库。")
        except Exception as e:
            logger.error(f"❌ [同步失败] 无法将文档解析配置同步到数据库: {e}")


async def init_system_configs():
    """初始化所有系统配置"""
    await sync_ai_config_to_db()
    await sync_doc_processor_config_to_db()

    # 启动后台监控任务 (moved to EE)
    # init_background_monitoring()
