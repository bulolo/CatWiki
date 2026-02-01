"""统计服务"""

from sqlalchemy.ext.asyncio import AsyncSession
from app.crud import crud_document
from app.services.chat_session_service import ChatSessionService


class StatsService:
    @staticmethod
    async def get_site_stats(db: AsyncSession, site_id: int) -> dict:
        """获取站点聚合统计数据
        
        包含：
        1. 文档统计 (cruds.document)
        2. AI会话统计 (ChatSessionService)
        """
        # 1. 基础文档统计
        # 返回: {total_documents, total_views}
        doc_stats = await crud_document.get_site_stats(db, site_id=site_id)
        
        # 2. AI 会话统计
        # 返回: {total_sessions, total_messages, active_users, new_sessions_today}
        # 注意: ai_stats 中的 active_users 对应 response 的 active_chat_users
        ai_stats = await ChatSessionService.get_stats(db, site_id=site_id)
        
        return {
            "total_documents": doc_stats.get("total_documents", 0),
            "total_views": doc_stats.get("total_views", 0),
            "total_chat_sessions": ai_stats.get("total_sessions", 0),
            "total_chat_messages": ai_stats.get("total_messages", 0),
            "active_chat_users": ai_stats.get("active_users", 0),
            "new_sessions_today": ai_stats.get("new_sessions_today", 0),
            "new_messages_today": ai_stats.get("new_messages_today", 0),
            "daily_trends": ai_stats.get("daily_trends", []),
            "recent_sessions": ai_stats.get("recent_sessions", []),
        }
