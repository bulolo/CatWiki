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

from sqlalchemy import JSON, Column, DateTime, Integer, String, Text
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class Tenant(BaseModel):
    """租户模型"""

    __tablename__ = "tenants"

    name = Column(String(100), nullable=False, comment="企业名称")
    slug = Column(String(50), nullable=False, unique=True, index=True, comment="URL标识(唯一)")
    domain = Column(String(200), nullable=True, unique=True, comment="自定义域名")
    logo_url = Column(String(500), nullable=True, comment="Logo URL")
    description = Column(Text, nullable=True, comment="企业描述")
    status = Column(
        String(20),
        nullable=False,
        default="trial",
        comment="租户状态: active, suspended, trial",
    )

    # 资源限制
    max_sites = Column(Integer, nullable=False, default=3, comment="最大站点数")
    max_documents = Column(Integer, nullable=False, default=1000, comment="最大文档数")
    max_storage_mb = Column(Integer, nullable=False, default=5120, comment="最大存储空间(MB)")
    max_users = Column(Integer, nullable=False, default=10, comment="最大用户数")

    # 订阅计划
    plan = Column(
        String(50),
        nullable=False,
        default="starter",
        comment="订阅计划: starter/pro/custom/demo",
    )
    plan_expires_at = Column(DateTime(timezone=True), nullable=False, comment="订阅到期时间")
    platform_resources_allowed = Column(
        JSON,
        nullable=False,
        default=list,
        comment="允许使用的平台资源列表: models, doc_processors",
    )

    # 联系信息
    contact_email = Column(String(255), nullable=True, comment="联系邮箱")
    contact_phone = Column(String(50), nullable=True, comment="联系电话")

    # 关系
    users = relationship(
        "User",
        primaryjoin="Tenant.id == User.tenant_id",
        foreign_keys="[User.tenant_id]",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )
    sites = relationship(
        "Site",
        primaryjoin="Tenant.id == Site.tenant_id",
        foreign_keys="[Site.tenant_id]",
        back_populates="tenant",
        cascade="all, delete-orphan",
    )

    @property
    def is_demo(self) -> bool:
        """是否为演示模式"""
        return self.plan == "demo"

    def __repr__(self) -> str:
        return f"<Tenant(id={self.id}, name='{self.name}', slug='{self.slug}')>"
