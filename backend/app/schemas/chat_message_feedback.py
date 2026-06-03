# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""Chat message feedback (👍/👎) 的 Pydantic schemas。

前端约定：``message_seq`` 是同一 thread 内 assistant 消息的 0-based 序号
（live 路径下前端自己累加；history 路径下按 formatHistoryMessages 渲染序）。
后端在 POST 入口把 ``(thread_id, message_seq)`` 解析为 ``chat_message_id``
后写库，让管理端报表走 PK JOIN。
"""

from typing import Literal

from pydantic import BaseModel, Field

Rating = Literal["up", "down"]
NegativeReason = Literal["incorrect", "irrelevant", "incomplete", "slow"]


class FeedbackSubmit(BaseModel):
    """POST /v1/chat/feedback 请求体。``rating=None`` 表示撤销反馈。"""

    thread_id: str = Field(..., description="会话 ID")
    message_seq: int = Field(..., ge=0, description="本 thread 内 assistant 消息的 0-based 序号")
    member_id: str = Field(..., max_length=64, description="访客/会员 ID")
    rating: Rating | None = Field(None, description="up / down / null（撤销）")
    reason: NegativeReason | None = Field(None, description="差评原因；仅 down 有意义")


class FeedbackOut(BaseModel):
    """POST 响应；撤销时 ``rating`` 为 null，前端按需更新本地 state。"""

    chat_message_id: int
    member_id: str
    rating: Rating | None
    reason: NegativeReason | None
