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

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.base import BaseSchemaWithTimestamps


class S3Config(BaseModel):
    """外部 S3 连接配置"""

    endpoint: str = Field(..., description="S3 端点，如 s3.amazonaws.com 或 minio.example.com:9000")
    bucket_name: str = Field(..., description="存储桶名称")
    access_key: str = Field(..., description="Access Key")
    secret_key: str = Field(..., description="Secret Key（保存后不回显）")
    use_ssl: bool = Field(default=True, description="是否使用 SSL")
    root_prefix: str = Field(default="", description="根路径前缀，限制浏览范围")


class DataSourceCreate(BaseModel):
    """创建数据源"""

    name: str = Field(..., max_length=100, description="数据源名称")
    type: Literal["internal", "s3"] = Field(..., description="类型: internal | s3")
    description: str | None = Field(None, description="描述")
    config: dict = Field(default_factory=dict, description="连接配置（external S3 时必填）")


class DataSourceUpdate(BaseModel):
    """更新数据源"""

    name: str | None = Field(None, max_length=100)
    description: str | None = None
    config: dict | None = None


class DataSource(BaseSchemaWithTimestamps):
    """数据源响应"""

    tenant_id: int
    name: str
    type: str
    description: str | None
    config: dict


class S3FileItem(BaseModel):
    """S3 文件/目录项"""

    name: str = Field(..., description="文件或目录名（不含路径）")
    path: str = Field(..., description="完整对象路径")
    type: Literal["file", "dir"] = Field(..., description="类型: file | dir")
    size: int | None = Field(None, description="文件大小（字节），目录为 None")
    last_modified: str | None = Field(None, description="最后修改时间（ISO格式）")


class UploadedFile(BaseModel):
    """上传到数据源后的响应"""

    key: str = Field(..., description="完整对象路径")
    name: str = Field(..., description="文件名（不含路径）")
    size: int = Field(..., description="字节数")


class DataSourceImportRequest(BaseModel):
    """从数据源导入文件请求"""

    keys: list[str] = Field(..., min_length=1, description="要导入的 S3 对象路径列表")
    site_id: int = Field(..., description="目标站点ID")
    collection_id: int = Field(..., description="目标合集ID")
    processor_type: str = Field(default="mineru", description="解析器类型")
    ocr_enabled: bool = Field(default=False, description="是否启用OCR")
    extract_images: bool = Field(default=False, description="是否提取图片")
    extract_tables: bool = Field(default=True, description="是否提取表格")
    duplicate_strategy: str = Field(default="skip", description="重复文件策略: skip | allow")
    generate_summary: bool = Field(default=False, description="是否AI生成摘要")
    generate_tags: bool = Field(default=False, description="是否AI生成标签")
    auto_vectorize: bool = Field(default=False, description="解析完成后是否自动入向量库")
