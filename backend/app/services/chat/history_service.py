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

"""消息持久化服务 - 消息存取"""

import json
import logging

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.vector.rag_utils import convert_messages_to_openai, extract_sources_from_messages
from app.models.chat_message import ChatMessage

logger = logging.getLogger(__name__)


class ChatHistoryService:
    """消息持久化服务

    负责聊天消息的存取，与 ChatSessionService 配合使用。
    """

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

        if last_human_idx == -1:
            return 0

        new_langchain_messages = messages[last_human_idx + 1 :]
        new_openai_messages = convert_messages_to_openai(new_langchain_messages)

        saved_count = 0
        for msg_dict in new_openai_messages:
            await ChatHistoryService.save_message(
                db=db,
                thread_id=thread_id,
                role=msg_dict["role"],
                content=msg_dict.get("content"),
                tool_calls=msg_dict.get("tool_calls"),
                tool_call_id=msg_dict.get("tool_call_id"),
                additional_kwargs=msg_dict.get("additional_kwargs"),
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
    def _messages_to_openai(messages: list[BaseMessage], filter_system: bool = False) -> list[dict]:
        """将 LangChain 格式消息转换为 OpenAI 格式 (委托给统一工具)"""
        return convert_messages_to_openai(messages, filter_system=filter_system)
