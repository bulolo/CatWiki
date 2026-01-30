from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Collection(BaseModel):
    """文档合集模型"""

    title = Column(String(200), nullable=False, index=True, comment="合集名称")
    site_id = Column(Integer, nullable=False, index=True, comment="所属站点ID")
    parent_id = Column(Integer, nullable=True, index=True, comment="父合集ID")
    order = Column(Integer, default=0, nullable=False, comment="排序")

    # 关联（不使用外键约束，手动指定 foreign_keys 和 primaryjoin）
    site = relationship(
        "Site",
        foreign_keys=[site_id],
        primaryjoin="Collection.site_id==Site.id",
        backref="collections"
    )

    parent = relationship(
        "Collection",
        foreign_keys=[parent_id],
        primaryjoin="Collection.parent_id==Collection.id",
        remote_side="Collection.id",
        backref="children"
    )

    def __repr__(self) -> str:
        return f"<Collection(id={self.id}, title='{self.title}')>"

