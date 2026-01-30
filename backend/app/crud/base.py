"""
CRUD 基类 - 简化数据库操作（异步版本）
"""
from typing import Any, Generic, TypeVar

from pydantic import BaseModel
from sqlalchemy import exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """CRUD 基类（异步版本）"""

    def __init__(self, model: type[ModelType]):
        """
        CRUD 对象初始化

        参数:
            model: SQLAlchemy 模型类
        """
        self.model = model
        self.primary_key = "id"  # 默认主键名为 id

    def _apply_filters(self, query, **kwargs):
        """
        子类重写此方法以应用特定的过滤逻辑。
        默认实现：尝试根据关键字进行精确匹配。
        """
        for key, value in kwargs.items():
            if value is not None and hasattr(self.model, key):
                query = query.where(getattr(self.model, key) == value)
        return query

    async def get(self, db: AsyncSession, id: Any) -> ModelType | None:
        """
        根据 ID 获取记录

        参数:
            db: 数据库会话
            id: 记录 ID

        返回:
            模型实例或 None
        """
        result = await db.execute(
            select(self.model).where(getattr(self.model, self.primary_key) == id)
        )
        return result.scalar_one_or_none()

    async def get_multi(self, db: AsyncSession, *, ids: list[Any]) -> list[ModelType]:
        """
        根据 ID 列表批量获取记录

        参数:
            db: 数据库会话
            ids: 记录 ID 列表

        返回:
            模型实例列表
        """
        if not ids:
            return []

        result = await db.execute(
            select(self.model).where(getattr(self.model, self.primary_key).in_(ids))
        )
        return list(result.scalars())

    async def list(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        order_by: str | None = None,
        order_dir: str = "desc",
        **kwargs,
    ) -> list[ModelType]:
        """
        获取多条记录

        参数:
            db: 数据库会话
            skip: 跳过的记录数
            limit: 返回的最大记录数
            order_by: 排序字段
            order_dir: 排序方向 (asc/desc)
            **kwargs: 过滤参数
        """
        query = select(self.model)
        query = self._apply_filters(query, **kwargs)

        # 排序
        if order_by and hasattr(self.model, order_by):
            from sqlalchemy import asc, desc
            order_col = getattr(self.model, order_by)
            if order_dir.lower() == "asc":
                query = query.order_by(asc(order_col))
            else:
                query = query.order_by(desc(order_col))
        elif hasattr(self.model, "created_at"):
            from sqlalchemy import desc
            query = query.order_by(desc(self.model.created_at))

        result = await db.execute(
            query.offset(skip).limit(limit)
        )
        return list(result.scalars())

    async def create(self, db: AsyncSession, *, obj_in: CreateSchemaType) -> ModelType:
        """
        创建记录

        参数:
            db: 数据库会话
            obj_in: 创建数据

        返回:
            创建的模型实例
        """
        obj_in_data = obj_in.model_dump()
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: ModelType,
        obj_in: UpdateSchemaType | dict[str, Any],
    ) -> ModelType:
        """
        更新记录

        参数:
            db: 数据库会话
            db_obj: 要更新的模型实例
            obj_in: 更新数据

        返回:
            更新后的模型实例
        """
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)

        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def delete(self, db: AsyncSession, *, id: Any) -> ModelType | None:
        """
        删除记录

        参数:
            db: 数据库会话
            id: 记录 ID

        返回:
            删除的模型实例或 None
        """
        obj = await self.get(db, id=id)
        if obj:
            await db.delete(obj)
            await db.commit()
        return obj

    async def count(self, db: AsyncSession, **kwargs) -> int:
        """
        获取记录总数

        参数:
            db: 数据库会话
            **kwargs: 过滤参数

        返回:
            记录总数
        """
        query = select(func.count()).select_from(self.model)
        query = self._apply_filters(query, **kwargs)
        result = await db.execute(query)
        return result.scalar_one()

    async def exists(self, db: AsyncSession, id: Any) -> bool:
        """
        检查记录是否存在（优化：只查询 ID，不加载整个对象）

        参数:
            db: 数据库会话
            id: 记录 ID

        返回:
            是否存在
        """
        result = await db.execute(
            select(exists().where(getattr(self.model, self.primary_key) == id))
        )
        return result.scalar()
