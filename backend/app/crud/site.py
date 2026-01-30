from __future__ import annotations

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.site import Site
from app.schemas.site import SiteCreate, SiteUpdate


class CRUDSite(CRUDBase[Site, SiteCreate, SiteUpdate]):
    """站点 CRUD 操作（异步版本）"""

    def _apply_filters(self, query, status: str | None = None):
        """应用通用的过滤条件"""
        if status is not None:
            query = query.where(self.model.status == status)
        return query

    async def create(self, db: AsyncSession, *, obj_in: SiteCreate) -> Site:
        """创建站点（过滤掉非模型字段）"""
        obj_in_data = obj_in.model_dump(exclude={"admin_email", "admin_name", "admin_password"})
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def get_by_name(self, db: AsyncSession, *, name: str) -> Site | None:
        """根据名称获取站点"""
        result = await db.execute(
            select(self.model).where(self.model.name == name)
        )
        return result.scalar_one_or_none()

    async def get_by_domain(self, db: AsyncSession, *, domain: str) -> Site | None:
        """根据域名获取站点"""
        result = await db.execute(
            select(self.model).where(self.model.domain == domain)
        )
        return result.scalar_one_or_none()

    async def increment_article_count(self, db: AsyncSession, *, site_id: int) -> None:
        """原子增加文章计数"""
        await db.execute(
            update(Site)
            .where(Site.id == site_id)
            .values(article_count=Site.article_count + 1)
        )
        await db.commit()

    async def decrement_article_count(self, db: AsyncSession, *, site_id: int) -> None:
        """原子减少文章计数"""
        await db.execute(
            update(Site)
            .where(Site.id == site_id)
            .where(Site.article_count > 0)
            .values(article_count=Site.article_count - 1)
        )
        await db.commit()

    async def remove_with_relationships(self, db: AsyncSession, *, id: int) -> bool:
        """删除站点及其所有关联数据（高性能批量删除）"""
        from app.models.collection import Collection
        from app.models.document import Document

        site = await self.get(db, id=id)
        if not site:
            return False

        # 批量删除文档
        await db.execute(delete(Document).where(Document.site_id == id))
        # 批量删除合集
        await db.execute(delete(Collection).where(Collection.site_id == id))
        # 删除站点
        await db.delete(site)

        await db.commit()
        return True


crud_site = CRUDSite(Site)
