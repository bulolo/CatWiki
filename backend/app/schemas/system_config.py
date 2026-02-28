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

"""系统配置 Schema"""

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, alias_generators

# ============ 基础配置 Schema ============


class BaseConfigModel(BaseModel):
    """基础配置模型，严禁使用 camelCase，全程使用 snake_case"""

    model_config = ConfigDict(
        populate_by_name=True,
    )


# ============ AI 模型配置相关 Schema ============


class ModelConfig(BaseConfigModel):
    """单个模型配置"""

    provider: str = Field(..., description="模型提供商")
    model: str = Field(..., description="模型名称")
    api_key: str = Field(..., description="API Key")
    base_url: str = Field(..., description="API Base URL")
    dimension: int | None = Field(default=None, description="Embedding 维度 (自动探测)")
    mode: Literal["custom", "platform"] = Field(
        default="custom", description="配置模式: custom=自定义, platform=使用平台资源"
    )
    is_vision: bool = Field(default=False, description="是否支持视觉/多模态")
    extra_body: dict[str, Any] | None = Field(
        default=None,
        description='额外请求体参数 (例如: {"chat_template_kwargs": {"enable_thinking": true}})',
    )


class AIModelConfig(BaseConfigModel):
    """AI 模型完整配置 (扁平化结构)"""

    chat: ModelConfig = Field(..., description="对话模型配置")
    embedding: ModelConfig = Field(..., description="向量模型配置")
    rerank: ModelConfig = Field(..., description="重排序模型配置")
    vl: ModelConfig = Field(..., description="视觉模型配置")


# ============ 系统配置 CRUD Schema ============


class SystemConfigBase(BaseConfigModel):
    """系统配置基础 Schema"""

    config_key: str = Field(..., description="配置键")
    config_value: dict[str, Any] = Field(..., description="配置值")
    description: str | None = Field(None, description="配置描述")
    is_active: bool = Field(default=True, description="是否启用")


class SystemConfigCreate(SystemConfigBase):
    """创建系统配置"""

    pass


class SystemConfigUpdate(BaseConfigModel):
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


class AIConfigUpdate(BaseConfigModel):
    """更新 AI 配置"""

    chat: ModelConfig | None = Field(default=None, description="对话模型配置")
    embedding: ModelConfig | None = Field(default=None, description="向量模型配置")
    rerank: ModelConfig | None = Field(default=None, description="重排序模型配置")
    vl: ModelConfig | None = Field(default=None, description="视觉模型配置")


class TestConnectionRequest(BaseConfigModel):
    """测试连接请求"""

    model_type: Literal["chat", "embedding", "rerank", "vl"] = Field(..., description="模型类型")
    config: ModelConfig = Field(..., description="模型配置")


# ============ 机器人配置相关 Schema ============


class WebWidgetConfig(BaseConfigModel):
    """网页挂件配置"""

    enabled: bool = Field(default=False, description="是否启用")
    title: str = Field(default="AI 助手", description="挂件标题")
    welcome_message: str = Field(default="你好！有什么我可以帮你的吗？", description="欢迎语")
    primary_color: str = Field(default="#3b82f6", description="主题色")
    position: Literal["right", "left"] = Field(default="right", description="位置")


class ApiBotConfig(BaseConfigModel):
    """API 机器人配置"""

    enabled: bool = Field(default=False, description="是否启用")
    api_key: str = Field(default="", description="API Key")
    timeout: int = Field(default=30, description="超时时间(秒)")


class WecomSmartConfig(BaseConfigModel):
    """企业微信智能机器人配置"""

    enabled: bool = Field(default=False, description="是否启用")
    token: str = Field(default="", description="Token")
    encoding_aes_key: str = Field(default="", description="Encoding AES Key")


class WecomKefuConfig(BaseConfigModel):
    """企业微信客服配置"""

    enabled: bool = Field(default=False, description="是否启用")
    corp_id: str = Field(default="", description="企业ID")
    secret: str = Field(default="", description="Corp Secret")
    token: str = Field(default="", description="Token")
    encoding_aes_key: str = Field(default="", description="Encoding AES Key")
    welcome_message: str = Field(default="", description="欢迎语")


