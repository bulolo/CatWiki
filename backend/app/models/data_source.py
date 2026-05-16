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

from app.models.base import BaseModel


class DataSource(BaseModel):
    """数据源模型

    支持两种类型：
    - internal: 系统内置 RustFS，config 为空，使用系统配置
    - s3: 用户自定义外部 S3 兼容存储
    """

    __tablename__ = "data_sources"

    tenant_id = Column(Integer, nullable=False, index=True, comment="所属租户ID")
    name = Column(String(100), nullable=False, comment="数据源名称")
    type = Column(String(20), nullable=False, default="internal", comment="类型: internal | s3")
    description = Column(Text, nullable=True, comment="描述")
    config = Column(JSON, nullable=False, default=dict, comment="连接配置（外部S3凭证等）")

    def __repr__(self) -> str:
        return f"<DataSource(id={self.id}, name='{self.name}', type='{self.type}')>"
