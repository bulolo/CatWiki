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

from sqlalchemy import JSON, Column, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Site(BaseModel):
    """站点模型"""

    __tablename__ = "sites"

    # 多租户
    tenant_id = Column(Integer, nullable=False, comment="所属租户ID")

    name = Column(String(100), nullable=False, index=True, comment="站点名称")
    slug = Column(String(200), nullable=False, unique=True, comment="站点标识")
    description = Column(Text, nullable=True, comment="站点描述")
    icon = Column(String(50), nullable=True, comment="图标名称")
    status = Column(
        String(20), default="active", nullable=False, comment="状态: active(激活), disabled(禁用)"
    )
    article_count = Column(Integer, default=0, nullable=False, comment="文章数量")
    theme_color = Column(String(50), nullable=True, default="blue", comment="主题色")
    layout_mode = Column(
        String(20), nullable=True, default="sidebar", comment="布局模式: sidebar, top"
    )
    quick_questions = Column(JSON, nullable=True, comment="快速问题配置，JSON数组格式")
    bot_config = Column(JSON, nullable=True, comment="机器人配置，包含网页挂件、API等")

    # 关系
    tenant = relationship(
        "Tenant",
        foreign_keys=[tenant_id],
        primaryjoin="Site.tenant_id == Tenant.id",
        back_populates="sites",
    )

    documents = relationship(
        "Document",
        primaryjoin="Site.id == Document.site_id",
        foreign_keys="[Document.site_id]",
        back_populates="site",
        cascade="all, delete-orphan",
    )

    collections = relationship(
        "Collection",
        primaryjoin="Site.id == Collection.site_id",
        foreign_keys="[Collection.site_id]",
        back_populates="site",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Site(id={self.id}, name='{self.name}')>"
