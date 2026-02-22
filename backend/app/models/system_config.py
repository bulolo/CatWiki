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

"""系统配置模型"""

from sqlalchemy import Boolean, Column, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSON

from app.models.base import BaseModel


class SystemConfig(BaseModel):
    """系统配置表 - 存储 AI 模型、机器人等全局配置"""

    __tablename__ = "system_configs"

    # 多租户
    tenant_id = Column(Integer, nullable=True, comment="所属租户ID(null表示平台全局配置)")

    # 配置键（唯一标识）
    config_key = Column(
        String(100),
        nullable=False,
        index=True,
        comment="配置键，如 'ai_config'",
    )

    # 复合唯一约束
    __table_args__ = (UniqueConstraint("tenant_id", "config_key", name="uq_tenant_config_key"),)

    # 配置值（JSON 格式存储复杂配置）
    config_value = Column(JSON, nullable=False, default={}, comment="配置值（JSON 格式）")

    # 配置描述
    description = Column(String(500), nullable=True, comment="配置项描述")

    # 是否启用
    is_active = Column(Boolean, default=True, nullable=False, comment="是否启用该配置")

    def __repr__(self):
        return f"<SystemConfig(id={self.id}, key={self.config_key})>"
