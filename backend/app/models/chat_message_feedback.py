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

"""Chat Message Feedback - 助手消息的 👍/👎 反馈持久化。"""

from sqlalchemy import Column, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.models.base import BaseModel


class ChatMessageFeedback(BaseModel):
    """单个 assistant 消息上的反馈。

    一个访客（member_id）对同一条消息只有一份反馈：再次提交则 upsert，取消（rating=None）
    则 DELETE。前端调用 ``POST /v1/chat/feedback`` 时送 ``(thread_id, message_seq)``，
    后端解析为 ``chat_message_id`` 后落到这里——存的是 FK 而非 (thread_id, seq) 元组，
    让 admin 报表的 JOIN 走 PK 而非 LATERAL OFFSET。
    """

    __tablename__ = "chat_message_feedback"

    chat_message_id = Column(
        Integer,
        ForeignKey("chat_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="对应的助手消息行 ID",
    )
    member_id = Column(
        String(64),
        nullable=False,
        index=True,
        comment="访客/会员 ID（CE 阶段就是 visitor_id）",
    )
    rating = Column(String(8), nullable=False, comment="up | down")
    reason = Column(
        String(32),
        nullable=True,
        comment="差评原因：incorrect / irrelevant / incomplete / slow；rating=up 时为 null",
    )

    __table_args__ = (
        UniqueConstraint("chat_message_id", "member_id", name="uq_feedback_message_member"),
    )

    chat_message = relationship(
        "ChatMessage",
        primaryjoin="ChatMessageFeedback.chat_message_id == ChatMessage.id",
        foreign_keys=[chat_message_id],
    )

    def __repr__(self) -> str:
        return (
            f"<ChatMessageFeedback(id={self.id}, msg={self.chat_message_id}, rating={self.rating})>"
        )
