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

import logging
from typing import Literal

from fastapi import Depends
from sqlalchemy import desc, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.common.i18n import _
from app.core.common.pagination import Paginator
from app.core.web.exceptions import ForbiddenException
from app.db.database import get_db
from app.db.transaction import transactional
from app.models.chat_session import ChatSession

logger = logging.getLogger(__name__)


class ChatSessionService:
    """会话管理服务

    提供会话的 CRUD 操作，与 LangGraph Checkpointer 配合使用。
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    @transactional()
    async def create_or_update(
        self,
        thread_id: str,
        site_id: int,
        user_message: str,
        member_id: str | None = None,
        tenant_id: int | None = None,
        source: str | None = None,
        _retry_count: int = 0,
    ) -> ChatSession:
        """创建或更新会话记录

        Args:
            member_id: 会员ID或访客ID（可选）
            _retry_count: 内部重试计数，防止无限递归
        """
        try:
            # 1. 尝试查找现有会话
            result = await self.db.execute(
                select(ChatSession).where(ChatSession.thread_id == thread_id)
            )
            session = result.scalar_one_or_none()

            if session:
                if session.member_id != member_id:
                    raise ForbiddenException(detail=_("session.access_denied"))
                self.ensure_session_access(
                    session,
                    member_id=member_id,
                    site_id=site_id,
                    tenant_id=tenant_id,
                )
                # 更新现有会话
                session.last_message = user_message[:200]
                session.last_message_role = "user"
                session.message_count += 1
                logger.info(
                    f"📝 [ChatSession] Updated: thread_id={thread_id}, count={session.message_count}"
                )
                # 自动处理提交
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
                    tenant_id=tenant_id,
                    source=source,
                )
                self.db.add(session)
                try:
                    await self.db.flush()
                    logger.info(
                        f"✨ [ChatSession] Created: thread_id={thread_id}, site_id={site_id}"
                    )
                except IntegrityError as ie:
                    # 并发冲突：可能在查询后被其他请求创建了
                    await self.db.rollback()
                    if _retry_count >= 1:
                        logger.error(
                            f"❌ [ChatSession] IntegrityError persisting after retry: {ie}"
                        )
                        raise ie

                    logger.warning(
                        f"⚠️ [ChatSession] IntegrityError for {thread_id}, retrying as update. Error: {ie}"
                    )
                    return await self.create_or_update(
                        thread_id,
                        site_id,
                        user_message,
                        member_id=member_id,
                        tenant_id=tenant_id,
                        source=source,
                        _retry_count=_retry_count + 1,
                    )

            return session

        except Exception as e:
            logger.error(f"❌ [ChatSession] Error in create_or_update: {e}")
            raise

    @transactional()
    async def update_assistant_response(
        self,
        thread_id: str,
        assistant_message: str,
    ) -> None:
        """更新助手回复

        在助手回复完成后调用，更新 last_message。使用原子 UPDATE 避免计数器
        并发问题；调用方仅作 fire-and-forget 写入，不消费返回值，因此不再
        额外做 SELECT 回读。
        """
        await self.db.execute(
            update(ChatSession)
            .where(ChatSession.thread_id == thread_id)
            .values(
                last_message=assistant_message[:200],
                last_message_role="assistant",
                message_count=ChatSession.message_count + 1,
            )
        )
        logger.info(f"💬 [ChatSession] Assistant response updated: thread_id={thread_id}")

    async def list_sessions(
        self,
        tenant_id: int | None = None,
        site_id: int | None = None,
        member_id: str | None = None,
        keyword: str | None = None,
        search_field: Literal["all", "text", "thread_id", "member_id"] = "all",
        source: str | None = None,
        page: int = 1,
        size: int = 20,
        is_pager: int = 1,
    ) -> tuple[list[ChatSession], Paginator]:
        """获取会话列表

        Args:
            tenant_id: 租户ID过滤
            member_id: 会员ID或访客ID（可选，过滤）
            keyword: 搜索关键词（可选）
            search_field: 搜索范围，all/text/thread_id/member_id
        """
        from sqlalchemy import or_

        def build_keyword_filter(value: str):
            if search_field == "text":
                return or_(
                    ChatSession.title.ilike(f"%{value}%"),
                    ChatSession.last_message.ilike(f"%{value}%"),
                )
            if search_field == "thread_id":
                return ChatSession.thread_id.ilike(f"%{value}%")
            if search_field == "member_id":
                return ChatSession.member_id.ilike(f"%{value}%")
            return or_(
                ChatSession.title.ilike(f"%{value}%"),
                ChatSession.last_message.ilike(f"%{value}%"),
                ChatSession.thread_id.ilike(f"%{value}%"),
                ChatSession.member_id.ilike(f"%{value}%"),
            )

        count_query = select(func.count(ChatSession.id))
        if tenant_id is not None:
            count_query = count_query.where(ChatSession.tenant_id == tenant_id)
        if site_id is not None:
            count_query = count_query.where(ChatSession.site_id == site_id)
        if member_id is not None:
            count_query = count_query.where(ChatSession.member_id == member_id)
        if source is not None:
            count_query = count_query.where(ChatSession.source == source)
        if keyword:
            count_query = count_query.where(build_keyword_filter(keyword))

        count_result = await self.db.execute(count_query)
        total = count_result.scalar() or 0
        paginator = Paginator(page=page, size=size, total=total, is_pager=is_pager)

        query = select(ChatSession)
        if tenant_id is not None:
            query = query.where(ChatSession.tenant_id == tenant_id)
        if site_id is not None:
            query = query.where(ChatSession.site_id == site_id)
        if member_id is not None:
            query = query.where(ChatSession.member_id == member_id)
        if source is not None:
            query = query.where(ChatSession.source == source)
        if keyword:
            query = query.where(build_keyword_filter(keyword))

        # 按更新时间倒序，分页
        query = query.order_by(desc(ChatSession.updated_at)).offset(paginator.skip)
        if paginator.size is not None:
            query = query.limit(paginator.size)

        result = await self.db.execute(query)
        sessions = list(result.scalars().all())

        return sessions, paginator

    async def get_session_by_thread_id(
        self,
        thread_id: str,
    ) -> ChatSession | None:
        """根据 thread_id 获取会话

        Args:
            thread_id: LangGraph thread_id

        Returns:
            ChatSession 实例，如果不存在返回 None
        """
        result = await self.db.execute(
            select(ChatSession).where(ChatSession.thread_id == thread_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    def ensure_session_access(
        session: ChatSession,
        *,
        member_id: str | None = None,
        site_id: int | None = None,
        tenant_id: int | None = None,
    ) -> None:
        """Validate client/admin ownership constraints for an existing session."""
        if member_id is not None and session.member_id != member_id:
            raise ForbiddenException(detail=_("session.access_denied"))
        if site_id is not None and session.site_id != site_id:
            raise ForbiddenException(detail=_("session.access_denied"))
        if tenant_id is not None and session.tenant_id != tenant_id:
            raise ForbiddenException(detail=_("session.access_denied"))

    async def get_session_for_access(
        self,
        thread_id: str,
        *,
        member_id: str | None = None,
        site_id: int | None = None,
        tenant_id: int | None = None,
    ) -> ChatSession | None:
        session = await self.get_session_by_thread_id(thread_id=thread_id)
        if session:
            self.ensure_session_access(
                session,
                member_id=member_id,
                site_id=site_id,
                tenant_id=tenant_id,
            )
        return session

    @transactional()
    async def delete_session_by_thread_id(
        self,
        thread_id: str,
        *,
        member_id: str | None = None,
        site_id: int | None = None,
        tenant_id: int | None = None,
    ) -> bool:
        """删除会话

        Args:
            thread_id: LangGraph thread_id

        Returns:
            是否删除成功
        """
        result = await self.db.execute(
            select(ChatSession).where(ChatSession.thread_id == thread_id)
        )
        session = result.scalar_one_or_none()

        if session:
            self.ensure_session_access(
                session,
                member_id=member_id,
                site_id=site_id,
                tenant_id=tenant_id,
            )
            await self.db.delete(session)
            # 自动处理提交
            logger.info(f"🗑️ [ChatSession] Deleted: thread_id={thread_id}")

            # 同步清理 Checkpointer 中的消息历史，防止数据孤岛
            try:
                from sqlalchemy import text

                # 手动删除 LangGraph 系统表中的相关记录
                # 涉及表: checkpoints, checkpoint_blobs, checkpoint_writes
                for table in ["checkpoints", "checkpoint_blobs", "checkpoint_writes"]:
                    await self.db.execute(
                        text(f"DELETE FROM {table} WHERE thread_id = :tid"), {"tid": thread_id}
                    )
                # 自动处理提交
                logger.info(
                    f"🧹 [ChatSession] LangGraph checkpoints cleaned: thread_id={thread_id}"
                )
            except Exception as e:
                logger.warning(f"⚠️ [ChatSession] Failed to delete checkpointer data: {e}")

            return True

        return False

    @transactional()
    async def delete_all_sessions_by_member(
        self,
        member_id: str,
        site_id: int | None = None,
    ) -> int:
        """删除指定访客的全部会话（含 LangGraph checkpoints）。

        改为批量删除：先一次 SELECT 拿到全部 thread_id，再用 4 条 DELETE
        （会话表 1 条 + 3 张 checkpoint 表）一次性清掉，避免 N 个会话
        变成 4N 次 round-trip。
        """
        from sqlalchemy import delete as sql_delete
        from sqlalchemy import text

        # 1. 收集要删除的 thread_id
        tid_query = select(ChatSession.thread_id).where(ChatSession.member_id == member_id)
        if site_id is not None:
            tid_query = tid_query.where(ChatSession.site_id == site_id)
        thread_ids = (await self.db.execute(tid_query)).scalars().all()

        if not thread_ids:
            return 0

        # 2. 批量删除 chat_sessions
        del_stmt = sql_delete(ChatSession).where(ChatSession.member_id == member_id)
        if site_id is not None:
            del_stmt = del_stmt.where(ChatSession.site_id == site_id)
        await self.db.execute(del_stmt)

        # 3. 批量删除 LangGraph checkpoint 三表（IN (...) 一次走完）
        try:
            for table in ("checkpoints", "checkpoint_blobs", "checkpoint_writes"):
                await self.db.execute(
                    text(f"DELETE FROM {table} WHERE thread_id = ANY(:tids)"),
                    {"tids": list(thread_ids)},
                )
        except Exception as e:
            logger.warning(f"⚠️ [ChatSession] Failed to bulk-delete checkpointer data: {e}")

        count = len(thread_ids)
        logger.info(f"🗑️ [ChatSession] Bulk deleted {count} sessions for member={member_id}")
        return count


def get_chat_session_service(db: AsyncSession = Depends(get_db)) -> ChatSessionService:
    """获取 ChatSessionService 实例的依赖注入函数"""
    return ChatSessionService(db)
