from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

class TrendData(BaseModel):
    """趋势数据"""
    date: str
    sessions: int
    messages: int
    model_config = {"from_attributes": True}

class RecentSession(BaseModel):
    """最近会话简报"""
    thread_id: str
    title: str
    created_at: datetime
    message_count: int
    model_config = {"from_attributes": True}

class SiteStats(BaseModel):
    """站点统计数据"""

    # 基础统计
    total_documents: int = Field(description="文档总数")
    total_views: int = Field(description="总访问次数")

    # AI 统计
    total_chat_sessions: int = Field(0, description="AI会话总数")
    total_chat_messages: int = Field(0, description="AI消息总数")
    active_chat_users: int = Field(0, description="活跃AI用户数")
    new_sessions_today: int = Field(0, description="今日新增会话")
    new_messages_today: int = Field(0, description="今日新增消息")

    # 增强统计 (NEW)
    daily_trends: List[TrendData] = Field(default_factory=list, description="最近7天趋势")
    recent_sessions: List[RecentSession] = Field(default_factory=list, description="最近对话记录")

    model_config = {"from_attributes": True}

