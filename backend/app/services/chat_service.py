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

import json
import logging
import time
import uuid
from collections.abc import AsyncGenerator

from fastapi import BackgroundTasks
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_openai import ChatOpenAI

from app.core.checkpointer import get_checkpointer
from app.core.graph import create_agent_graph
from app.core.rag_utils import convert_tool_call_chunk_to_openai, extract_sources_from_messages
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
from app.services.chat_session_service import ChatSessionService
from app.core.dynamic_config_manager import dynamic_config_manager

logger = logging.getLogger(__name__)

class ChatService:
    @staticmethod
    async def stream_graph_events(
        graph,
        input_state: dict,
        config: dict,
        model_name: str,
        thread_id: str,
        background_tasks: BackgroundTasks,
    ) -> AsyncGenerator[str, None]:
        """流式响应生成器 - 适配 OpenAI SSE 格式（含 tool_calls 支持）"""
        full_response = ""
        sources = []

        # 生成唯一的 chunk ID 前缀
        chunk_id_prefix = f"chatcmpl-{uuid.uuid4()}"

        try:
            # 使用 v1 event 格式
            async for event in graph.astream_events(input_state, config, version="v1"):
                kind = event["event"]

                # 1. 处理 LLM 流式输出 (Token)
                if kind == "on_chat_model_stream":
                    chunk_data = event["data"]["chunk"]
                    chunk_content = chunk_data.content

                    # 处理文本内容
                    if chunk_content:
                        full_response += chunk_content

                        # 构造 OpenAI 兼容 chunk
                        chunk = ChatCompletionChunk(
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
                        yield f"data: {chunk.model_dump_json()}\n\n"

                    # 处理 tool_calls (如果存在)
                    if hasattr(chunk_data, "tool_call_chunks") and chunk_data.tool_call_chunks:
                        for tc_chunk in chunk_data.tool_call_chunks:
                            cleaned_tc = convert_tool_call_chunk_to_openai(tc_chunk)

                            chunk = ChatCompletionChunk(
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
                            yield f"data: {chunk.model_dump_json()}\n\n"

                # 2. 工具开始调用 - 发送状态指示
                elif kind == "on_tool_start":
                    tool_name = event.get("name", "unknown")
                    logger.debug(f"🔧 [Stream] Tool started: {tool_name}")
                    status_chunk = {"status": "tool_calling", "tool": tool_name}
                    yield f"data: {json.dumps(status_chunk)}\n\n"

            # 从 Checkpoint 获取最终状态以提取引用
            state_snapshot = await graph.aget_state(config)
            if state_snapshot.values:
                final_messages = state_snapshot.values.get("messages", [])
                sources = extract_sources_from_messages(final_messages, from_last_turn=True)

            # 发送 Sources (自定义协议)
            if sources:
                source_chunk = {"sources": sources}
                yield f"data: {json.dumps(source_chunk)}\n\n"

            # 发送 [DONE]
            yield "data: [DONE]\n\n"

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

                    await ChatSessionService.save_history_from_messages(
                        db=db, thread_id=thread_id, messages=final_messages
                    )

            background_tasks.add_task(save_history)

        except Exception as e:
            logger.error(f"❌ [ChatService] Stream error: {e}", exc_info=True)
            error_chunk = ChatCompletionChunk(
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
            yield f"data: {error_chunk.model_dump_json()}\n\n"
            yield "data: [DONE]\n\n"

    @classmethod
    async def process_chat_request(
        cls, request: ChatCompletionRequest, background_tasks: BackgroundTasks
    ) -> ChatCompletionResponse | StreamingResponse:
        """核心聊天处理逻辑 (ReAct Agent)"""

        # 1. 获取动态配置
        chat_config = await dynamic_config_manager.get_chat_config()

        current_model = chat_config["model"]
        current_api_key = chat_config["apiKey"]
        current_base_url = chat_config["baseUrl"]

        # 2. 初始化 ChatOpenAI
        llm = ChatOpenAI(
            model=current_model,
            api_key=current_api_key,
            base_url=current_base_url,
            temperature=request.temperature or 0.7,
            streaming=True,
        )

        # 3. 获取 site_id
        site_id = request.filter.site_id if (request.filter and request.filter.site_id) else 0

        # 4. 创建/更新数据库会话记录
        async with AsyncSessionLocal() as db:
            await ChatSessionService.create_or_update(
                db=db,
                thread_id=request.thread_id,
                site_id=site_id,
                user_message=request.message,
                member_id=request.user,
            )
            await ChatSessionService.save_message(
                db=db, thread_id=request.thread_id, role="user", content=request.message
            )

        # 5. 准备初始状态
        initial_state = {
            "messages": [HumanMessage(content=request.message)],
            "site_id": site_id,
            "iteration_count": 0,
            "consecutive_empty_count": 0,
        }
        config = {"configurable": {"thread_id": request.thread_id, "site_id": site_id}}

        try:
            # 6. 处理请求
            if request.stream:
                async def protected_generator():
                    async with get_checkpointer() as cp:
                        g = create_agent_graph(checkpointer=cp, model=llm)
                        async for chunk in cls.stream_graph_events(
                            g, initial_state, config, current_model, request.thread_id, background_tasks
                        ):
                            yield chunk

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

                    sources = extract_sources_from_messages(messages, from_last_turn=True)

                    async with AsyncSessionLocal() as db:
                        await ChatSessionService.update_assistant_response(
                            db=db, thread_id=request.thread_id, assistant_message=content
                        )
                        await ChatSessionService.save_history_from_messages(
                            db=db, thread_id=request.thread_id, messages=messages
                        )

                    return ChatCompletionResponse(
                        id=f"chatcmpl-{uuid.uuid4()}",
                        object="chat.completion",
                        created=int(time.time()),
                        model=current_model,
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
