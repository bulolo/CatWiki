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

"""统计服务"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import crud_document
from app.crud.document_view_event import crud_document_view_event
from app.services.chat.session_service import ChatSessionService


class StatsService:
    @staticmethod
    async def get_site_stats(db: AsyncSession, site_id: int) -> dict:
        """获取站点聚合统计数据

        包含：
        1. 文档统计 (cruds.document)
        2. 浏览事件统计 (crud_document_view_event)
        3. AI会话统计 (ChatSessionService)
        """
        # 1. 基础文档统计
        # 返回: {total_documents, total_views}
        doc_stats = await crud_document.get_site_stats(db, site_id=site_id)

        # 2. 浏览事件统计 (NEW)
        views_today = await crud_document_view_event.get_views_today(db, site_id=site_id)
        unique_ips_today = await crud_document_view_event.get_unique_ips_today(db, site_id=site_id)
        total_unique_ips = await crud_document_view_event.get_total_unique_ips(db, site_id=site_id)

        # 3. AI 会话统计
        # 返回: {total_sessions, total_messages, active_users, new_sessions_today}
        ai_stats = await ChatSessionService.get_stats(db, site_id=site_id)

        return {
            "total_documents": doc_stats.get("total_documents", 0),
            "total_views": doc_stats.get("total_views", 0),
            "views_today": views_today,
            "unique_ips_today": unique_ips_today,
            "total_unique_ips": total_unique_ips,
            "total_chat_sessions": ai_stats.get("total_sessions", 0),
            "total_chat_messages": ai_stats.get("total_messages", 0),
            "active_chat_users": ai_stats.get("active_users", 0),
            "new_sessions_today": ai_stats.get("new_sessions_today", 0),
            "new_messages_today": ai_stats.get("new_messages_today", 0),
            "daily_trends": ai_stats.get("daily_trends", []),
            "recent_sessions": ai_stats.get("recent_sessions", []),
        }
