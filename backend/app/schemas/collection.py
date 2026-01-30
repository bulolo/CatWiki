from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import BaseSchemaWithTimestamps


class CollectionBase(BaseModel):
    """合集基础 Schema"""
    title: str = Field(..., max_length=200, description="合集名称")
    site_id: int = Field(..., description="所属站点ID")
    parent_id: int | None = Field(None, description="父合集ID")
    order: int = Field(default=0, description="排序")


class CollectionCreate(CollectionBase):
    """创建合集"""
    pass


class CollectionUpdate(BaseModel):
    """更新合集"""
    title: str | None = Field(None, max_length=200)
    parent_id: int | None = None
    order: int | None = None


class Collection(CollectionBase, BaseSchemaWithTimestamps):
    """合集详情"""
    pass


class CollectionTree(BaseModel):
    """合集树形结构"""
    id: int
    title: str
    type: str = "collection"  # collection 或 document
    children: list[CollectionTree] | None = None
    status: str | None = None  # 文档状态（仅 document 类型）
    views: int | None = None  # 浏览量（仅 document 类型）
    tags: list[str] | None = None  # 标签（仅 document 类型）
    collection_id: int | None = None  # 文档所属合集ID（仅 document 类型）

    model_config = ConfigDict(from_attributes=True)


class MoveCollectionRequest(BaseModel):
    """移动合集请求"""
    target_parent_id: int | None = Field(None, description="目标父合集ID，null表示移到根级别")
    target_position: int = Field(..., ge=0, description="目标位置索引，0表示第一个")

