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

"""系统配置 Schema"""

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# ============ AI 模型配置相关 Schema ============


class ModelConfig(BaseModel):
    """单个模型配置"""

    provider: str = Field(..., description="模型提供商")
    model: str = Field(..., description="模型名称")
    apiKey: str = Field(..., description="API Key")
    baseUrl: str = Field(..., description="API Base URL")
    dimension: int | None = Field(default=None, description="Embedding 维度 (自动探测)")
    mode: Literal["custom", "platform"] = Field(
        default="custom", description="配置模式: custom=自定义, platform=使用平台资源"
    )


class AIModelConfig(BaseModel):
    """AI 模型完整配置 (扁平化结构)"""

    chat: ModelConfig = Field(..., description="对话模型配置")
    embedding: ModelConfig = Field(..., description="向量模型配置")
    rerank: ModelConfig = Field(..., description="重排序模型配置")
    vl: ModelConfig = Field(..., description="视觉模型配置")


# ============ 系统配置 CRUD Schema ============


class SystemConfigBase(BaseModel):
    """系统配置基础 Schema"""

    config_key: str = Field(..., description="配置键")
    config_value: dict[str, Any] = Field(..., description="配置值")
    description: str | None = Field(None, description="配置描述")
    is_active: bool = Field(default=True, description="是否启用")


class SystemConfigCreate(SystemConfigBase):
    """创建系统配置"""

    pass


class SystemConfigUpdate(BaseModel):
    """更新系统配置"""

    config_value: dict[str, Any] | None = Field(None, description="配置值")
    description: str | None = Field(None, description="配置描述")
    is_active: bool | None = Field(None, description="是否启用")


class SystemConfigResponse(SystemConfigBase):
    """系统配置响应"""

    id: int = Field(..., description="配置ID")
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    platform_defaults: dict[str, Any] | None = Field(
        default=None, description="平台默认配置(参考用)"
    )

    model_config = ConfigDict(from_attributes=True)


# ============ 特定配置的便捷 Schema ============


class AIConfigUpdate(BaseModel):
    """更新 AI 配置"""

    chat: ModelConfig = Field(..., description="对话模型配置")
    embedding: ModelConfig = Field(..., description="向量模型配置")
    rerank: ModelConfig = Field(..., description="重排序模型配置")
    vl: ModelConfig = Field(..., description="视觉模型配置")


class TestConnectionRequest(BaseModel):
    """测试连接请求"""

    model_type: Literal["chat", "embedding", "rerank", "vl"] = Field(..., description="模型类型")
    config: ModelConfig = Field(..., description="模型配置")


# ============ 文档处理服务配置相关 Schema ============


class DocProcessorType(str, Enum):
    """文档处理服务类型"""

    DOCLING = "Docling"
    MINERU = "MinerU"
    PADDLEOCR = "PaddleOCR"


class DocProcessorConfig(BaseModel):
    """单个文档处理服务配置"""

    name: str = Field(..., description="服务名称（用于标识）")
    type: DocProcessorType = Field(..., description="服务类型")
    baseUrl: str = Field(..., description="API 端点地址")
    apiKey: str = Field(default="", description="API 密钥（可选）")
    enabled: bool = Field(default=True, description="是否启用")
    config: dict[str, Any] = Field(default_factory=dict, description="额外配置（如 is_ocr）")


class DocProcessorsConfig(BaseModel):
    """文档处理服务列表配置"""

    processors: list[DocProcessorConfig] = Field(default_factory=list, description="服务列表")


class DocProcessorsUpdate(BaseModel):
    """更新文档处理服务配置"""

    processors: list[DocProcessorConfig] = Field(..., description="服务列表")


class TestDocProcessorRequest(BaseModel):
    """测试文档处理服务连接请求"""

    config: DocProcessorConfig = Field(..., description="服务配置")
