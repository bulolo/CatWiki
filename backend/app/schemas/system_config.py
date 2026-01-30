"""系统配置 Schema"""
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# ============ AI 模型配置相关 Schema ============

class ModelConfig(BaseModel):
    """单个模型配置"""
    provider: str = Field(..., description="模型提供商")
    model: str = Field(..., description="模型名称")
    apiKey: str = Field(..., description="API Key")
    baseUrl: str = Field(..., description="API Base URL")


class AutoModeModels(BaseModel):
    """自动模式下的模型选择"""
    chat: str = Field(..., description="对话模型")
    embedding: str = Field(..., description="向量模型")
    rerank: str = Field(..., description="重排序模型")
    vl: str = Field(..., description="视觉模型")


class AutoModeConfig(BaseModel):
    """自动模式配置"""
    provider: Literal["bailian", "openai", "deepseek"] = Field(..., description="预设提供商")
    apiKey: str = Field(..., description="API Key")
    models: AutoModeModels = Field(..., description="模型选择")


class ManualModeConfig(BaseModel):
    """手动模式配置"""
    chat: ModelConfig = Field(..., description="对话模型配置")
    embedding: ModelConfig = Field(..., description="向量模型配置")
    rerank: ModelConfig = Field(..., description="重排序模型配置")
    vl: ModelConfig = Field(..., description="视觉模型配置")


class AIModelConfig(BaseModel):
    """AI 模型完整配置"""
    mode: Literal["auto", "manual"] = Field(..., description="配置模式")
    autoConfig: AutoModeConfig = Field(..., description="自动模式配置")
    manualConfig: ManualModeConfig = Field(..., description="手动模式配置")


# ============ 机器人配置相关 Schema ============

class WebWidgetConfig(BaseModel):
    """网页挂件配置"""
    enabled: bool = Field(default=False, description="是否启用")
    title: str = Field(default="AI 客服助手", description="挂件标题")
    welcomeMessage: str = Field(default="您好！我是 AI 助手，有什么可以帮您？", description="欢迎语")
    primaryColor: str = Field(default="#3b82f6", description="主题色")
    position: Literal["left", "right"] = Field(default="right", description="显示位置")


class ApiBotConfig(BaseModel):
    """API 机器人配置"""
    enabled: bool = Field(default=False, description="是否启用")
    apiEndpoint: str = Field(default="", description="API 端点地址")
    apiKey: str = Field(default="", description="API Key")
    timeout: int = Field(default=30, ge=1, le=300, description="超时时间（秒）")


class WechatBotConfig(BaseModel):
    """微信公众号配置"""
    enabled: bool = Field(default=False, description="是否启用")
    appId: str = Field(default="", description="微信 AppID")
    appSecret: str = Field(default="", description="微信 AppSecret")
    token: str = Field(default="", description="微信 Token")
    encodingAESKey: str = Field(default="", description="微信 EncodingAESKey")


class BotConfig(BaseModel):
    """机器人完整配置"""
    webWidget: WebWidgetConfig = Field(..., description="网页挂件配置")
    apiBot: ApiBotConfig = Field(..., description="API 机器人配置")
    wechat: WechatBotConfig = Field(..., description="微信公众号配置")


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

    model_config = ConfigDict(from_attributes=True)


# ============ 特定配置的便捷 Schema ============

class AIConfigUpdate(BaseModel):
    """更新 AI 配置"""
    mode: Literal["auto", "manual"] = Field(..., description="配置模式")
    autoConfig: AutoModeConfig = Field(..., description="自动模式配置")
    manualConfig: ManualModeConfig = Field(..., description="手动模式配置")


class BotConfigUpdate(BaseModel):
    """更新机器人配置"""
    webWidget: WebWidgetConfig = Field(..., description="网页挂件配置")
    apiBot: ApiBotConfig = Field(..., description="API 机器人配置")
    wechat: WechatBotConfig = Field(..., description="微信公众号配置")

