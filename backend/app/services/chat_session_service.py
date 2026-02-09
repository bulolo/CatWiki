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

"""ChatSession Service - 会话管理服务"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import desc, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_session import ChatSession
from app.core.checkpointer import get_checkpointer
from app.core.graph import langchain_to_openai

logger = logging.getLogger(__name__)


class ChatSessionService:
    """会话管理服务

    提供会话的 CRUD 操作，与 LangGraph Checkpointer 配合使用。
    """

    @staticmethod
    async def create_or_update(
        db: AsyncSession,
        thread_id: str,
        site_id: int,
        user_message: str,
        member_id: Optional[str] = None,
    ) -> ChatSession:
        """创建或更新会话记录

        Args:
            member_id: 会员ID或访客ID（可选）
        """
        try:
            # 1. 尝试查找现有会话
            result = await db.execute(select(ChatSession).where(ChatSession.thread_id == thread_id))
            session = result.scalar_one_or_none()

            if session:
                # 更新现有会话
                session.last_message = user_message[:200]
                session.last_message_role = "user"
                session.message_count += 1
                if member_id is not None:
                    session.member_id = member_id
                logger.info(
                    f"📝 [ChatSession] Updated: thread_id={thread_id}, count={session.message_count}"
                )
                await db.commit()
                await db.refresh(session)
            else:
                # 创建新会话
                session = ChatSession(
                    thread_id=thread_id,
                    site_id=site_id,
                    member_id=member_id,
                    title=user_message[:50] if user_message else "新对话",
                    last_message=user_message[:200],
                    last_message_role="user",
                    message_count=1,
                )
                db.add(session)
                try:
                    await db.commit()
                    await db.refresh(session)
                    logger.info(
                        f"✨ [ChatSession] Created: thread_id={thread_id}, site_id={site_id}"
                    )
                except IntegrityError:
                    # 并发冲突：可能在查询后被其他请求创建了
                    await db.rollback()
                    logger.warning(
                        f"⚠️ [ChatSession] Concurrent creation detected for {thread_id}, retrying as update."
                    )
                    return await ChatSessionService.create_or_update(
                        db, thread_id, site_id, user_message, member_id
                    )

            return session

        except Exception as e:
            logger.error(f"❌ [ChatSession] Error in create_or_update: {e}")
            raise

    @staticmethod
    async def update_assistant_response(
        db: AsyncSession,
        thread_id: str,
        assistant_message: str,
    ) -> Optional[ChatSession]:
        """更新助手回复

        在助手回复完成后调用，更新 last_message。
        使用原子更新以避免计数器并发问题。

        Args:
            db: 数据库会话
            thread_id: LangGraph thread_id
            assistant_message: 助手回复内容

        Returns:
            ChatSession 实例，如果不存在返回 None
        """
        # 原子更新 message_count
        await db.execute(
            update(ChatSession)
            .where(ChatSession.thread_id == thread_id)
            .values(
                last_message=assistant_message[:200],
                last_message_role="assistant",
                message_count=ChatSession.message_count + 1,
            )
        )
        await db.commit()

        # 获取更新后的对象返回
        result = await db.execute(select(ChatSession).where(ChatSession.thread_id == thread_id))
        session = result.scalar_one_or_none()

        if session:
            logger.info(f"💬 [ChatSession] Assistant response updated: thread_id={thread_id}")

        return session

    @staticmethod
    async def list_sessions(
        db: AsyncSession,
        site_id: Optional[int] = None,
        member_id: Optional[str] = None,
        keyword: Optional[str] = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[ChatSession], int]:
        """获取会话列表

        Args:
            member_id: 会员ID或访客ID（可选，过滤）
            keyword: 搜索关键词（可选，匹配标题或最后消息）
        """
        from sqlalchemy import or_

        query = select(ChatSession)
        count_query = select(func.count(ChatSession.id))

        if site_id is not None:
            query = query.where(ChatSession.site_id == site_id)
            count_query = count_query.where(ChatSession.site_id == site_id)

        if member_id is not None:
            query = query.where(ChatSession.member_id == member_id)
            count_query = count_query.where(ChatSession.member_id == member_id)

        # 关键词搜索：匹配标题或最后消息
        if keyword:
            keyword_filter = or_(
                ChatSession.title.ilike(f"%{keyword}%"),
                ChatSession.last_message.ilike(f"%{keyword}%"),
            )
            query = query.where(keyword_filter)
            count_query = count_query.where(keyword_filter)

        # 按更新时间倒序
        query = query.order_by(desc(ChatSession.updated_at))

        # 分页
        offset = (page - 1) * size
        query = query.offset(offset).limit(size)

        result = await db.execute(query)
        sessions = list(result.scalars().all())

        count_result = await db.execute(count_query)
        total = count_result.scalar() or 0

        return sessions, total

    @staticmethod
    async def get_by_thread_id(
        db: AsyncSession,
        thread_id: str,
    ) -> Optional[ChatSession]:
        """根据 thread_id 获取会话

        Args:
            db: 数据库会话
            thread_id: LangGraph thread_id

        Returns:
            ChatSession 实例，如果不存在返回 None
        """
        result = await db.execute(select(ChatSession).where(ChatSession.thread_id == thread_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_session_messages(
        thread_id: str,
    ) -> dict:
        """从 LangGraph Checkpointer 获取对话历史

        Args:
            thread_id: 会话 ID

        Returns:
            包含 messages 和 citations 的字典
        """
        from app.core.graph import extract_citations_from_messages

        async with get_checkpointer() as checkpointer:
            config = {"configurable": {"thread_id": thread_id}}
            checkpoint_tuple = await checkpointer.aget_tuple(config)

            if not checkpoint_tuple:
                logger.warning(f"⚠️ [ChatSession] No checkpoint found for thread_id: {thread_id}")
                return {"messages": [], "citations": []}

            # 从 checkpoint 中提取消息
            # LangGraph 的消息存储在 channel_values 的 "messages" 中
            checkpoint = checkpoint_tuple.checkpoint
            langchain_messages = checkpoint.get("channel_values", {}).get("messages", [])

            # 提取引用信息
            citations = extract_citations_from_messages(langchain_messages)

            # 使用现有的转换工具转换为 OpenAI 格式 (UI 展示需过滤系统消息)
            messages = langchain_to_openai(langchain_messages, filter_system=True)

            return {"messages": messages, "citations": citations}

    @staticmethod
    async def delete_by_thread_id(
        db: AsyncSession,
        thread_id: str,
    ) -> bool:
        """删除会话

        Args:
            db: 数据库会话
            thread_id: LangGraph thread_id

        Returns:
            是否删除成功
        """
        result = await db.execute(select(ChatSession).where(ChatSession.thread_id == thread_id))
        session = result.scalar_one_or_none()

        if session:
            await db.delete(session)
            await db.commit()
            logger.info(f"🗑️ [ChatSession] Deleted: thread_id={thread_id}")

            # 同步清理 Checkpointer 中的消息历史，防止数据孤岛
            try:
                async with get_checkpointer() as checkpointer:
                    # 尝试删除 checkpointer 数据（如果支持）
                    if hasattr(checkpointer, "adelete"):
                        await checkpointer.adelete({"configurable": {"thread_id": thread_id}})
                        logger.info(
                            f"🧹 [ChatSession] Checkpointer data cleaned: thread_id={thread_id}"
                        )
            except Exception as e:
                logger.warning(f"⚠️ [ChatSession] Failed to delete checkpointer data: {e}")

            return True

        return False

    @staticmethod
    async def get_stats(
        db: AsyncSession,
        site_id: Optional[int] = None,
    ) -> dict:
        """获取会话统计

        Args:
            db: 数据库会话
            site_id: 站点ID（可选，过滤）

        Returns:
            统计数据字典
        """
        # 1. 获取概览数据
        overview = await ChatSessionService._get_overview_stats(db, site_id)

        # 2. 获取趋势数据
        trends = await ChatSessionService._get_trends(db, site_id)

        # 3. 获取今日数据
        today_stats = await ChatSessionService._get_today_stats(db, site_id)

        # 4. 获取最近会话
        recent_sessions = await ChatSessionService._get_recent_sessions(db, site_id)

        return {
            "total_sessions": overview["total_sessions"],
            "total_messages": overview["total_messages"],
            "active_users": overview["active_users"],
            "new_sessions_today": today_stats["new_sessions"],
            "new_messages_today": trends[-1]["messages"] if trends else 0,
            "daily_trends": trends,
            "recent_sessions": recent_sessions,
        }

    @staticmethod
    async def _get_overview_stats(db: AsyncSession, site_id: Optional[int]) -> dict:
        """获取总览统计"""

        # 基础查询构建器
        def build_query(select_stmt):
            if site_id is not None:
                return select_stmt.where(ChatSession.site_id == site_id)
            return select_stmt

        # 并行执行查询可以进一步优化，这里先保持顺序执行
        # 总会话数
        total_sessions = (
            await db.execute(build_query(select(func.count(ChatSession.id))))
        ).scalar() or 0

        # 总消息数
        total_messages = (
            await db.execute(build_query(select(func.sum(ChatSession.message_count))))
        ).scalar() or 0

        # 活跃用户数
        active_users = (
            await db.execute(build_query(select(func.count(func.distinct(ChatSession.member_id)))))
        ).scalar() or 0

        return {
            "total_sessions": total_sessions,
            "total_messages": int(total_messages),
            "active_users": active_users,
        }

    @staticmethod
    async def _get_today_stats(db: AsyncSession, site_id: Optional[int]) -> dict:
        """获取今日统计"""
        now = datetime.now()
        start_of_day = datetime(now.year, now.month, now.day)

        query = select(func.count(ChatSession.id)).where(ChatSession.created_at >= start_of_day)
        if site_id is not None:
            query = query.where(ChatSession.site_id == site_id)

        new_sessions = (await db.execute(query)).scalar() or 0
        return {"new_sessions": new_sessions}

    @staticmethod
    async def _get_trends(db: AsyncSession, site_id: Optional[int]) -> list[dict]:
        """获取最近7天趋势"""
        now = datetime.now()
        trends = []

        for i in range(6, -1, -1):
            day = now - timedelta(days=i)
            day_start = datetime(day.year, day.month, day.day)
            day_end = day_start + timedelta(days=1)

            # 构建查询
            session_query = select(func.count(ChatSession.id)).where(
                ChatSession.created_at >= day_start, ChatSession.created_at < day_end
            )
            message_query = select(func.sum(ChatSession.message_count)).where(
                ChatSession.created_at >= day_start, ChatSession.created_at < day_end
            )

            if site_id is not None:
                session_query = session_query.where(ChatSession.site_id == site_id)
                message_query = message_query.where(ChatSession.site_id == site_id)

            session_count = (await db.execute(session_query)).scalar() or 0
            message_count = int((await db.execute(message_query)).scalar() or 0)

            trends.append(
                {
                    "date": day_start.strftime("%m-%d"),
                    "sessions": session_count,
                    "messages": message_count,
                }
            )

        logging.info(f"Calculated AI Stats Trends: {trends}")
        return trends

    @staticmethod
    async def _get_recent_sessions(db: AsyncSession, site_id: Optional[int]) -> list[dict]:
        """获取最近会话列表"""
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
            }
            for s in sessions
        ]
