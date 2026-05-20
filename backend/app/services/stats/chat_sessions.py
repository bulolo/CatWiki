# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""ChatSession 统计查询 —— stats 子包内的纯分析查询。

为什么不放在 ``chat/session.py``：统计是分析视角，本质是只读聚合查询；
``ChatSessionService`` 关心的是会话生命周期（CRUD + 访问控制）。把统计留在
那里会让 stats 服务反向依赖业务服务（DI 方向倒置）。

调用方：``stats/service.py`` 直接 import 这些函数，传入自己的 ``db`` 会话；
无 DI 类、无 ``self.db``，更易测试也更易复用。
"""

import logging
from datetime import datetime, timedelta

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_session import ChatSession

logger = logging.getLogger(__name__)


async def compute_chat_session_stats(db: AsyncSession, site_id: int | None = None) -> dict:
    """聚合一个站点（或全局）的 chat session 统计。

    返回的 dict 与原 ``ChatSessionService.get_stats`` 保持一致：
    total_sessions / total_messages / active_users / new_sessions_today /
    new_messages_today / daily_trends / recent_sessions。
    """
    overview = await _overview_stats(db, site_id)
    trends = await _trends(db, site_id)
    today = await _today_stats(db, site_id)
    recent = await _recent_sessions(db, site_id)

    return {
        "total_sessions": overview["total_sessions"],
        "total_messages": overview["total_messages"],
        "active_users": overview["active_users"],
        "new_sessions_today": today["new_sessions"],
        "new_messages_today": trends[-1]["messages"] if trends else 0,
        "daily_trends": trends,
        "recent_sessions": recent,
    }


# ──────────────────────────────────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────────────────────────────────


async def _overview_stats(db: AsyncSession, site_id: int | None) -> dict:
    """总会话数 / 总消息数 / 活跃用户数（distinct member_id）。"""

    def filtered(stmt):
        return stmt.where(ChatSession.site_id == site_id) if site_id is not None else stmt

    total_sessions = (await db.execute(filtered(select(func.count(ChatSession.id))))).scalar() or 0
    total_messages = (
        await db.execute(filtered(select(func.sum(ChatSession.message_count))))
    ).scalar() or 0
    active_users = (
        await db.execute(filtered(select(func.count(func.distinct(ChatSession.member_id)))))
    ).scalar() or 0

    return {
        "total_sessions": total_sessions,
        "total_messages": int(total_messages or 0),
        "active_users": active_users,
    }


async def _today_stats(db: AsyncSession, site_id: int | None) -> dict:
    """今天新建的会话数。"""
    now = datetime.now()
    start_of_day = datetime(now.year, now.month, now.day)

    query = select(func.count(ChatSession.id)).where(ChatSession.created_at >= start_of_day)
    if site_id is not None:
        query = query.where(ChatSession.site_id == site_id)

    new_sessions = (await db.execute(query)).scalar() or 0
    return {"new_sessions": new_sessions}


async def _trends(db: AsyncSession, site_id: int | None) -> list[dict]:
    """最近 7 天每日趋势：单条 ``GROUP BY date_trunc('day', ...)`` 一次拉齐。"""
    now = datetime.now()
    today_start = datetime(now.year, now.month, now.day)
    start = today_start - timedelta(days=6)
    end = today_start + timedelta(days=1)

    day_col = func.date_trunc("day", ChatSession.created_at).label("day")
    query = (
        select(
            day_col,
            func.count(ChatSession.id),
            func.coalesce(func.sum(ChatSession.message_count), 0),
        )
        .where(ChatSession.created_at >= start, ChatSession.created_at < end)
        .group_by(day_col)
    )
    if site_id is not None:
        query = query.where(ChatSession.site_id == site_id)

    result = await db.execute(query)
    bucket: dict[str, tuple[int, int]] = {}
    for day, sessions, messages in result.all():
        key = day.strftime("%Y-%m-%d") if day else ""
        bucket[key] = (int(sessions or 0), int(messages or 0))

    trends = []
    for i in range(6, -1, -1):
        day = today_start - timedelta(days=i)
        sessions, messages = bucket.get(day.strftime("%Y-%m-%d"), (0, 0))
        trends.append({"date": day.strftime("%m-%d"), "sessions": sessions, "messages": messages})

    logger.info(f"Calculated AI Stats Trends: {trends}")
    return trends


async def _recent_sessions(db: AsyncSession, site_id: int | None) -> list[dict]:
    """最近 5 条会话（按 created_at desc）。"""
    query = select(ChatSession).order_by(desc(ChatSession.created_at)).limit(5)
    if site_id is not None:
        query = query.where(ChatSession.site_id == site_id)

    result = await db.execute(query)
    sessions = result.scalars().all()

    return [
        {
            "thread_id": s.thread_id,
            "title": s.title,
            "created_at": s.created_at,
            "message_count": s.message_count,
            "source": s.source,
        }
        for s in sessions
    ]
