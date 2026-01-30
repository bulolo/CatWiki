"""系统配置模型"""
from sqlalchemy import Boolean, Column, String
from sqlalchemy.dialects.postgresql import JSON

from app.models.base import BaseModel


class SystemConfig(BaseModel):
    """系统配置表 - 存储 AI 模型、机器人等全局配置"""

    __tablename__ = "system_configs"

    # 配置键（唯一标识）
    config_key = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        comment="配置键，如 'ai_config', 'bot_config'"
    )

    # 配置值（JSON 格式存储复杂配置）
    config_value = Column(
        JSON,
        nullable=False,
        default={},
        comment="配置值（JSON 格式）"
    )

    # 配置描述
    description = Column(
        String(500),
        nullable=True,
        comment="配置项描述"
    )

    # 是否启用
    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="是否启用该配置"
    )

    def __repr__(self):
        return f"<SystemConfig(id={self.id}, key={self.config_key})>"

