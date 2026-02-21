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

"""Chat Message Model - 聊天记录全量存储表"""

from sqlalchemy import Column, ForeignKey, Integer, String, Text, JSON
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class ChatMessage(BaseModel):
    """聊天消息详情模型

    存储会话中的每一条原始消息，用于 UI 完整历史展示。
    与 ChatSession 通过 thread_id 逻辑映射，通过外键物理关联。
    """

    __tablename__ = "chat_messages"

    # 关联会话
    thread_id = Column(
        String(255),
        ForeignKey("chat_sessions.thread_id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # 消息角色: 'user', 'assistant', 'system', 'tool'
    role = Column(String(50), nullable=False)

    # 消息内容
    content = Column(Text, nullable=True)

    # 工具调用信息 (JSON 格式存储)
    tool_calls = Column(JSON, nullable=True)

    # 工具调用 ID (如果是 tool 角色消息)
    tool_call_id = Column(String(255), nullable=True)

    # 扩展信息 (如引用来源、Token 统计、节点信息等)
    additional_kwargs = Column(JSON, nullable=True)

    # 关联关系
    session = relationship(
        "ChatSession",
        back_populates="messages",
        primaryjoin="ChatMessage.thread_id == ChatSession.thread_id",
        foreign_keys=[thread_id],
    )

    def __repr__(self) -> str:
        return f"<ChatMessage(id={self.id}, thread_id={self.thread_id}, role={self.role})>"
