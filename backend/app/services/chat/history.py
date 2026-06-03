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

import asyncio
import json
import logging

from fastapi import Depends
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai.message_utils import convert_messages_to_openai
from app.db.database import get_db
from app.db.transaction import transactional
from app.models.chat_message import ChatMessage

logger = logging.getLogger(__name__)


class ChatHistoryService:
    """消息持久化服务

    负责聊天消息的存取，与 ChatSessionService 配合使用。
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    @transactional()
    async def save_turn_messages(
        self,
        thread_id: str,
        messages: list[BaseMessage],
        trace: dict | None = None,
        tool_elapsed: dict[str, int] | None = None,
    ) -> int:
        """从 LangChain 消息列表同步本轮新消息到 SQL（含 tool_calls 和 tool 结果）。

        批量写入：构造好 N 个 ChatMessage 实例后一次性 ``add_all`` + 单次 flush，
        避免按条调用 ``save_message`` 引入 N 个嵌套 SAVEPOINT。

        ``trace`` 与 ``tool_elapsed`` 仅在站点开启 ``show_pipeline_trace`` 时传入：
        前者落到本轮最后一条 assistant 消息的 ``additional_kwargs.trace``，后者按
        ``{tool_call_id: elapsed_ms}`` 精确匹配写入对应 tool_call 的 ``elapsed_ms``。
        历史回看时前端直接读这两份数据还原 ⏱ 行 + pill 耗时，不再依赖实时事件。
        """
        # 1. 找到最后一条 HumanMessage 的索引，这通常是当前轮次的起点
        # 注意：HumanMessage 本身已经由 API 层手动保存了，我们只需要保存它之后的所有消息
        last_human_idx = -1
        for i in range(len(messages) - 1, -1, -1):
            if isinstance(messages[i], HumanMessage):
                last_human_idx = i
                break

        if last_human_idx == -1:
            # 找不到 HumanMessage：全部消息均为新内容，全量保存
            new_langchain_messages = messages
        else:
            new_langchain_messages = messages[last_human_idx + 1 :]

        if not new_langchain_messages:
            return 0
        new_openai_messages = convert_messages_to_openai(new_langchain_messages)

        if not new_openai_messages:
            return 0

        # 注入 tool elapsed_ms：按 tool_call_id 精确匹配，并行工具也不会错位
        if tool_elapsed:
            for msg_dict in new_openai_messages:
                if msg_dict.get("role") != "assistant":
                    continue
                for tc in msg_dict.get("tool_calls") or []:
                    elapsed = tool_elapsed.get(tc.get("id"))
                    if elapsed is not None:
                        tc["elapsed_ms"] = elapsed

        if trace:
            # 注入 trace：落到本轮最后一条 assistant 消息的 additional_kwargs
            for msg_dict in reversed(new_openai_messages):
                if msg_dict.get("role") != "assistant":
                    continue
                ak = dict(msg_dict.get("additional_kwargs") or {})
                ak["trace"] = trace
                msg_dict["additional_kwargs"] = ak
                break
        else:
            # 站点未开启 trace：LangChain 原生写入的 usage_metadata 也得剥离，
            # 否则历史回看时 Tokens 仍会显示，与开关语义不符
            for msg_dict in new_openai_messages:
                ak = msg_dict.get("additional_kwargs")
                if isinstance(ak, dict) and "usage_metadata" in ak:
                    stripped = {k: v for k, v in ak.items() if k != "usage_metadata"}
                    msg_dict["additional_kwargs"] = stripped if stripped else None

        rows = [
            ChatMessage(
                thread_id=thread_id,
                role=msg_dict["role"],
                content=msg_dict.get("content"),
                tool_calls=msg_dict.get("tool_calls"),
                tool_call_id=msg_dict.get("tool_call_id"),
                additional_kwargs=msg_dict.get("additional_kwargs"),
            )
            for msg_dict in new_openai_messages
        ]
        self.db.add_all(rows)
        await self.db.flush()
        logger.debug(f"💾 [ChatMessage] Batch saved {len(rows)} messages: thread_id={thread_id}")
        return len(rows)

    @transactional()
    async def save_message(
        self,
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
            self.db.add(msg)
            logger.debug(f"💾 [ChatMessage] Saved: thread_id={thread_id}, role={role}")
            return msg
        except Exception as e:
            logger.error(f"❌ [ChatMessage] Error in save_message: {e}")
            raise

    async def get_chat_history(
        self,
        thread_id: str,
    ) -> dict:
        """获取对话历史（从 SQL 全量历史表获取）"""

        # 1. 从 SQL 获取全量历史消息
        result = await self.db.execute(
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

        # 3. 单趟扫描预计算每条 AI 消息对应的本轮 sources，避免 O(n²)。
        #    规则与 extract_sources_from_messages(from_last_turn=True) 一致：
        #    以最近一条 HumanMessage 为锚点，收集其后所有 ToolMessage 的引用，
        #    遇到下一条 HumanMessage 时重置。
        sources_by_idx: dict[int, list[dict]] = {}
        turn_sources: dict[int, dict] = {}
        for j, lc_msg in enumerate(langchain_msgs):
            if isinstance(lc_msg, HumanMessage):
                turn_sources = {}
            elif isinstance(lc_msg, ToolMessage) and lc_msg.name == "search_knowledge_base":
                try:
                    content = (
                        lc_msg.content
                        if isinstance(lc_msg.content, str)
                        else json.dumps(lc_msg.content)
                    )
                    results = json.loads(content)
                    if isinstance(results, list):
                        for doc in results:
                            meta = doc.get("metadata", {})
                            doc_id = meta.get("document_id")
                            source_idx = doc.get("source_index") or meta.get("source_index")
                            # 仅保留每个文档的首个引用点（与 extract_sources 行为一致）
                            if doc_id and doc_id not in turn_sources:
                                turn_sources[doc_id] = {
                                    "id": str(doc_id),
                                    "title": meta.get("title", "Unknown"),
                                    "siteId": meta.get("site_id"),
                                    "documentId": doc_id,
                                    "score": meta.get("score"),
                                    "sourceIndex": int(source_idx)
                                    if source_idx is not None
                                    else None,
                                }
                except (json.JSONDecodeError, AttributeError):
                    continue
                except Exception as e:
                    logger.error(f"❌ Error extracting sources: {e}")
            elif isinstance(lc_msg, AIMessage) and turn_sources:
                sources_by_idx[j] = sorted(
                    turn_sources.values(),
                    key=lambda x: x.get("sourceIndex") if x.get("sourceIndex") is not None else 999,
                )

        # 4. 组装 HTTP 响应消息列表，附加预计算的 sources
        messages = []
        for i, msg in enumerate(db_messages):
            msg_dict = {
                "role": msg.role,
                "content": msg.content,
                "created_at": msg.created_at.isoformat() if msg.created_at else None,
            }
            if msg.tool_calls:
                msg_dict["tool_calls"] = msg.tool_calls
            if msg.tool_call_id:
                msg_dict["tool_call_id"] = msg.tool_call_id
            if msg.additional_kwargs:
                msg_dict["additional_kwargs"] = msg.additional_kwargs

            if msg.role == "assistant":
                msg_sources = sources_by_idx.get(i)
                if msg_sources:
                    msg_dict["sources"] = msg_sources

            messages.append(msg_dict)

        return {"thread_id": thread_id, "messages": messages}

    async def resolve_assistant_message_id(
        self,
        thread_id: str,
        message_seq: int,
        *,
        retries: tuple[float, ...] = (0.0, 0.2, 0.4, 0.8),
    ) -> int | None:
        """把 ``(thread_id, message_seq)`` 解析为 ``chat_messages.id``。

        feedback 写入路径专用：用户点 👍/👎 时 ``persist_chat_turn`` 的 background
        task 可能还没把消息行落库。``retries`` 控制等待时序，最大累计 ~1.4s 内拿到
        结果；超时返回 None 让调用方报错给客户端 retry。

        **过滤掉只带 tool_calls 的中间行**：ReAct 模式下一个 turn 会产生多条
        ``role='assistant'`` 行（先 tool_calls 行 content 为空、再 tool 行、最后
        final answer 行有 content）；前端 ``Message[]`` 把它们合并成一条用户可见
        消息，所以 ``message_seq`` 应当对齐"有 content 的最终答案行"。
        """
        for delay in retries:
            if delay:
                await asyncio.sleep(delay)
            stmt = (
                select(ChatMessage.id)
                .where(
                    ChatMessage.thread_id == thread_id,
                    ChatMessage.role == "assistant",
                    ChatMessage.content.isnot(None),
                    ChatMessage.content != "",
                )
                .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
                .offset(message_seq)
                .limit(1)
            )
            msg_id = (await self.db.execute(stmt)).scalar_one_or_none()
            if msg_id is not None:
                return msg_id
        return None

    async def get_tool_result(self, thread_id: str, tool_call_id: str) -> str | None:
        """根据 tool_call_id 获取单条工具调用的返回内容"""
        result = await self.db.execute(
            select(ChatMessage.content).where(
                ChatMessage.thread_id == thread_id,
                ChatMessage.role == "tool",
                ChatMessage.tool_call_id == tool_call_id,
            )
        )
        return result.scalar_one_or_none()


def get_chat_history_service(db: AsyncSession = Depends(get_db)) -> ChatHistoryService:
    """获取 ChatHistoryService 实例的依赖注入函数"""
    return ChatHistoryService(db)
