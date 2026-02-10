from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.tenant import Tenant
from app.schemas.tenant import TenantCreate, TenantUpdate


class CRUDTenant(CRUDBase[Tenant, TenantCreate, TenantUpdate]):
    """租户 CRUD 操​​作"""

    async def get_by_slug(self, db: AsyncSession, *, slug: str) -> Optional[Tenant]:
        """根据 slug 获取租户"""
        result = await db.execute(select(Tenant).where(Tenant.slug == slug))
        return result.scalar_one_or_none()


crud_tenant = CRUDTenant(Tenant)
