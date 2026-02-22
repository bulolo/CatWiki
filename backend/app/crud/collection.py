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

    def _apply_filters(
        self, query, site_id: int | None = None, parent_id: int | None | Any = _UNSET, **kwargs
    ):
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
        limit: int = 100,
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
            parent_id=parent_id,
        )

    async def get_descendant_ids(self, db: AsyncSession, *, collection_id: int) -> list[int]:
        """递归获取合集及其所有子合集的ID列表（使用 CTE 优化，并支持租户隔离）"""
        from sqlalchemy import text

        from app.core.infra.tenant import get_current_tenant

        tenant_id = get_current_tenant()
        tenant_filter = "AND tenant_id = :tid" if tenant_id is not None else ""

        # 使用 CTE 递归查询，一次 SQL 获取所有后代
        query = text(f"""
            WITH RECURSIVE descendants AS (
                SELECT id FROM collection WHERE id = :collection_id {tenant_filter}
                UNION ALL
                SELECT c.id FROM collection c
                INNER JOIN descendants d ON c.parent_id = d.id
                WHERE 1=1 {tenant_filter.replace("tenant_id", "c.tenant_id")}
            )
            SELECT id FROM descendants
        """)

        params = {"collection_id": collection_id}
        if tenant_id is not None:
            params["tid"] = tenant_id

        result = await db.execute(query, params)
        return [row[0] for row in result.fetchall()]

    async def get_path(self, db: AsyncSession, *, collection_id: int) -> str:
        """获取合集的完整路径（使用 CTE 优化，并支持租户隔离）"""
        from sqlalchemy import text

        from app.core.infra.tenant import get_current_tenant

        tenant_id = get_current_tenant()
        tenant_filter = "AND tenant_id = :tid" if tenant_id is not None else ""

        # 使用 CTE 递归查询，一次 SQL 获取整个祖先链
        query = text(f"""
            WITH RECURSIVE ancestors AS (
                SELECT id, title, parent_id, 0 as depth FROM collection
                WHERE id = :collection_id {tenant_filter}
                UNION ALL
                SELECT c.id, c.title, c.parent_id, a.depth + 1 FROM collection c
                INNER JOIN ancestors a ON c.id = a.parent_id
                WHERE 1=1 {tenant_filter.replace("tenant_id", "c.tenant_id")}
            )
            SELECT title FROM ancestors ORDER BY depth DESC
        """)

        params = {"collection_id": collection_id}
        if tenant_id is not None:
            params["tid"] = tenant_id

        result = await db.execute(query, params)
        path_parts = [row[0] for row in result.fetchall()]
        return " > ".join(path_parts)

    async def get_ancestors(self, db: AsyncSession, *, collection_id: int) -> list[dict]:
        """获取合集的祖先链（使用 CTE 优化，并支持租户隔离）"""
        from sqlalchemy import text

        from app.core.infra.tenant import get_current_tenant

        # 先获取当前合集的 parent_id
        current = await self.get(db, id=collection_id)
        if not current or not current.parent_id:
            return []

        tenant_id = get_current_tenant()
        tenant_filter = "AND tenant_id = :tid" if tenant_id is not None else ""

        # 使用 CTE 递归查询，一次 SQL 获取所有祖先
        query = text(f"""
            WITH RECURSIVE ancestors AS (
                SELECT id, title, parent_id, 0 as depth FROM collection
                WHERE id = :parent_id {tenant_filter}
                UNION ALL
                SELECT c.id, c.title, c.parent_id, a.depth + 1 FROM collection c
                INNER JOIN ancestors a ON c.id = a.parent_id
                WHERE 1=1 {tenant_filter.replace("tenant_id", "c.tenant_id")}
            )
            SELECT id, title FROM ancestors ORDER BY depth DESC
        """)

        params = {"parent_id": current.parent_id}
        if tenant_id is not None:
            params["tid"] = tenant_id

        result = await db.execute(query, params)
        return [{"id": row[0], "title": row[1]} for row in result.fetchall()]


crud_collection = CRUDCollection(Collection)
