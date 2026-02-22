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

import json
import logging
import time
import uuid
from collections.abc import AsyncGenerator

from fastapi import BackgroundTasks
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_openai import ChatOpenAI

from app.core.ai.graph import create_agent_graph
from app.core.ai.graph.checkpointer import get_checkpointer
from app.core.ai.providers.llm_manager import llm_manager
from app.core.vector.rag_utils import (
    convert_tool_call_chunk_to_openai,
    extract_sources_from_messages,
)
from app.crud import crud_site
from app.db.database import AsyncSessionLocal
from app.schemas.chat import (
    ChatCompletionChoice,
    ChatCompletionChunk,
    ChatCompletionChunkChoice,
    ChatCompletionChunkDelta,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatMessage,
)
from app.services.chat.history_service import ChatHistoryService
from app.services.chat.session_service import ChatSessionService

logger = logging.getLogger(__name__)


class ChatService:
    @classmethod
    async def generate_chat_chunks(
        cls,
        graph,
        input_state: dict,
        config: dict,
        model_name: str,
        thread_id: str,
        background_tasks: BackgroundTasks,
    ) -> AsyncGenerator[ChatCompletionChunk | dict, None]:
        """核心流式响应生成器 - 产出原始 Chunk 对象或状态 dict"""
        full_response = ""
        sources = []
        chunk_id_prefix = f"chatcmpl-{uuid.uuid4()}"

        try:
            async for event in graph.astream_events(input_state, config, version="v1"):
                kind = event["event"]

                # 1. 处理 LLM 流式输出 (Token)
                if kind == "on_chat_model_stream":
                    chunk_data = event["data"]["chunk"]
                    chunk_content = chunk_data.content

                    if chunk_content:
                        full_response += chunk_content
                        yield ChatCompletionChunk(
                            id=chunk_id_prefix,
                            object="chat.completion.chunk",
                            created=int(time.time()),
                            model=model_name,
                            choices=[
                                ChatCompletionChunkChoice(
                                    index=0,
                                    delta=ChatCompletionChunkDelta(content=chunk_content),
                                    finish_reason=None,
                                )
                            ],
                        )

                    if hasattr(chunk_data, "tool_call_chunks") and chunk_data.tool_call_chunks:
                        for tc_chunk in chunk_data.tool_call_chunks:
                            cleaned_tc = convert_tool_call_chunk_to_openai(tc_chunk)
                            yield ChatCompletionChunk(
                                id=chunk_id_prefix,
                                object="chat.completion.chunk",
                                created=int(time.time()),
                                model=model_name,
                                choices=[
                                    ChatCompletionChunkChoice(
                                        index=0,
                                        delta=ChatCompletionChunkDelta(tool_calls=[cleaned_tc]),
                                        finish_reason=None,
                                    )
                                ],
                            )

                # 2. 工具开始调用 - 发送状态指示
                elif kind == "on_tool_start":
                    tool_name = event.get("name", "unknown")
                    logger.debug(f"🔧 [Stream] Tool started: {tool_name}")
                    yield {"status": "tool_calling", "tool": tool_name}

            # 引用提取与善后
            state_snapshot = await graph.aget_state(config)
            if state_snapshot.values:
                final_messages = state_snapshot.values.get("messages", [])
                sources = extract_sources_from_messages(final_messages, from_last_turn=True)

            if sources:
                yield {"sources": sources}

            # 3. 异步更新数据库记录
            async def save_history():
                async with AsyncSessionLocal() as db:
                    state_snapshot = await graph.aget_state(config)
                    final_messages = (
                        state_snapshot.values.get("messages", []) if state_snapshot.values else []
                    )
                    final_response = ""
                    if final_messages:
                        for msg in reversed(final_messages):
                            if isinstance(msg, AIMessage) and msg.content:
                                final_response = msg.content
                                break

                    persistent_content = final_response or full_response
                    if persistent_content:
                        await ChatSessionService.update_assistant_response(
                            db=db, thread_id=thread_id, assistant_message=persistent_content
                        )
                    await ChatHistoryService.save_history_from_messages(
                        db=db, thread_id=thread_id, messages=final_messages
                    )

            background_tasks.add_task(save_history)

        except Exception as e:
            logger.error(f"❌ [ChatService] Stream generator error: {e}", exc_info=True)
            yield ChatCompletionChunk(
                id=f"error-{uuid.uuid4()}",
                model=model_name,
                choices=[
                    ChatCompletionChunkChoice(
                        index=0,
                        delta=ChatCompletionChunkDelta(content=f"\n\n[System Error: {str(e)}]"),
                        finish_reason="stop",
                    )
                ],
            )

    @staticmethod
    async def stream_graph_events(
        graph,
        input_state: dict,
        config: dict,
        model_name: str,
        thread_id: str,
        background_tasks: BackgroundTasks,
    ) -> AsyncGenerator[str, None]:
        """流式响应生成器 - 包装 generate_chat_chunks 并序列化为 SSE 格式"""
        async for chunk in ChatService.generate_chat_chunks(
            graph, input_state, config, model_name, thread_id, background_tasks
        ):
            if isinstance(chunk, ChatCompletionChunk):
                yield f"data: {chunk.model_dump_json()}\n\n"
            else:
                yield f"data: {json.dumps(chunk)}\n\n"

        yield "data: [DONE]\n\n"

    @classmethod
    async def initialize_chat_context(
        cls,
        thread_id: str,
        site_id: int,
        user_id: str,
        message: str,
        model_name: str | None = None,
        temperature: float = 0.7,
    ) -> tuple[ChatOpenAI, dict, dict, int | None]:
        """
        初始化聊天上下文：解析租户、构建 LLM、持久化首条消息并准备 Graph 状态。
        供 process_chat_request 和 RobotOrchestrator 复用。
        """
        # 1. 解析 site_id 和 tenant_id
        tenant_id = None
        async with AsyncSessionLocal() as db:
            site = await crud_site.get(db, id=site_id)
            tenant_id = site.tenant_id if site else None

        # 2. 初始化 LLM
        llm = await llm_manager.get_model(
            tenant_id=tenant_id,
            model_name=model_name,
            temperature=temperature,
        )

        # 3. 创建/更新数据库会话记录
        async with AsyncSessionLocal() as db:
            try:
                await ChatSessionService.create_or_update(
                    db=db,
                    thread_id=thread_id,
                    site_id=site_id,
                    user_message=message,
                    member_id=user_id,
                    tenant_id=tenant_id,
                )
                await ChatHistoryService.save_message(
                    db=db, thread_id=thread_id, role="user", content=message
                )
            except Exception as e:
                logger.error(f"❌ [ChatService] Failed to persist chat session: {e}")
                # 为了保证响应不中断，记录错误但继续

        # 4. 准备 Graph 初始状态
        initial_state = {
            "messages": [HumanMessage(content=message)],
            "site_id": site_id,
            "iteration_count": 0,
            "consecutive_empty_count": 0,
        }
        config = {"configurable": {"thread_id": thread_id, "site_id": site_id}}

        return llm, initial_state, config, tenant_id

    @classmethod
    async def process_chat_request(
        cls, request: ChatCompletionRequest, background_tasks: BackgroundTasks
    ) -> ChatCompletionResponse | StreamingResponse:
        """核心聊天处理逻辑 (ReAct Agent)"""

        # 使用统一初始化逻辑
        site_id = request.filter.site_id if (request.filter and request.filter.site_id) else 0
        llm, initial_state, config, tenant_id = await cls.initialize_chat_context(
            thread_id=request.thread_id,
            site_id=site_id,
            user_id=request.user,
            message=request.message,
            model_name=request.model,
            temperature=request.temperature or 0.7,
        )

        try:
            # 7. 执行推理
            if request.stream:

                async def protected_generator():
                    async with get_checkpointer() as cp:
                        graph = create_agent_graph(checkpointer=cp, model=llm)
                        # 调用 SSE 封装层
                        async for sse_chunk in cls.stream_graph_events(
                            graph,
                            initial_state,
                            config,
                            llm.model_name,
                            request.thread_id,
                            background_tasks,
                        ):
                            yield sse_chunk

                return StreamingResponse(
                    protected_generator(),
                    media_type="text/event-stream",
                )
            else:
                # 非流式响应
                async with get_checkpointer() as cp:
                    graph = create_agent_graph(checkpointer=cp, model=llm)
                    result = await graph.ainvoke(initial_state, config)

                    messages = result["messages"]
                    last_message = messages[-1] if messages else AIMessage(content="")
                    content = last_message.content if isinstance(last_message, BaseMessage) else ""

                    # 后台异步保存历史 (已在 site-completions 等场景通过 background_tasks 加速)
                    async def save_history_bg():
                        async with AsyncSessionLocal() as db:
                            await ChatSessionService.update_assistant_response(
                                db=db, thread_id=request.thread_id, assistant_message=content
                            )
                            await ChatHistoryService.save_history_from_messages(
                                db=db, thread_id=request.thread_id, messages=messages
                            )

                    background_tasks.add_task(save_history_bg)

                    return ChatCompletionResponse(
                        id=f"chatcmpl-{uuid.uuid4()}",
                        object="chat.completion",
                        created=int(time.time()),
                        model=llm.model_name,
                        choices=[
                            ChatCompletionChoice(
                                index=0,
                                message=ChatMessage(role="assistant", content=content),
                                finish_reason="stop",
                            )
                        ],
                        usage=None,
                    )

        except Exception as e:
            logger.error(f"❌ [ChatService] Execution Error: {e}", exc_info=True)
            raise e
