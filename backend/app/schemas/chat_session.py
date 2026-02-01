"""Chat Session Schemas - 会话管理 API 数据模型"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class ChatSessionBase(BaseModel):
    """会话基础模型"""
    thread_id: str = Field(..., description="会话 thread_id")
    site_id: int = Field(..., description="站点ID")
    member_id: Optional[int] = Field(None, description="会员ID")
    title: Optional[str] = Field(None, description="会话标题")


class ChatSessionResponse(ChatSessionBase):
    """会话响应模型"""
    id: int
    last_message: Optional[str] = Field(None, description="最后消息预览")
    last_message_role: Optional[str] = Field(None, description="最后消息角色")
    message_count: int = Field(0, description="消息数量")
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ChatSessionListResponse(BaseModel):
    """会话列表响应"""
    items: list[ChatSessionResponse]
    total: int
    page: int
    size: int


class ChatSessionStatsResponse(BaseModel):
    """会话统计响应"""
    total_sessions: int = Field(..., description="总会话数")
    total_messages: int = Field(..., description="总消息数")
    active_users: int = Field(..., description="活跃用户数")
