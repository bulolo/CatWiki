"""ChatSession Service - 会话管理服务"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_session import ChatSession

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
        member_id: Optional[int] = None,
    ) -> ChatSession:
        """创建或更新会话记录
        
        Args:
            member_id: 会员ID（可选）
        """
        # 查找现有会话
        result = await db.execute(
            select(ChatSession).where(ChatSession.thread_id == thread_id)
        )
        session = result.scalar_one_or_none()
        
        if session:
            # 更新现有会话
            session.last_message = user_message[:200]
            session.last_message_role = "user"
            session.message_count += 1
            if member_id is not None:
                session.member_id = member_id
            logger.info(f"📝 [ChatSession] Updated: thread_id={thread_id}, count={session.message_count}")
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
            logger.info(f"✨ [ChatSession] Created: thread_id={thread_id}, site_id={site_id}")
        
        await db.commit()
        await db.refresh(session)
        return session

    @staticmethod
    async def update_assistant_response(
        db: AsyncSession,
        thread_id: str,
        assistant_message: str,
    ) -> Optional[ChatSession]:
        """更新助手回复
        
        在助手回复完成后调用，更新 last_message。
        
        Args:
            db: 数据库会话
            thread_id: LangGraph thread_id
            assistant_message: 助手回复内容
            
        Returns:
            ChatSession 实例，如果不存在返回 None
        """
        result = await db.execute(
            select(ChatSession).where(ChatSession.thread_id == thread_id)
        )
        session = result.scalar_one_or_none()
        
        if session:
            session.last_message = assistant_message[:200]
            session.last_message_role = "assistant"
            session.message_count += 1
            await db.commit()
            await db.refresh(session)
            logger.info(f"💬 [ChatSession] Assistant response updated: thread_id={thread_id}")
        
        return session

    @staticmethod
    async def list_sessions(
        db: AsyncSession,
        site_id: Optional[int] = None,
        member_id: Optional[int] = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[ChatSession], int]:
        """获取会话列表
        
        Args:
            member_id: 会员ID（可选，过滤）
        """
        query = select(ChatSession)
        count_query = select(func.count(ChatSession.id))
        
        if site_id is not None:
            query = query.where(ChatSession.site_id == site_id)
            count_query = count_query.where(ChatSession.site_id == site_id)
        
        if member_id is not None:
            query = query.where(ChatSession.member_id == member_id)
            count_query = count_query.where(ChatSession.member_id == member_id)
        
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
        result = await db.execute(
            select(ChatSession).where(ChatSession.thread_id == thread_id)
        )
        return result.scalar_one_or_none()
    
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
        result = await db.execute(
            select(ChatSession).where(ChatSession.thread_id == thread_id)
        )
        session = result.scalar_one_or_none()
        
        if session:
            await db.delete(session)
            await db.commit()
            logger.info(f"🗑️ [ChatSession] Deleted: thread_id={thread_id}")
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
        base_query = select(ChatSession)
        if site_id is not None:
            base_query = base_query.where(ChatSession.site_id == site_id)
        
        # 总会话数
        count_query = select(func.count(ChatSession.id))
        if site_id is not None:
            count_query = count_query.where(ChatSession.site_id == site_id)
        count_result = await db.execute(count_query)
        total_sessions = count_result.scalar() or 0
        
        # 总消息数
        msg_count_query = select(func.sum(ChatSession.message_count))
        if site_id is not None:
            msg_count_query = msg_count_query.where(ChatSession.site_id == site_id)
        msg_result = await db.execute(msg_count_query)
        total_messages = msg_result.scalar() or 0
        
        # 活跃用户数
        user_count_query = select(func.count(func.distinct(ChatSession.member_id)))
        if site_id is not None:
            user_count_query = user_count_query.where(ChatSession.site_id == site_id)
        user_result = await db.execute(user_count_query)
        active_users = user_result.scalar() or 0
        
        # 今日新增会话与消息数 (这里逻辑保持不变，但增加趋势计算)
        now = datetime.now()
        start_of_day = datetime(now.year, now.month, now.day)
        
        new_sessions_query = select(func.count(ChatSession.id)).where(
            ChatSession.created_at >= start_of_day
        )
        if site_id is not None:
            new_sessions_query = new_sessions_query.where(ChatSession.site_id == site_id)
        new_sessions_result = await db.execute(new_sessions_query)
        new_sessions_today = new_sessions_result.scalar() or 0

        # 最近 7 天趋势 (简单实现：按天分组统计新会话)
        from datetime import timedelta
        trends = []
        for i in range(6, -1, -1):
            day = now - timedelta(days=i)
            day_start = datetime(day.year, day.month, day.day)
            day_end = day_start + timedelta(days=1)
            
            # 会话数
            s_q = select(func.count(ChatSession.id)).where(
                ChatSession.created_at >= day_start,
                ChatSession.created_at < day_end
            )
            # 消息数 (这里依然是近似，统计该天创建的会话的消息总数)
            m_q = select(func.sum(ChatSession.message_count)).where(
                ChatSession.created_at >= day_start,
                ChatSession.created_at < day_end
            )
            
            if site_id is not None:
                s_q = s_q.where(ChatSession.site_id == site_id)
                m_q = m_q.where(ChatSession.site_id == site_id)
            
            s_res = await db.execute(s_q)
            m_res = await db.execute(m_q)
            s_count = s_res.scalar() or 0
            m_count = int(m_res.scalar() or 0)
            
            trends.append({
                "date": day_start.strftime("%m-%d"),
                "sessions": s_count,
                "messages": m_count
            })
            
        logging.info(f"Calculated AI Stats Trends: {trends}")
        
        # 最近 5 条会话
        recent_q = select(ChatSession).order_by(desc(ChatSession.created_at)).limit(5)
        if site_id is not None:
            recent_q = recent_q.where(ChatSession.site_id == site_id)
        
        recent_res = await db.execute(recent_q)
        recent_sessions_objs = recent_res.scalars().all()
        
        # 显式转换为字典以避免 Pydantic 验证 ORM 对象的潜在问题
        recent_sessions = [
            {
                "thread_id": s.thread_id,
                "title": s.title,
                "created_at": s.created_at,
                "message_count": s.message_count
            }
            for s in recent_sessions_objs
        ]
        
        return {
            "total_sessions": total_sessions,
            "total_messages": int(total_messages), 
            "active_users": active_users,
            "new_sessions_today": new_sessions_today,
            "new_messages_today": trends[-1]["messages"] if trends else 0,
            "daily_trends": trends,
            "recent_sessions": recent_sessions
        }
