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

import logging
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.infra.config import settings, AI_CONFIG_KEY, DOC_PROCESSOR_CONFIG_KEY
from app.crud.system_config import crud_system_config
from app.db.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


async def sync_ai_config_to_db():
    """
    将 .env 中的 AI 配置同步到数据库。
    规则：如果数据库中已存在 AI 配置，则跳过同步，以保护手动修改的配置。
    """
    # 根据版本决定初始配置的归属：EE版作为平台全局配置(None)，CE版作为单租户配置(1)
    tenant_id = None if settings.CATWIKI_EDITION == "enterprise" else 1
    async with AsyncSessionLocal() as db:
        # 1. 检查数据库中是否已存在 AI 配置
        existing_config = await crud_system_config.get_by_key(
            db, config_key=AI_CONFIG_KEY, tenant_id=tenant_id
        )

        # 如果存在且未开启强制覆盖，则跳过
        if existing_config and not settings.FORCE_UPDATE_AI_CONFIG:
            logger.info("📡 [跳过] 数据库中已存在 AI 配置，且 FORCE_UPDATE_AI_CONFIG=False")
            return

        if settings.FORCE_UPDATE_AI_CONFIG:
            logger.info(
                "⚠️ [强制覆盖] 检测到 FORCE_UPDATE_AI_CONFIG=True，将使用环境变量覆盖数据库配置"
            )

        # 2. 从环境变量构建初始配置
        # 只有在提供了 API Key 的情况下才认为是有意义的配置
        ai_config = {
            "chat": {
                "provider": "openai",
                "model": settings.AI_CHAT_MODEL or "",
                "apiKey": settings.AI_CHAT_API_KEY or "",
                "baseUrl": settings.AI_CHAT_API_BASE or "",
                "mode": "custom",
            },
            "embedding": {
                "provider": "openai",
                "model": settings.AI_EMBEDDING_MODEL or "",
                "apiKey": settings.AI_EMBEDDING_API_KEY or "",
                "baseUrl": settings.AI_EMBEDDING_API_BASE or "",
                "dimension": settings.AI_EMBEDDING_DIMENSION,
                "mode": "custom",
            },
            "rerank": {
                "provider": "openai",
                "model": settings.AI_RERANK_MODEL or "",
                "apiKey": settings.AI_RERANK_API_KEY or "",
                "baseUrl": settings.AI_RERANK_API_BASE or "",
                "mode": "custom",
            },
            "vl": {
                "provider": "openai",
                "model": settings.AI_VL_MODEL or "",
                "apiKey": settings.AI_VL_API_KEY or "",
                "baseUrl": settings.AI_VL_API_BASE or "",
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

        # 3. 写入数据库
        try:
            await crud_system_config.update_by_key(
                db, config_key=AI_CONFIG_KEY, config_value=ai_config, tenant_id=tenant_id
            )
            logger.info("📡 [同步] 已成功将环境变量中的 AI 配置加载到数据库。")
        except Exception as e:
            logger.error(f"❌ [同步失败] 无法将 AI 配置同步到数据库: {e}")


async def sync_doc_processor_config_to_db():
    """
    将 .env 中的文档解析服务配置同步到数据库。
    """
    # 根据版本决定初始配置的归属：EE版作为平台全局配置(None)，CE版作为单租户配置(1)
    tenant_id = None if settings.CATWIKI_EDITION == "enterprise" else 1
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

        # 2. 构建配置列表
        processors_list = []

        # (1) Docling 配置
        if settings.DOCLING_BASE_URL:
            processors_list.append(
                {
                    "name": settings.DOCLING_NAME,
                    "type": "Docling",
                    "baseUrl": settings.DOCLING_BASE_URL,
                    "apiKey": settings.DOCLING_API_KEY or "",
                    "enabled": settings.DOCLING_ENABLED,
                    "config": {"is_ocr": True, "extract_tables": True, "extract_images": False},
                }
            )

        # (2) Mineru 配置
        if settings.MINERU_BASE_URL:
            processors_list.append(
                {
                    "name": settings.MINERU_NAME,
                    "type": "MinerU",
                    "baseUrl": settings.MINERU_BASE_URL,
                    "apiKey": settings.MINERU_API_KEY or "",
                    "enabled": settings.MINERU_ENABLED,
                    "config": {"is_ocr": True, "extract_tables": True, "extract_images": False},
                }
            )

        # (3) PaddleOCR 配置
        if settings.PADDLEOCR_BASE_URL:
            processors_list.append(
                {
                    "name": settings.PADDLEOCR_NAME,
                    "type": "PaddleOCR",
                    "baseUrl": settings.PADDLEOCR_BASE_URL,
                    "apiKey": settings.PADDLEOCR_API_KEY or "",
                    "enabled": settings.PADDLEOCR_ENABLED,
                    "config": {"is_ocr": True, "extract_tables": True, "extract_images": False},
                }
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