class WecomAppConfig(BaseConfigModel):
    """企业微信机器人(应用)配置"""

    enabled: bool = Field(default=False, description="是否启用")
    corp_id: str = Field(default="", description="企业ID")
    agent_id: str = Field(default="", description="应用 AgentId")
    secret: str = Field(default="", description="Secret")
    token: str = Field(default="", description="Token")
    encoding_aes_key: str = Field(default="", description="Encoding AES Key")


class FeishuAppConfig(BaseConfigModel):
    """飞书机器人配置"""

    enabled: bool = Field(default=False, description="是否启用")
    app_id: str = Field(default="", description="App ID")
    app_secret: str = Field(default="", description="App Secret")


class DingtalkAppConfig(BaseConfigModel):
    """钉钉机器人配置"""

    enabled: bool = Field(default=False, description="是否启用")
    client_id: str = Field(default="", description="Client ID")
    client_secret: str = Field(default="", description="Client Secret")
    template_id: str = Field(default="", description="消息模板 ID")


class BotConfig(BaseConfigModel):
    """机器人完整配置"""

    web_widget: WebWidgetConfig = Field(..., description="网页挂件配置")
    api_bot: ApiBotConfig = Field(..., description="API 机器人配置")
    wecom_smart: WecomSmartConfig = Field(
        default_factory=WecomSmartConfig, description="企业微信智能机器人配置"
    )
    wecom_kefu: WecomKefuConfig = Field(
        default_factory=WecomKefuConfig, description="企业微信客服配置"
    )
    wecom_app: WecomAppConfig = Field(
        default_factory=WecomAppConfig, description="企业微信机器人(应用)配置"
    )
    feishu_app: FeishuAppConfig = Field(
        default_factory=FeishuAppConfig, description="飞书机器人配置"
    )
    dingtalk_app: DingtalkAppConfig = Field(
        default_factory=DingtalkAppConfig, description="钉钉机器人配置"
    )


class BotConfigUpdate(BaseConfigModel):
    """更新机器人配置"""

    web_widget: WebWidgetConfig = Field(..., description="网页挂件配置")
    api_bot: ApiBotConfig = Field(..., description="API 机器人配置")
    wecom_smart: WecomSmartConfig = Field(..., description="企业微信智能机器人配置")
    wecom_kefu: WecomKefuConfig = Field(..., description="企业微信客服配置")
    wecom_app: WecomAppConfig = Field(..., description="企业微信机器人配置")
    feishu_app: FeishuAppConfig = Field(..., description="飞书机器人配置")
    dingtalk_app: DingtalkAppConfig = Field(..., description="钉钉机器人配置")


# ============ 文档处理服务配置相关 Schema ============


class DocProcessorType(str, Enum):
    """文档处理服务类型"""

    DOCLING = "Docling"
    MINERU = "MinerU"
    PADDLEOCR = "PaddleOCR"


class DocProcessorConfig(BaseConfigModel):
    """单个文档处理服务配置"""

    name: str = Field(..., description="服务名称（用于标识）")
    type: DocProcessorType = Field(..., description="服务类型")
    base_url: str = Field(..., description="API 端点地址")
    api_key: str = Field(default="", description="API 密钥（可选）")
    enabled: bool = Field(default=True, description="是否启用")
    config: dict[str, Any] = Field(default_factory=dict, description="额外配置（如 is_ocr）")


class DocProcessorsConfig(BaseConfigModel):
    """文档处理服务列表配置"""

    processors: list[DocProcessorConfig] = Field(default_factory=list, description="服务列表")


class DocProcessorsUpdate(BaseConfigModel):
    """更新文档处理服务配置"""

    processors: list[DocProcessorConfig] = Field(..., description="服务列表")


class TestDocProcessorRequest(BaseConfigModel):
    """测试文档处理服务连接请求"""

    config: DocProcessorConfig = Field(..., description="服务配置")
