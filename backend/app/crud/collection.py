from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.collection import Collection
from app.schemas.collection import CollectionCreate, CollectionUpdate

# 使用 Ellipsis 常量来区分 "不筛选" 和 "筛选 None"
_UNSET: Any = ...


class CRUDCollection(CRUDBase[Collection, CollectionCreate, CollectionUpdate]):
    """合集 CRUD 操作（异步版本）"""

    def _apply_filters(self, query, site_id: int | None = None, parent_id: int | None | Any = _UNSET, **kwargs):
        """应用合集特有的过滤逻辑"""
        query = super()._apply_filters(query, **kwargs)

        if site_id is not None:
            query = query.where(self.model.site_id == site_id)

        # parent_id 筛选
        if parent_id is not _UNSET:
            if parent_id is None:
                query = query.where(self.model.parent_id.is_(None))
            else:
                query = query.where(self.model.parent_id == parent_id)

        return query

    async def list(
        self,
        db: AsyncSession,
        *,
        site_id: int | None = None,
        parent_id: int | None | Any = _UNSET,
        skip: int = 0,
        limit: int = 100
    ) -> list[Collection]:
        """
        获取合集列表（支持 site_id, parent_id 过滤）
        """
        return await super().list(
            db,
            skip=skip,
            limit=limit,
            order_by="order",
            order_dir="asc",
            site_id=site_id,
            parent_id=parent_id
        )

    async def get_descendant_ids(self, db: AsyncSession, *, collection_id: int) -> list[int]:
        """递归获取合集及其所有子合集的ID列表（使用 CTE 优化）"""
        from sqlalchemy import text

        # 使用 CTE 递归查询，一次 SQL 获取所有后代
        query = text("""
            WITH RECURSIVE descendants AS (
                SELECT id FROM collection WHERE id = :collection_id
                UNION ALL
                SELECT c.id FROM collection c
                INNER JOIN descendants d ON c.parent_id = d.id
            )
            SELECT id FROM descendants
        """)

        result = await db.execute(query, {"collection_id": collection_id})
        return [row[0] for row in result.fetchall()]

    async def get_path(self, db: AsyncSession, *, collection_id: int) -> str:
        """获取合集的完整路径（使用 CTE 优化）"""
        from sqlalchemy import text

        # 使用 CTE 递归查询，一次 SQL 获取整个祖先链
        query = text("""
            WITH RECURSIVE ancestors AS (
                SELECT id, title, parent_id, 0 as depth FROM collection WHERE id = :collection_id
                UNION ALL
                SELECT c.id, c.title, c.parent_id, a.depth + 1 FROM collection c
                INNER JOIN ancestors a ON c.id = a.parent_id
            )
            SELECT title FROM ancestors ORDER BY depth DESC
        """)

        result = await db.execute(query, {"collection_id": collection_id})
        path_parts = [row[0] for row in result.fetchall()]
        return ' > '.join(path_parts)

    async def get_ancestors(self, db: AsyncSession, *, collection_id: int) -> list[dict]:
        """获取合集的祖先链（使用 CTE 优化）"""
        from sqlalchemy import text

        # 先获取当前合集的 parent_id
        current = await self.get(db, id=collection_id)
        if not current or not current.parent_id:
            return []

        # 使用 CTE 递归查询，一次 SQL 获取所有祖先
        query = text("""
            WITH RECURSIVE ancestors AS (
                SELECT id, title, parent_id, 0 as depth FROM collection WHERE id = :parent_id
                UNION ALL
                SELECT c.id, c.title, c.parent_id, a.depth + 1 FROM collection c
                INNER JOIN ancestors a ON c.id = a.parent_id
            )
            SELECT id, title FROM ancestors ORDER BY depth DESC
        """)

        result = await db.execute(query, {"parent_id": current.parent_id})
        return [{"id": row[0], "title": row[1]} for row in result.fetchall()]


crud_collection = CRUDCollection(Collection)
