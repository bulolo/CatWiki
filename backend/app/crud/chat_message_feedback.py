# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""CRUD for ``chat_message_feedback``。

写路径只两个操作：upsert（按 ``(chat_message_id, member_id)`` 唯一约束）与
DELETE（撤销反馈）。读路径走 admin 报表/列表，逻辑放在管理端的 service 里。
"""

from __future__ import annotations

import logging

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_message_feedback import ChatMessageFeedback

logger = logging.getLogger(__name__)


async def upsert_feedback(
    db: AsyncSession,
    *,
    chat_message_id: int,
    member_id: str,
    rating: str,
    reason: str | None,
) -> ChatMessageFeedback:
    """按 (message_id, member_id) upsert。同一访客同一消息只会留一行。"""
    stmt = select(ChatMessageFeedback).where(
        ChatMessageFeedback.chat_message_id == chat_message_id,
        ChatMessageFeedback.member_id == member_id,
    )
    existing = (await db.execute(stmt)).scalar_one_or_none()

    if existing:
        existing.rating = rating
        existing.reason = reason
        await db.flush()
        return existing

    row = ChatMessageFeedback(
        chat_message_id=chat_message_id,
        member_id=member_id,
        rating=rating,
        reason=reason,
    )
    db.add(row)
    await db.flush()
    await db.refresh(row)
    return row


async def delete_feedback(
    db: AsyncSession,
    *,
    chat_message_id: int,
    member_id: str,
) -> int:
    """撤销反馈。返回删除的行数（0 或 1）。"""
    stmt = delete(ChatMessageFeedback).where(
        ChatMessageFeedback.chat_message_id == chat_message_id,
        ChatMessageFeedback.member_id == member_id,
    )
    result = await db.execute(stmt)
    return result.rowcount or 0
