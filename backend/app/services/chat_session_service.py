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

import json
import logging
from datetime import datetime, timedelta

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from sqlalchemy import desc, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.vector.rag_utils import extract_sources_from_messages
from app.models.chat_message import ChatMessage
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
        member_id: str | None = None,
        tenant_id: int | None = None,
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
                    tenant_id=tenant_id,
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
                        db, thread_id, site_id, user_message, member_id, tenant_id
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
    ) -> ChatSession | None:
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
        site_id: int | None = None,
        member_id: str | None = None,
        keyword: str | None = None,
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
    ) -> ChatSession | None:
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
    async def save_history_from_messages(
        db: AsyncSession,
        thread_id: str,
        messages: list[BaseMessage],
    ) -> int:
        """从 LangChain 消息列表同步新消息到 SQL (包括 tool_calls 和 tool 结果)"""
        # 1. 找到最后一条 HumanMessage 的索引，这通常是当前轮次的起点
        # 注意：HumanMessage 本身已经由 API 层手动保存了，我们只需要保存它之后的所有消息
        last_human_idx = -1
        for i in range(len(messages) - 1, -1, -1):
            if isinstance(messages[i], HumanMessage):
                last_human_idx = i
                break

        if last_human_idx == -1:
            return 0

        new_messages = messages[last_human_idx + 1 :]
        saved_count = 0

        for msg in new_messages:
            role = "assistant"
            tool_calls = None
            tool_call_id = None

            if isinstance(msg, AIMessage):
                role = "assistant"
                if hasattr(msg, "tool_calls") and msg.tool_calls:
                    # 按照 OpenAI 标准格式保存 tool_calls
                    tool_calls = []
                    for tc in msg.tool_calls:
                        args = tc.get("args")
                        tool_calls.append(
                            {
                                "id": tc.get("id"),
                                "type": "function",
                                "function": {
                                    "name": tc.get("name"),
                                    "arguments": args
                                    if isinstance(args, str)
                                    else json.dumps(args, ensure_ascii=False),
                                },
                            }
                        )
            elif isinstance(msg, ToolMessage):
                role = "tool"
                tool_call_id = msg.tool_call_id
            elif isinstance(msg, HumanMessage):
                role = "user"
            elif isinstance(msg, SystemMessage):
                # 系统消息（如摘要后的提示）通常不需要存入给用户看的消息流中
                # 如果需要也可以存
                continue
            else:
                continue

            additional_kwargs = getattr(msg, "additional_kwargs", {}).copy()

            # 特别处理 AIMessage 的 Token 使用信息
            if isinstance(msg, AIMessage) and hasattr(msg, "usage_metadata") and msg.usage_metadata:
                additional_kwargs["usage_metadata"] = msg.usage_metadata

            await ChatSessionService.save_message(
                db=db,
                thread_id=thread_id,
                role=role,
                content=msg.content
                if isinstance(msg.content, str)
                else json.dumps(msg.content, ensure_ascii=False),
                tool_calls=tool_calls,
                tool_call_id=tool_call_id,
                additional_kwargs=additional_kwargs,
            )
            saved_count += 1

        return saved_count

    @staticmethod
    async def save_message(
        db: AsyncSession,
        thread_id: str,
        role: str,
        content: str | None = None,
        tool_calls: list | None = None,
        tool_call_id: str | None = None,
        additional_kwargs: dict | None = None,
    ) -> ChatMessage:
        """保存单条消息到全量历史表"""
        try:
            msg = ChatMessage(
                thread_id=thread_id,
                role=role,
                content=content,
                tool_calls=tool_calls,
                tool_call_id=tool_call_id,
                additional_kwargs=additional_kwargs,
            )
            db.add(msg)
            await db.commit()
            await db.refresh(msg)
            logger.debug(f"💾 [ChatMessage] Saved: thread_id={thread_id}, role={role}")
            return msg
        except Exception as e:
            logger.error(f"❌ [ChatMessage] Error in save_message: {e}")
            await db.rollback()
            raise

    @staticmethod
    async def get_session_messages(
        db: AsyncSession,
        thread_id: str,
    ) -> dict:
        """获取对话历史（从 SQL 全量历史表获取）"""

        # 1. 从 SQL 获取全量历史消息
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.thread_id == thread_id)
            .order_by(ChatMessage.created_at.asc())
        )
        db_messages = result.scalars().all()

        # 2. 转换为 LangChain 消息格式（用于引用提取）
        langchain_msgs = []
        for msg in db_messages:
            if msg.role == "user":
                langchain_msgs.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                l_tool_calls = []
                if msg.tool_calls:
                    for tc in msg.tool_calls:
                        func = tc.get("function", {})
                        try:
                            args = json.loads(func.get("arguments", "{}"))
                        except json.JSONDecodeError:
                            args = {}
                        l_tool_calls.append(
                            {
                                "name": func.get("name", "unknown"),
                                "args": args,
                                "id": tc.get("id"),
                                "type": "tool_call",
                            }
                        )
                langchain_msgs.append(AIMessage(content=msg.content or "", tool_calls=l_tool_calls))
            elif msg.role == "tool":
                langchain_msgs.append(
                    ToolMessage(
                        content=msg.content,
                        tool_call_id=msg.tool_call_id,
                        name="search_knowledge_base",
                    )
                )

        # 3. 转换 SQL 消息为 OpenAI 格式渲染，并为每个 AI 回复关联其专属引用
        messages = []
        for i, msg in enumerate(db_messages):
            msg_dict = {"role": msg.role, "content": msg.content}
            if msg.tool_calls:
                msg_dict["tool_calls"] = msg.tool_calls
            if msg.tool_call_id:
                msg_dict["tool_call_id"] = msg.tool_call_id
            if msg.additional_kwargs:
                msg_dict["additional_kwargs"] = msg.additional_kwargs

            # 为每一条 Assistant 消息提取其对应的引用
            if msg.role == "assistant":
                # 传入截止到当前消息的历史，并只提取当前回合的引用
                msg_sources = extract_sources_from_messages(
                    langchain_msgs[: i + 1], from_last_turn=True
                )
                if msg_sources:
                    msg_dict["sources"] = msg_sources

            messages.append(msg_dict)

        return {"thread_id": thread_id, "messages": messages}

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
                from sqlalchemy import text

                # 手动删除 LangGraph 系统表中的相关记录
                # 涉及表: checkpoints, checkpoint_blobs, checkpoint_writes
                for table in ["checkpoints", "checkpoint_blobs", "checkpoint_writes"]:
                    await db.execute(
                        text(f"DELETE FROM {table} WHERE thread_id = :tid"), {"tid": thread_id}
                    )
                await db.commit()
                logger.info(
                    f"🧹 [ChatSession] LangGraph checkpoints cleaned: thread_id={thread_id}"
                )
            except Exception as e:
                logger.warning(f"⚠️ [ChatSession] Failed to delete checkpointer data: {e}")

            return True

        return False

    @staticmethod
    async def get_stats(
        db: AsyncSession,
        site_id: int | None = None,
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
    async def _get_overview_stats(db: AsyncSession, site_id: int | None) -> dict:
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
    async def _get_today_stats(db: AsyncSession, site_id: int | None) -> dict:
        """获取今日统计"""
        now = datetime.now()
        start_of_day = datetime(now.year, now.month, now.day)

        query = select(func.count(ChatSession.id)).where(ChatSession.created_at >= start_of_day)
        if site_id is not None:
            query = query.where(ChatSession.site_id == site_id)

        new_sessions = (await db.execute(query)).scalar() or 0
        return {"new_sessions": new_sessions}

    @staticmethod
    async def _get_trends(db: AsyncSession, site_id: int | None) -> list[dict]:
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
    async def _get_recent_sessions(db: AsyncSession, site_id: int | None) -> list[dict]:
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

    @staticmethod
    def _messages_to_openai(messages: list[BaseMessage], filter_system: bool = False) -> list[dict]:
        """将 LangChain 格式消息转换为 OpenAI 格式 (完全兼容 tool calling)"""
        result = []
        for msg in messages:
            if isinstance(msg, SystemMessage):
                if filter_system:
                    continue
                result.append({"role": "system", "content": msg.content})

            elif isinstance(msg, AIMessage):
                message_dict = {"role": "assistant"}

                # 处理 content（可能为空字符串或 None）
                if msg.content:
                    message_dict["content"] = msg.content
                else:
                    message_dict["content"] = None

                # 处理 tool_calls（如果存在）
                if hasattr(msg, "tool_calls") and msg.tool_calls:
                    tool_calls_list = []
                    for tc in msg.tool_calls:
                        # LangChain 的 tool_call 结构转换为 OpenAI 格式
                        tool_call_dict = {
                            "id": tc.get("id", ""),
                            "type": "function",
                            "function": {
                                "name": tc.get("name", ""),
                                "arguments": json.dumps(tc.get("args", {}), ensure_ascii=False),
                            },
                        }
                        tool_calls_list.append(tool_call_dict)
                    message_dict["tool_calls"] = tool_calls_list

                result.append(message_dict)

            elif isinstance(msg, HumanMessage):
                result.append({"role": "user", "content": msg.content})

            elif isinstance(msg, ToolMessage):
                # OpenAI 格式的 tool role 消息
                result.append(
                    {
                        "role": "tool",
                        "tool_call_id": msg.tool_call_id,
                        "content": msg.content
                        if isinstance(msg.content, str)
                        else json.dumps(msg.content, ensure_ascii=False),
                    }
                )

        return result
