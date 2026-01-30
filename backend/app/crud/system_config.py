"""
系统配置 CRUD 操作（异步版本）
"""
from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.system_config import SystemConfig
from app.schemas.system_config import SystemConfigCreate, SystemConfigUpdate


class CRUDSystemConfig(CRUDBase[SystemConfig, SystemConfigCreate, SystemConfigUpdate]):
    """系统配置 CRUD 操作（异步版本）"""

    def _apply_filters(
        self,
        query,
        is_active: bool | None = None,
        **kwargs
    ):
        """应用配置特有的过滤逻辑"""
        query = super()._apply_filters(query, **kwargs)

        if is_active is not None:
            query = query.where(self.model.is_active == is_active)

        return query

    async def get_by_key(self, db: AsyncSession, *, config_key: str) -> SystemConfig | None:
        """根据配置键获取配置"""
        result = await db.execute(
            select(self.model).where(self.model.config_key == config_key)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        is_active: bool | None = None
    ) -> list[SystemConfig]:
        """获取配置列表"""
        query = select(self.model)
        query = self._apply_filters(query, is_active=is_active)
        query = query.order_by(self.model.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars())

    async def count(
        self,
        db: AsyncSession,
        *,
        is_active: bool | None = None
    ) -> int:
        """统计配置数量"""
        query = select(func.count()).select_from(self.model)
        query = self._apply_filters(query, is_active=is_active)
        result = await db.execute(query)
        return result.scalar_one()

    async def update_by_key(
        self,
        db: AsyncSession,
        *,
        config_key: str,
        config_value: dict
    ) -> SystemConfig:
        """根据配置键更新配置（如果不存在则创建）"""
        db_config = await self.get_by_key(db, config_key=config_key)

        if db_config:
            # 更新已有配置
            db_config.config_value = config_value
            await db.commit()
            await db.refresh(db_config)
            return db_config
        else:
            # 创建新配置
            db_config = SystemConfig(
                config_key=config_key,
                config_value=config_value,
                is_active=True,
            )
            db.add(db_config)
            await db.commit()
            await db.refresh(db_config)
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
