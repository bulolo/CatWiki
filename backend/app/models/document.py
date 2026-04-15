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

import enum

from sqlalchemy import JSON, Column, DateTime, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class VectorStatus(str, enum.Enum):
    """向量化状态枚举"""

    NONE = "none"  # 未学习
    PENDING = "pending"  # 待学习（已排队）
    PROCESSING = "processing"  # 学习中
    COMPLETED = "completed"  # 已完成
    FAILED = "failed"  # 失败


class DocumentStatus(str, enum.Enum):
    """文档状态枚举"""

    DRAFT = "draft"  # 草稿
    PUBLISHED = "published"  # 已发布


class Document(BaseModel):
    """文档/文章模型"""

    # 多租户
    tenant_id = Column(Integer, nullable=False, index=True, comment="所属租户ID")

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
    status = Column(
        String(20),
        default=DocumentStatus.DRAFT.value,
        nullable=False,
        comment="状态: published, draft",
    )

    # 向量化状态
    vector_status = Column(
        String(20),
        default=VectorStatus.NONE.value,
        nullable=False,
        index=True,
        comment="向量化状态: none, pending, processing, completed, failed",
    )
    vector_error = Column(Text, nullable=True, comment="向量化失败错误信息")
    vectorized_at = Column(DateTime(timezone=True), nullable=True, comment="最后向量化完成时间")

    # 统计
    views = Column(Integer, default=0, nullable=False, comment="浏览量")
    reading_time = Column(Integer, default=0, nullable=False, comment="预计阅读时间(分钟)")

    # 标签 (JSON数组)
    tags = Column(JSON, nullable=True, default=list, comment="标签列表")

    # 解析元数据（导入时记录，用于排查）
    parse_meta = Column(
        JSON, nullable=True, comment="文档解析元数据：解析器类型、原始文件路径、耗时等"
    )

    # 关联（手动指定 foreign_keys 和 primaryjoin）
    site = relationship(
        "Site",
        foreign_keys=[site_id],
        primaryjoin="Document.site_id==Site.id",
        back_populates="documents",
    )

    collection = relationship(
        "Collection",
        foreign_keys=[collection_id],
        primaryjoin="Document.collection_id==Collection.id",
        backref="documents",
    )

    def __repr__(self) -> str:
        return f"<Document(id={self.id}, title='{self.title}')>"
