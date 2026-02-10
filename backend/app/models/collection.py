# Copyright 2024 CatWiki Authors
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

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Collection(BaseModel):
    """文档合集模型"""

    # 多租户
    tenant_id = Column(Integer, nullable=False, index=True, comment="所属租户ID")

    title = Column(String(200), nullable=False, index=True, comment="合集名称")
    site_id = Column(Integer, nullable=False, index=True, comment="所属站点ID")
    parent_id = Column(Integer, nullable=True, index=True, comment="父合集ID")
    order = Column(Integer, default=0, nullable=False, comment="排序")

    # 关联（不使用外键约束，手动指定 foreign_keys 和 primaryjoin）
    site = relationship(
        "Site",
        foreign_keys=[site_id],
        primaryjoin="Collection.site_id==Site.id",
        backref="collections",
    )

    parent = relationship(
        "Collection",
        foreign_keys=[parent_id],
        primaryjoin="Collection.parent_id==Collection.id",
        remote_side="Collection.id",
        backref="children",
    )

    def __repr__(self) -> str:
        return f"<Collection(id={self.id}, title='{self.title}')>"
