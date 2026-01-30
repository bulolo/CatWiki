import enum

from sqlalchemy import JSON, Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class VectorStatus(str, enum.Enum):
    """向量化状态枚举"""
    NONE = "none"              # 未学习
    PENDING = "pending"        # 待学习（已排队）
    PROCESSING = "processing"  # 学习中
    COMPLETED = "completed"    # 已完成
    FAILED = "failed"          # 失败


class DocumentStatus(str, enum.Enum):
    """文档状态枚举"""
    DRAFT = "draft"        # 草稿
    PUBLISHED = "published"  # 已发布


class Document(BaseModel):
    """文档/文章模型"""

    title = Column(String(200), nullable=False, index=True, comment="文章标题")
    content = Column(Text, nullable=True, comment="文章内容(Markdown)")
    summary = Column(Text, nullable=True, comment="文章摘要")
    cover_image = Column(String(500), nullable=True, comment="封面图片URL")

    # 关联字段（不使用外键约束）
    site_id = Column(Integer, nullable=False, index=True, comment="所属站点ID")
    collection_id = Column(Integer, nullable=True, index=True, comment="所属合集ID")

    # 分类和作者
    category = Column(String(100), nullable=True, comment="分类")
    author = Column(String(100), nullable=False, comment="作者")

    # 状态
    status = Column(String(20), default=DocumentStatus.DRAFT.value, nullable=False, comment="状态: published, draft")

    # 向量化状态
    vector_status = Column(String(20), default=VectorStatus.NONE.value, nullable=False, index=True, comment="向量化状态: none, pending, processing, completed, failed")
    vector_error = Column(Text, nullable=True, comment="向量化失败错误信息")
    vectorized_at = Column(DateTime(timezone=True), nullable=True, comment="最后向量化完成时间")

    # 统计
    views = Column(Integer, default=0, nullable=False, comment="浏览量")
    reading_time = Column(Integer, default=0, nullable=False, comment="预计阅读时间(分钟)")

    # 标签 (JSON数组)
    tags = Column(JSON, nullable=True, default=list, comment="标签列表")

    # 关联（手动指定 foreign_keys 和 primaryjoin）
    site = relationship(
        "Site",
        foreign_keys=[site_id],
        primaryjoin="Document.site_id==Site.id",
        backref="documents"
    )

    collection = relationship(
        "Collection",
        foreign_keys=[collection_id],
        primaryjoin="Document.collection_id==Collection.id",
        backref="documents"
    )

    def __repr__(self) -> str:
        return f"<Document(id={self.id}, title='{self.title}')>"

