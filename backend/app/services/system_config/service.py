# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""SystemConfigService —— 系统配置 DI 入口（AI 模型 + 文档处理器）。

通过 mixin 组合把两个独立的配置域职责分散到同包内的独立文件：
- ``ai_config.AIConfigMixin``    —— chat / embedding / rerank 模型配置
- ``doc_processor.DocProcessorMixin`` —— 解析服务配置 (MinerU / Docling / 等)

本类只承担：DI 入口、通用 helper、跨域单 key 删除。
"""

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.common.i18n import _
from app.core.infra.tenant import get_current_tenant, temporary_tenant_context
from app.core.web.exceptions import NotFoundException
from app.crud.system_config import crud_system_config
from app.db.database import get_db
from app.db.transaction import transactional
from app.services.system_config.ai_config import AIConfigMixin
from app.services.system_config.doc_processor import DocProcessorMixin


class SystemConfigService(AIConfigMixin, DocProcessorMixin):
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def resolve_target_tenant_id(scope: str) -> int | None:
        """根据 scope 确定目标租户 ID。``platform`` 走全局；其它走当前租户上下文。"""
        if scope == "platform":
            return None
        return get_current_tenant()

    @transactional()
    async def delete_config(self, config_key: str, target_tenant_id: int | None) -> None:
        """删除指定配置（按 key + tenant 定位）。AI 与 DocProcessor 共用。"""
        with temporary_tenant_context(target_tenant_id):
            db_config = await crud_system_config.get_by_key(
                self.db, config_key=config_key, tenant_id=target_tenant_id
            )

        if not db_config:
            raise NotFoundException(detail=_("config.not_found", key=config_key))

        await self.db.delete(db_config)


def get_system_config_service(db: AsyncSession = Depends(get_db)) -> SystemConfigService:
    """FastAPI DI 工厂。"""
    return SystemConfigService(db)
