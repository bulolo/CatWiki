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

from sqlalchemy import Column, DateTime, String, Integer
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class UserRole(str, enum.Enum):
    """用户角色枚举"""

    ADMIN = "admin"  # 平台管理员 (tenant_id 为空)
    TENANT_ADMIN = "tenant_admin"  # 租户管理员
    SITE_ADMIN = "site_admin"  # 站点管理员


class UserStatus(str, enum.Enum):
    """用户状态枚举"""

    ACTIVE = "active"  # 正常
    INACTIVE = "inactive"  # 禁用
    PENDING = "pending"  # 待激活


class User(BaseModel):
    """用户模型"""

    __tablename__ = "users"

    # 多租户
    tenant_id = Column(Integer, nullable=True, comment="所属租户ID(null=平台管理员)")

    # 基本信息
    name = Column(String(100), nullable=False, comment="用户名")
    email = Column(String(255), unique=True, nullable=False, index=True, comment="邮箱")
    password_hash = Column(String(255), nullable=False, comment="密码哈希")

    # 角色和权限
    role = Column(
        SQLEnum(UserRole, native_enum=False, length=20),
        default=UserRole.SITE_ADMIN,
        nullable=False,
        comment="用户角色",
    )

    # 状态
    status = Column(
        SQLEnum(UserStatus, native_enum=False, length=20),
        default=UserStatus.ACTIVE,
        nullable=False,
        comment="用户状态",
    )

    # 管理的站点（存储站点 ID 数组）
    # 注意：PostgreSQL 使用 ARRAY，其他数据库可能需要用 JSON
    managed_site_ids = Column(String(500), default="", comment="管理的站点ID列表，逗号分隔")

    # 登录信息
    last_login_at = Column(DateTime(timezone=True), nullable=True, comment="最后登录时间")
    last_login_ip = Column(String(50), nullable=True, comment="最后登录IP")

    # 头像
    avatar_url = Column(String(500), nullable=True, comment="头像URL")

    # 关系
    tenant = relationship(
        "Tenant",
        foreign_keys=[tenant_id],
        primaryjoin="User.tenant_id == Tenant.id",
        back_populates="users",
    )

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"

    @property
    def managed_sites(self) -> list[int]:
        """获取管理的站点ID列表"""
        if not self.managed_site_ids:
            return []
        return [int(sid) for sid in self.managed_site_ids.split(",") if sid.strip()]

    def set_managed_sites(self, site_ids: list[int]) -> None:
        """设置管理的站点ID列表"""
        self.managed_site_ids = ",".join(str(sid) for sid in site_ids)
