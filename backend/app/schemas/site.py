from pydantic import BaseModel, Field

from app.schemas.base import BaseSchemaWithTimestamps


class QuickQuestion(BaseModel):
    """快速问题"""
    text: str = Field(..., description="问题内容")
    category: str | None = Field(None, description="问题分类")


class SiteBase(BaseModel):
    """站点基础 Schema"""
    name: str = Field(..., max_length=100, description="站点名称")
    domain: str | None = Field(None, max_length=200, description="站点域名")
    description: str | None = Field(None, description="站点描述")
    icon: str | None = Field(None, max_length=50, description="图标名称")
    status: str = Field(default="active", description="状态: active, draft")
    theme_color: str | None = Field(None, max_length=50, description="主题色")
    layout_mode: str | None = Field(None, max_length=20, description="布局模式: sidebar, top")
    quick_questions: list[QuickQuestion] | None = Field(None, description="快速问题配置")
    bot_config: dict | None = Field(None, description="机器人配置")


class SiteCreate(SiteBase):
    """创建站点"""
    admin_email: str | None = Field(None, description="管理员邮箱")
    admin_name: str | None = Field(None, description="管理员姓名")
    admin_password: str | None = Field(None, description="管理员密码")


class SiteUpdate(BaseModel):
    """更新站点"""
    name: str | None = Field(None, max_length=100)
    domain: str | None = Field(None, max_length=200)
    description: str | None = None
    icon: str | None = None
    status: str | None = None
    theme_color: str | None = Field(None, max_length=50)
    layout_mode: str | None = Field(None, max_length=20)
    quick_questions: list[QuickQuestion] | None = Field(None, description="快速问题配置")
    bot_config: dict | None = Field(None, description="机器人配置")


class Site(SiteBase, BaseSchemaWithTimestamps):
    """站点详情"""
    article_count: int = Field(default=0, description="文章数量")

