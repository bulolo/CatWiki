from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, load_only

from app.crud.base import CRUDBase
from app.models.document import Document, VectorStatus
from app.schemas.document import DocumentCreate, DocumentUpdate


class CRUDDocument(CRUDBase[Document, DocumentCreate, DocumentUpdate]):
    """文档 CRUD 操作（异步版本）"""

    async def create(self, db: AsyncSession, *, obj_in: DocumentCreate) -> Document:
        """创建文档（自动计算阅读时间）"""
        from app.core.reading_time import calculate_reading_time

        # 转换为字典
        obj_in_data = obj_in.model_dump()

        # 在创建之前计算阅读时间
        if obj_in_data.get('content'):
            obj_in_data['reading_time'] = calculate_reading_time(obj_in_data['content'])

        # 创建文档对象
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)

        return db_obj

    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: Document,
        obj_in: DocumentUpdate | dict[str, any]
    ) -> Document:
        """更新文档（自动计算阅读时间）"""
        from app.core.reading_time import calculate_reading_time

        # 转换为字典
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        # 如果更新了内容，在更新之前计算阅读时间
        if 'content' in update_data and update_data['content']:
            update_data['reading_time'] = calculate_reading_time(update_data['content'])

        # 应用更新
        for field, value in update_data.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)

        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)

        return db_obj

    def _apply_filters(
        self,
        query,
        site_id: int | None = None,
        collection_ids: list[int] | None = None,
        status: str | None = None,
        vector_status: str | None = None,
        keyword: str | None = None,
        **kwargs
    ):
        """应用文档特有的过滤逻辑"""
        query = super()._apply_filters(query, **kwargs)

        if site_id is not None:
            query = query.where(self.model.site_id == site_id)
        if collection_ids is not None:
            query = query.where(self.model.collection_id.in_(collection_ids))
        if status is not None:
            query = query.where(self.model.status == status)
        if vector_status is not None:
            query = query.where(self.model.vector_status == vector_status)
        
        # 关键词搜索（支持 title, content, summary）
        if keyword:
            query = query.where(
                or_(
                    self.model.title.ilike(f"%{keyword}%"),
                    self.model.content.ilike(f"%{keyword}%"),
                    self.model.summary.ilike(f"%{keyword}%")
                )
            )

        return query

    def _get_base_list_query(self, conditions=None):
        """基础查询：只加载列表/树形展示需要的字段（不含content）"""
        query = select(self.model).options(
            load_only(
                self.model.id,
                self.model.title,
                self.model.summary,
                self.model.cover_image,
                self.model.site_id,
                self.model.collection_id,
                self.model.category,
                self.model.author,
                self.model.status,
                self.model.vector_status,
                self.model.vector_error,
                self.model.vectorized_at,
                self.model.tags,
                self.model.views,
                self.model.reading_time,
                self.model.created_at,
                self.model.updated_at
            )
        )
        if conditions is not None:
            query = query.where(conditions)
        return query

    async def list(
        self,
        db: AsyncSession,
        *,
        site_id: int | None = None,
        collection_ids: list[int] | None = None,
        status: str | None = None,
        vector_status: str | None = None,
        keyword: str | None = None,
        skip: int = 0,
        limit: int | None = 100,
        order_by: str | None = None,
        order_dir: str = "desc"
    ) -> list[Document]:
        """
        获取文档列表（不含content，用于列表展示）
        """
        # 使用基础字段查询
        query = self._get_base_list_query()

        # 应用过滤
        query = self._apply_filters(
            query,
            site_id=site_id,
            collection_ids=collection_ids,
            status=status,
            vector_status=vector_status,
            keyword=keyword
        )

        # 动态排序 (如果未指定排序，且正在搜索，通常按相关性或最新排序，这里暂保持默认排序)
        if order_by == "views":
            order_col = self.model.views
        elif order_by == "created_at":
            order_col = self.model.created_at
        else:
            order_col = self.model.updated_at  # 默认按更新时间

        if order_dir == "asc":
            query = query.order_by(order_col.asc())
        else:
            query = query.order_by(order_col.desc())

        query = query.offset(skip)
        if limit is not None:
            query = query.limit(limit)

        result = await db.execute(query)
        return list(result.scalars())

    async def increment_views(self, db: AsyncSession, *, document_id: int) -> Document | None:
        """增加浏览量（不更新 updated_at）"""
        # 使用原生 SQL 更新，确保只更新 views 字段，不触发 ORM 的 onupdate
        await db.execute(
            text("UPDATE document SET views = views + 1 WHERE id = :id"),
            {"id": document_id}
        )
        await db.commit()

        # 返回更新后的文档
        return await self.get_with_related_site(db, id=document_id)

    async def get_with_related_site(self, db: AsyncSession, id: int) -> Document | None:
        """获取文档及其关联的站点信息（使用预加载优化）"""
        result = await db.execute(
            select(self.model)
            .options(joinedload(self.model.site))
            .where(self.model.id == id)
        )
        return result.scalar_one_or_none()

    async def get_site_stats(self, db: AsyncSession, *, site_id: int) -> dict[str, int]:
        """获取站点统计信息
        
        返回:
            {
                "total_documents": 文档总数,
                "total_views": 总访问次数
            }
        """
        # 一次查询统计文档总数和总访问次数
        result = await db.execute(
            select(
                func.count(self.model.id),
                func.coalesce(func.sum(self.model.views), 0)
            )
            .where(self.model.site_id == site_id)
        )
        total_documents, total_views = result.one()

        return {
            "total_documents": total_documents,
            "total_views": total_views
        }

    async def update_vector_status(
        self,
        db: AsyncSession,
        *,
        document_id: int,
        status: str,
        error: str | None = None
    ) -> Document | None:
        """更新文档的向量化状态

        Args:
            document_id: 文档ID
            status: 新状态 (none, pending, processing, completed, failed)
            error: 错误信息（仅在 failed 状态时有效）
        """
        document = await self.get(db, id=document_id)
        if not document:
            return None

        document.vector_status = status
        document.vector_error = error if status == VectorStatus.FAILED else None

        # 如果完成，记录完成时间
        if status == VectorStatus.COMPLETED:
            document.vectorized_at = datetime.now(UTC)

        db.add(document)
        await db.commit()
        await db.refresh(document)
        return document

    async def batch_update_vector_status(
        self,
        db: AsyncSession,
        *,
        document_ids: list[int],
        status: str
    ) -> int:
        """批量更新文档的向量化状态

        Args:
            document_ids: 文档ID列表
            status: 新状态

        Returns:
            更新的文档数量
        """
        result = await db.execute(
            update(self.model)
            .where(self.model.id.in_(document_ids))
            .values(vector_status=status, vector_error=None)
        )
        await db.commit()
        return result.rowcount


crud_document = CRUDDocument(Document)
