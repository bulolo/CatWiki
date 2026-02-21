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

"""
系统配置 CRUD 操作（异步版本）
"""

from __future__ import annotations

import logging

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.system_config import SystemConfig
from app.schemas.system_config import SystemConfigCreate, SystemConfigUpdate

logger = logging.getLogger(__name__)


class CRUDSystemConfig(CRUDBase[SystemConfig, SystemConfigCreate, SystemConfigUpdate]):
    """系统配置 CRUD 操作（异步版本）"""

    def _apply_filters(self, query, is_active: bool | None = None, **kwargs):
        """应用配置特有的过滤逻辑"""
        query = super()._apply_filters(query, **kwargs)

        if is_active is not None:
            query = query.where(self.model.is_active == is_active)

        return query

    async def get_by_key(
        self, db: AsyncSession, *, config_key: str, tenant_id: int | None = None
    ) -> SystemConfig | None:
        """根据配置键获取配置（若存在脏数据重复，返回最新一条并记录告警）。"""
        tenant_filter = (
            self.model.tenant_id.is_(None)
            if tenant_id is None
            else self.model.tenant_id == tenant_id
        )
        result = await db.execute(
            select(self.model)
            .where(self.model.config_key == config_key, tenant_filter)
            .order_by(
                self.model.updated_at.desc(), self.model.created_at.desc(), self.model.id.desc()
            )
            .limit(2)
        )
        rows = list(result.scalars())
        if len(rows) > 1:
            logger.warning(
                "system_config 出现重复 key，已回退使用最新一条: key=%s tenant_id=%s selected_id=%s",
                config_key,
                tenant_id,
                rows[0].id,
            )
        return rows[0] if rows else None

    async def list(
        self, db: AsyncSession, *, skip: int = 0, limit: int = 100, is_active: bool | None = None
    ) -> list[SystemConfig]:
        """获取配置列表"""
        query = select(self.model)
        query = self._apply_filters(query, is_active=is_active)
        query = query.order_by(self.model.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars())

    async def count(self, db: AsyncSession, *, is_active: bool | None = None) -> int:
        """统计配置数量"""
        query = select(func.count()).select_from(self.model)
        query = self._apply_filters(query, is_active=is_active)
        result = await db.execute(query)
        return result.scalar_one()

    async def update_by_key(
        self, db: AsyncSession, *, config_key: str, config_value: dict, tenant_id: int | None = None
    ) -> SystemConfig:
        """根据配置键更新配置（tenant_id 为 None 时避免重复写入）。"""
        from sqlalchemy.dialects.postgresql import insert

        # PostgreSQL 的唯一约束对 NULL 默认视为不相等，tenant_id=NULL 会绕过冲突检测。
        # 对平台级配置（tenant_id=None）采用“先查再改/插”避免重复行继续增长。
        if tenant_id is None:
            existing = await self.get_by_key(db, config_key=config_key, tenant_id=None)
            if existing:
                existing.config_value = config_value
                existing.is_active = True
                db.add(existing)
                await db.commit()
                await db.refresh(existing)
                return existing

            db_obj = SystemConfig(
                tenant_id=None,
                config_key=config_key,
                config_value=config_value,
                is_active=True,
            )
            db.add(db_obj)
            await db.commit()
            await db.refresh(db_obj)
            return db_obj

        stmt = insert(SystemConfig).values(
            tenant_id=tenant_id,
            config_key=config_key,
            config_value=config_value,
            is_active=True,
        )
        # 如果存在冲突 (uq_tenant_config_key: tenant_id + config_key)，则自动覆盖 config_value
        upsert_stmt = stmt.on_conflict_do_update(
            # PostgreSQL 约束索引可能会因为 tenant_id 允许为空而略有不同，但我们表结构里恰好有明确的复合理性约束
            # 如果 tenant_id 唯一约束不是标准的 null 兼容，我们使用 constraint="uq_tenant_config_key" 更好
            constraint="uq_tenant_config_key",
            set_=dict(config_value=stmt.excluded.config_value, updated_at=func.now()),
        ).returning(SystemConfig)

        result = await db.execute(upsert_stmt)
        await db.commit()
        db_config = result.scalar_one_or_none()

        if db_config:
            return db_config

        # fallback: 保证一定能够返回内容
        db_config = await self.get_by_key(db, config_key=config_key, tenant_id=tenant_id)
        return db_config

    async def delete_by_key(self, db: AsyncSession, *, config_key: str) -> bool:
        """根据配置键删除配置"""
        db_config = await self.get_by_key(db, config_key=config_key)
        if not db_config:
            return False

        await db.delete(db_config)
        await db.commit()
        return True


crud_system_config = CRUDSystemConfig(SystemConfig)
