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

"""Chat Session Schemas - 会话管理 API 数据模型"""

from datetime import datetime
from typing import Optional, Union

from pydantic import BaseModel, Field


class ChatSessionBase(BaseModel):
    """会话基础模型"""

    thread_id: str = Field(..., description="会话 thread_id")
    site_id: int = Field(..., description="站点ID")
    member_id: Optional[str] = Field(None, description="会员ID或访客标识")
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
    """会话统计响应处理"""

    total_sessions: int = Field(..., description="总会话数")
    total_messages: int = Field(..., description="总消息数")
    active_users: int = Field(..., description="活跃用户数")


class ChatMessage(BaseModel):
    """单条消息模型（OpenAI 格式）"""

    role: str = Field(..., description="角色: user/assistant/system")
    content: Optional[str] = Field(None, description="内容，tool_call 时可能为空")
    id: Optional[str] = Field(None, description="消息ID")
    tool_calls: list[dict] = Field(default_factory=list, description="工具调用列表")
    tool_call_id: Optional[str] = Field(None, description="工具调用ID（role=tool时）")
    sources: Optional[list[dict]] = Field(None, description="引用来源列表（每条消息专属）")
    additional_kwargs: Optional[dict] = Field(None, description="其他元数据")


class ChatSessionMessagesResponse(BaseModel):
    """会话详细消息列表响应"""

    thread_id: str
    messages: list[ChatMessage]
    citations: list[dict] = Field(default_factory=list, description="引用来源列表")
