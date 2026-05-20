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
from typing import Literal

from fastapi import BackgroundTasks, Depends
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_openai import ChatOpenAI
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai.graph import create_agent_graph
from app.core.ai.graph.checkpointer import get_checkpointer
from app.core.ai.message_utils import (
    convert_tool_call_chunk_to_openai,
    extract_sources_from_messages,
)
from app.core.ai.providers.chat import chat_provider
from app.core.common.ai_logging import rag_stats_var
from app.core.common.chat_timing import emit_chat_timing_card, mark_chat_timing, start_chat_timing
from app.core.infra.config import settings
from app.crud.site import crud_site
from app.db.database import get_db
from app.db.transaction import transactional
from app.schemas.chat import (
    ChatCompletionChoice,
    ChatCompletionChunk,
    ChatCompletionChunkChoice,
    ChatCompletionChunkDelta,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatMessage,
)
from app.services.chat.completions import (
    build_openai_chunk,
    extract_last_turn_tool_calls,
    split_text_for_stream,
)
from app.services.chat.history import ChatHistoryService, get_chat_history_service
from app.services.chat.responses import (
    aggregate_usage_from_messages,
    make_usage_chunk,
    stream_responses_api,
    stream_responses_error,
)
from app.services.chat.session import ChatSessionService, get_chat_session_service
from app.services.chat.tasks import persist_chat_turn

logger = logging.getLogger(__name__)


class ChatService:
    def __init__(
        self,
        db: AsyncSession,
        session_service: ChatSessionService,
        history_service: ChatHistoryService,
    ):
        self.db = db
        self.session_service = session_service
        self.history_service = history_service

    def _guard_channel_policy(
        self,
        *,
        channel: Literal["internal", "bot"],
        emit_tool_status_text: bool,
    ) -> None:
        """服务层策略守卫：避免通过新增 CE 入口误触发 EE/Bot 专属能力。"""
        from app.core.web.exceptions import ForbiddenException

        if channel != "bot" and emit_tool_status_text:
            raise ForbiddenException("emit_tool_status_text 仅允许 bot 渠道使用")

        if channel != "bot":
            return

        if settings.CATWIKI_EDITION != "enterprise":
            raise ForbiddenException("bot 渠道仅支持企业版")

        # 二次校验 license（即使入口层已做校验，也在服务层兜底）
        try:
            from app.ee.license import license_service
        except Exception as e:  # pragma: no cover - 仅用于部署形态差异兜底
            raise ForbiddenException("企业版模块未加载，bot 渠道不可用") from e

        is_licensed = (
            license_service.is_valid()
            if callable(getattr(license_service, "is_valid", None))
            else bool(getattr(license_service, "is_valid", False))
        )
        if not is_licensed:
            raise ForbiddenException("企业版授权无效，bot 渠道不可用")

    @staticmethod
    def _resolve_filter_ids(request) -> tuple[int, int | None]:
        """从 ChatCompletionRequest / ResponsesAPIRequest 的 filter 字段提取
        ``(site_id, tenant_id)``。``site_id=0`` 表示全局检索（无站点过滤）。"""
        site_id = request.filter.site_id if (request.filter and request.filter.site_id) else 0
        tenant_id = request.filter.tenant_id if request.filter else None
        return site_id, tenant_id

    async def generate_chat_chunks(
        self,
        graph,
        input_state: dict,
        config: dict,
        model_name: str,
        thread_id: str,
        background_tasks: BackgroundTasks,
        include_internal_events: bool = True,
        emit_openai_tool_chunks: bool | None = None,
        suppress_intermediate_tool_text: bool | None = None,
        emit_tool_status_text: bool = False,
    ) -> AsyncGenerator[ChatCompletionChunk | dict, None]:
        """核心流式响应生成器 - 产出原始 Chunk 对象或状态 dict"""
        # 💡 [亮点] 预初始化 ContextVar 统计字典，确保跨 Task 的数据能够注入
        rag_stats_var.set({})

        turn_start_time = time.time()
        full_response = ""
        sources = []
        chunk_id_prefix = f"chatcmpl-{uuid.uuid4()}"
        if emit_openai_tool_chunks is None:
            emit_openai_tool_chunks = include_internal_events
        if suppress_intermediate_tool_text is None:
            suppress_intermediate_tool_text = not include_internal_events
        buffer_tool_calls_until_end = emit_openai_tool_chunks and suppress_intermediate_tool_text

        # ⏱️ timing：tool 计数 + 是否已发首 token
        tool_index = 0
        first_token_marked = False

        try:
            # 💡 [亮点] 立即发送一个空的消息增量，用于“打桩”打破代理缓存
            yield build_openai_chunk(
                chunk_id=chunk_id_prefix,
                model_name=model_name,
                role="assistant",
            )
            # ⏱️ 这是第一个发到客户端的 chunk = HTTP 层 TTFB
            mark_chat_timing("ttfb")

            # 使用 v2 版本，它是 LangGraph 推荐的新版事件流驱动协议
            async for event in graph.astream_events(input_state, config, version="v2"):
                kind = event["event"]
                node_name = event.get("metadata", {}).get("langgraph_node")

                # 1. 处理 LLM 流式输出 (Token 和 Tool Delta)
                if kind == "on_chat_model_stream":
                    # 仅转发 agent 节点的流式输出，避免把 summarize 等内部节点结果暴露给客户端
                    if node_name and node_name != "agent":
                        continue

                    chunk_data = event.get("data", {}).get("chunk")
                    if not chunk_data:
                        continue

                    # 先处理工具调用增量，更新状态机后再决定是否输出文本内容
                    has_tool_call_chunks = bool(
                        hasattr(chunk_data, "tool_call_chunks") and chunk_data.tool_call_chunks
                    )

                    # (1) 发送工具调用增量 (Tool Call Deltas)
                    if (
                        has_tool_call_chunks
                        and emit_openai_tool_chunks
                        and not buffer_tool_calls_until_end
                    ):
                        for tc_chunk in chunk_data.tool_call_chunks:
                            cleaned_tc = convert_tool_call_chunk_to_openai(tc_chunk)
                            yield build_openai_chunk(
                                chunk_id=chunk_id_prefix,
                                model_name=model_name,
                                tool_calls=[cleaned_tc],
                            )

                    delta_content = chunk_data.content

                    # (2) 发送文本内容增量
                    # 在 suppress_intermediate_tool_text 模式下，正文统一在末尾一次性分段输出，
                    # 流中不再发送正文 token，避免第三方客户端在多轮工具时重复拼接正文。
                    should_emit_content = (
                        bool(delta_content) and not suppress_intermediate_tool_text
                    )
                    if should_emit_content:
                        full_response += delta_content
                        yield build_openai_chunk(
                            chunk_id=chunk_id_prefix,
                            model_name=model_name,
                            content=delta_content,
                        )
                        # ⏱️ 用户视角的"首 token"——第一个真正承载文本内容的 chunk
                        if not first_token_marked:
                            mark_chat_timing("first_token")
                            first_token_marked = True

                # 2. 工具/链/节点的开始与结束事件
                elif kind == "on_tool_start":
                    name = event.get("name", "tool")
                    tool_index += 1
                    mark_chat_timing(f"tool_{tool_index}_start")
                    logger.debug(f"🔧 [Stream] Tool Node Start: {name}")
                    tool_query = ""
                    tool_input = event.get("data", {}).get("input")
                    if isinstance(tool_input, dict):
                        q = tool_input.get("query")
                        if isinstance(q, str):
                            tool_query = q.strip()
                    elif isinstance(tool_input, str):
                        tool_query = tool_input.strip()

                    # OpenAI 兼容 keep-alive：在仅末尾输出正文的模式下，第三方客户端可能因长时间无 token 触发重试。
                    # 发送空 content 的标准 chunk 保持流活跃，避免重复请求导致的内容重复。
                    if suppress_intermediate_tool_text:
                        yield build_openai_chunk(
                            chunk_id=chunk_id_prefix,
                            model_name=model_name,
                            content="",
                        )
                    if emit_tool_status_text:
                        tool_line = (
                            f"\n> **`TOOL`** 检索中: `{tool_query}`\n"
                            if tool_query
                            else "\n> **`TOOL`** 检索中\n"
                        )
                        yield build_openai_chunk(
                            chunk_id=chunk_id_prefix,
                            model_name=model_name,
                            content=tool_line,
                        )
                    if include_internal_events:
                        yield {"status": "tool_calling", "tool": name}

                elif kind == "on_tool_end":
                    name = event.get("name", "tool")
                    mark_chat_timing(f"tool_{tool_index}_end")
                    logger.debug(f"✅ [Stream] Tool Node End: {name}")
                    if suppress_intermediate_tool_text:
                        yield build_openai_chunk(
                            chunk_id=chunk_id_prefix,
                            model_name=model_name,
                            content="",
                        )
                    if emit_tool_status_text:
                        yield build_openai_chunk(
                            chunk_id=chunk_id_prefix,
                            model_name=model_name,
                            content="> **`TOOL`** 检索完成\n",
                        )
                    if include_internal_events:
                        yield {"status": "tool_completed", "tool": name}

            # ⏱️ astream_events 已耗尽：langgraph 这一回合的推理 + 工具调用全部跑完
            mark_chat_timing("graph_done")

            # 3. 异步更新数据库记录 (改为传参模式，避免背景任务中连接已关闭)
            final_messages = []
            persistent_content = full_response

            state_snapshot = await graph.aget_state(config)
            if state_snapshot.values:
                final_messages = state_snapshot.values.get("messages", [])
                sources = extract_sources_from_messages(final_messages, from_last_turn=True)

                # 提取助手最后的文本回复
                final_response = ""
                for msg in reversed(final_messages):
                    if isinstance(msg, AIMessage) and msg.content:
                        final_response = msg.content
                        break
                persistent_content = final_response or full_response

            if include_internal_events and sources:
                yield {"sources": sources}

            # 第三方兼容模式：一次性发送完整 tool_calls，避免客户端对增量 tool_calls 处理异常导致重复正文。
            if buffer_tool_calls_until_end and final_messages:
                buffered_tool_calls = extract_last_turn_tool_calls(final_messages)
                if buffered_tool_calls:
                    yield build_openai_chunk(
                        chunk_id=chunk_id_prefix,
                        model_name=model_name,
                        tool_calls=buffered_tool_calls,
                    )

            # 工具链路场景：仅在最终阶段一次性输出完整答案，避免多轮工具中间文本重复/反复改写
            if suppress_intermediate_tool_text and persistent_content:
                full_response = persistent_content
                # 分段输出（OpenAI chunk）：在标点处优先断开，改善第三方客户端观感。
                # 不再人为 sleep —— 切分本身已经提供了天然节奏，
                # 第三方客户端有自己的渲染节流，服务端 sleep 只是叠加无意义延迟。
                for piece in split_text_for_stream(persistent_content):
                    if not piece:
                        continue
                    yield build_openai_chunk(
                        chunk_id=chunk_id_prefix,
                        model_name=model_name,
                        content=piece,
                    )

            # OpenAI 兼容流式结束块：显式发送 finish_reason=stop
            yield build_openai_chunk(
                chunk_id=chunk_id_prefix,
                model_name=model_name,
                finish_reason="stop",
            )

            background_tasks.add_task(
                persist_chat_turn, thread_id, final_messages, persistent_content
            )

            # 💡 [亮点] 在一次对话回合的所有事件结束后，打印最终的 Pipeline 汇总卡片
            # 这符合用户“在最后面”的预期，且能提供更完整的数据视角
            stats = rag_stats_var.get()
            if stats:
                total_duration = time.time() - turn_start_time
                # 💡 [优化] 标注检索轮次
                steps_count = stats.get("steps", 1)
                steps_info = f" ({steps_count} turns)" if steps_count > 1 else ""

                # 处理多查询展示 (避免过长)
                queries = stats.get("queries", [])
                if not queries and "query" in stats:  # 兼容单次记录
                    queries = [stats["query"]]

                if len(queries) > 1:
                    query_display = f"{queries[0][:60]}... (+{len(queries) - 1} searches)"
                elif queries:
                    query_display = f"{queries[0][:80]}{'...' if len(queries[0]) > 80 else ''}"
                else:
                    query_display = "N/A"

                summary_card = (
                    f"\n{'=' * 72}\n"
                    f"📋 [RAG Pipeline Summary]{steps_info}\n"
                    f"   Query    : {query_display}\n"
                    f"   Site     : {stats['site']}\n"
                    f"{'─' * 72}\n"
                    f"   1️⃣  Embedding : {stats['embedding_model']} ({stats['embedding_hash'][:8] if stats['embedding_hash'] else 'N/A'})\n"
                    f"      Backend   : {stats.get('vector_backend', 'N/A')}\n"
                    f"      Recalled  : {stats['recalled_count']} chunks → "
                    f"{stats['filtered_count']} "
                    f"{'after threshold (' + str(stats['threshold']) + ')' if stats.get('threshold_applied') else '(threshold N/A, ranking order)'}\n"
                    f"   2️⃣  Reranker  : {stats['rerank_model']}\n"
                    f"      Output    : {stats['output_count']} results (top_k={stats['top_k']})\n"
                    f"   3️⃣  Chat      : {model_name}\n"
                    f"{'─' * 72}\n"
                    f"   ⏱️  Total Dur : {total_duration:.3f}s (Retrieval: {stats['retrieval_duration']:.3f}s)\n"
                    f"{'=' * 72}"
                )
                logger.info(summary_card)
                # 清除 ContextVar，保持环境洁净
                rag_stats_var.set(None)

        except Exception as e:
            mark_chat_timing("error")
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
        finally:
            # ⏱️ 总耗时 + 打印 timing 卡片（无论成功/异常都跑）
            mark_chat_timing("total")
            emit_chat_timing_card(thread_id=thread_id)

    async def stream_graph_events(
        self,
        graph,
        input_state: dict,
        config: dict,
        model_name: str,
        thread_id: str,
        background_tasks: BackgroundTasks,
        include_internal_events: bool = True,
        emit_openai_tool_chunks: bool | None = None,
        suppress_intermediate_tool_text: bool | None = None,
        emit_tool_status_text: bool = False,
    ) -> AsyncGenerator[str, None]:
        """流式响应生成器 - 包装 generate_chat_chunks 并序列化为 SSE 格式"""
        async for chunk in self.generate_chat_chunks(
            graph,
            input_state,
            config,
            model_name,
            thread_id,
            background_tasks,
            include_internal_events=include_internal_events,
            emit_openai_tool_chunks=emit_openai_tool_chunks,
            suppress_intermediate_tool_text=suppress_intermediate_tool_text,
            emit_tool_status_text=emit_tool_status_text,
        ):
            if isinstance(chunk, ChatCompletionChunk):
                yield f"data: {chunk.model_dump_json()}\n\n"
            else:
                yield f"data: {json.dumps(chunk)}\n\n"

        yield "data: [DONE]\n\n"

    @transactional()
    async def initialize_chat_context(
        self,
        thread_id: str | None,
        site_id: int,
        user_id: str | None,
        message: str | None = None,
        messages: list[ChatMessage] | None = None,
        model_name: str | None = None,
        temperature: float = 0.7,
        tenant_id: int | None = None,
        source: str | None = None,
    ) -> tuple[ChatOpenAI, dict, dict, int | None]:
        """
        初始化聊天上下文：解析租户、构建 LLM、持久化首条消息并准备 Graph 状态。
        """
        # ⏱️ 启动 timing（幂等；同一请求多次调用以最早一次为准）
        start_chat_timing()

        # 1. 确定 thread_id (会话识别)
        # 如果没有显式传 thread_id，尝试将 user 字段映射为线索，否则生成 UUID
        if not thread_id:
            thread_id = (
                user_id if (user_id and len(user_id) > 5) else f"auto-{uuid.uuid4().hex[:12]}"
            )

        from langchain_core.messages import (
            AIMessage,
            SystemMessage,
        )

        # 2. 识别用户输入
        input_message = ""
        context_messages = []

        if messages:
            # 转换 OpenAI 消息到 LangChain 格式
            for m in messages:
                if m.role == "user":
                    context_messages.append(HumanMessage(content=m.content or ""))
                elif m.role == "assistant":
                    context_messages.append(AIMessage(content=m.content or ""))
                elif m.role == "system":
                    context_messages.append(SystemMessage(content=m.content or ""))

            # 取最后一条 user 消息的内容作为 trigger
            for m in reversed(messages):
                if m.role == "user":
                    input_message = m.content or ""
                    break
        else:
            input_message = message or ""
            context_messages = [HumanMessage(content=input_message)]

        # 3. 解析 site_id 和 tenant_id
        resolved_tenant_id = tenant_id  # 默认为传入参数
        if site_id:
            site = await crud_site.get(self.db, id=site_id)
            if site:
                resolved_tenant_id = site.tenant_id

        tenant_id = resolved_tenant_id

        # [Important] 设置当前租户上下文
        from app.core.infra.tenant import set_current_tenant

        set_current_tenant(tenant_id)

        # 4. [✨ 亮点] 打印全量 AI 栈配置快照（仅 DEBUG 模式）
        # 每请求遍历 4 个 section，命中 ConfigResolver 缓存即 0 DB；但生产环境
        # 日志噪声大且性价比低，所以默认关闭。需要排查时把 DEBUG 打开即可。
        if settings.DEBUG:
            from app.core.infra.config_resolver import ConfigResolver

            await ConfigResolver.log_ai_stack(tenant_id=tenant_id)

        # 5. 初始化 LLM (可能会触发详细的 Config Card 日志)
        llm = await chat_provider.get_model(
            tenant_id=tenant_id,
            model_name=model_name,
            temperature=temperature,
            purpose="初始化推理引擎",
        )

        # 6. 持久化 (如果这是该 thread 的新消息)
        try:
            await self.session_service.create_or_update(
                thread_id=thread_id,
                site_id=site_id,
                user_message=input_message,
                member_id=user_id,
                tenant_id=tenant_id,
                source=source,
            )
            # 仅保存最后一条用户输入到我们的历史表
            await self.history_service.save_message(
                thread_id=thread_id, role="user", content=input_message
            )
        except Exception as e:
            from app.core.web.exceptions import CatWikiError

            if isinstance(e, CatWikiError):
                raise
            logger.error(f"❌ [ChatService] Failed to persist chat session: {e}")

        # 6. 准备 Graph 初始状态
        initial_state = {
            "messages": context_messages,
            "site_id": site_id,
            "iteration_count": 0,
            "consecutive_empty_count": 0,
            "source_offset": 0,
            "seen_tool_hashes": [],
        }
        config = {
            "configurable": {"thread_id": thread_id, "site_id": site_id, "tenant_id": tenant_id}
        }

        mark_chat_timing("init")
        return llm, initial_state, config, tenant_id

    async def process_chat_request(
        self,
        request: ChatCompletionRequest,
        background_tasks: BackgroundTasks,
        channel: Literal["internal", "bot"] = "internal",
        include_internal_events: bool = True,
        emit_openai_tool_chunks: bool | None = None,
        suppress_intermediate_tool_text: bool | None = None,
        emit_tool_status_text: bool = False,
        source: str | None = None,
    ) -> ChatCompletionResponse | StreamingResponse:
        """核心聊天处理逻辑 (ReAct Agent)"""
        from app.core.web.exceptions import CatWikiError

        self._guard_channel_policy(
            channel=channel,
            emit_tool_status_text=emit_tool_status_text,
        )

        # 确定 site_id 和 tenant_id (从 filter 或 默认)
        site_id, tenant_id_val = self._resolve_filter_ids(request)

        try:
            llm, initial_state, config, tenant_id = await self.initialize_chat_context(
                thread_id=request.thread_id,
                site_id=site_id,
                user_id=request.user,
                message=request.message,
                messages=request.messages,
                model_name=request.model,
                temperature=request.temperature or 0.7,
                tenant_id=tenant_id_val,
                source=source,
            )
            # 更新 request 中的 thread_id 以便后续逻辑一致
            current_thread_id = config["configurable"]["thread_id"]
        except CatWikiError as e:
            # 流式模式下，将业务异常作为 SSE 错误事件返回，前端可在对话气泡中自然展示
            if request.stream:
                # 必须在 except 块内捕获值，因为 Python 3.12 会在块结束后清除 e
                error_detail = e.detail

                async def error_generator():
                    error_chunk = ChatCompletionChunk(
                        id=f"error-{uuid.uuid4()}",
                        model=request.model or "unknown",
                        choices=[
                            ChatCompletionChunkChoice(
                                index=0,
                                delta=ChatCompletionChunkDelta(content=f"⚠️ {error_detail}"),
                                finish_reason="stop",
                            )
                        ],
                    )
                    yield f"data: {error_chunk.model_dump_json()}\n\n"
                    yield "data: [DONE]\n\n"

                return StreamingResponse(error_generator(), media_type="text/event-stream")
            else:
                raise

        try:
            # 7. 执行推理
            if request.stream:

                async def protected_generator():
                    async with get_checkpointer() as cp:
                        graph = create_agent_graph(checkpointer=cp, model=llm)
                        # 调用 SSE 封装层
                        async for sse_chunk in self.stream_graph_events(
                            graph,
                            initial_state,
                            config,
                            llm.model_name,
                            current_thread_id,
                            background_tasks,
                            include_internal_events=include_internal_events,
                            emit_openai_tool_chunks=emit_openai_tool_chunks,
                            suppress_intermediate_tool_text=suppress_intermediate_tool_text,
                            emit_tool_status_text=emit_tool_status_text,
                        ):
                            yield sse_chunk

                return StreamingResponse(
                    protected_generator(),
                    media_type="text/event-stream",
                    headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
                )
            else:
                # 非流式响应
                async with get_checkpointer() as cp:
                    graph = create_agent_graph(checkpointer=cp, model=llm)
                    result = await graph.ainvoke(initial_state, config)

                    messages = result["messages"]
                    last_message = messages[-1] if messages else AIMessage(content="")
                    content = last_message.content if isinstance(last_message, BaseMessage) else ""

                    # 后台异步保存历史（与流式路径共用 persist_chat_turn）
                    background_tasks.add_task(
                        persist_chat_turn, current_thread_id, messages, content
                    )

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

    async def process_responses_request(
        self,
        request,  # ResponsesAPIRequest
        background_tasks: BackgroundTasks,
    ):
        """处理标准 Responses API 请求，复用 generate_chat_chunks 核心逻辑"""
        from app.core.web.exceptions import CatWikiError
        from app.schemas.chat import (
            ChatMessage,
            ResponseOutputContent,
            ResponseOutputItem,
            ResponsesAPIResponse,
        )

        if isinstance(request.input, str):
            message = request.input
            messages = None
            if request.instructions:
                messages = [
                    ChatMessage(role="system", content=request.instructions),
                    ChatMessage(role="user", content=request.input),
                ]
                message = request.input
        else:
            messages = request.input
            if request.instructions:
                messages = [ChatMessage(role="system", content=request.instructions)] + list(
                    messages
                )
            message = next((m.content for m in reversed(request.input) if m.role == "user"), "")

        site_id, tenant_id_val = self._resolve_filter_ids(request)

        try:
            llm, initial_state, config, _ = await self.initialize_chat_context(
                thread_id=request.previous_response_id,
                site_id=site_id,
                user_id=request.user,
                message=message,
                messages=messages,
                model_name=request.model,
                temperature=request.temperature or 0.7,
                tenant_id=tenant_id_val,
                source="web_chat",
                # TODO: max_output_tokens 待 chat_provider.get_model 支持后接入
            )
        except CatWikiError as e:
            if request.stream:
                return StreamingResponse(
                    stream_responses_error(e.detail),
                    media_type="text/event-stream",
                )
            raise

        response_id = config["configurable"]["thread_id"]
        model_name = llm.model_name

        if request.stream:

            async def _chunk_source():
                # 把 checkpointer 上下文包进来：流被消费完后 ``async with`` 退出，
                # serializer 只关心 chunk 流，不感知 graph 生命周期。
                async with get_checkpointer() as cp:
                    graph = create_agent_graph(checkpointer=cp, model=llm)
                    async for chunk in self.generate_chat_chunks(
                        graph,
                        initial_state,
                        config,
                        model_name,
                        response_id,
                        background_tasks,
                        include_internal_events=True,
                    ):
                        yield chunk
                    # 流式结束后从 checkpointer 拿最终 state.messages 聚合 usage，
                    # 通过 sentinel dict 透传给 stream_responses_api 注入完成事件。
                    try:
                        state = await graph.aget_state(config)
                        final_messages = (state.values or {}).get("messages") or []
                        usage = aggregate_usage_from_messages(final_messages)
                        if usage is not None:
                            yield make_usage_chunk(usage)
                    except Exception as e:
                        logger.warning("流式 usage 聚合失败（已忽略）: %s", e)

            return StreamingResponse(
                stream_responses_api(response_id, _chunk_source()),
                media_type="text/event-stream",
                headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
            )
        else:
            async with get_checkpointer() as cp:
                graph = create_agent_graph(checkpointer=cp, model=llm)
                result = await graph.ainvoke(initial_state, config)
                messages_out = result["messages"]
                last = messages_out[-1] if messages_out else AIMessage(content="")
                content = last.content if isinstance(last, BaseMessage) else ""

                background_tasks.add_task(persist_chat_turn, response_id, messages_out, content)

                return ResponsesAPIResponse(
                    id=response_id,
                    model=model_name,
                    output=[
                        ResponseOutputItem(
                            id=f"msg-{uuid.uuid4().hex[:12]}",
                            content=[ResponseOutputContent(text=content)],
                        )
                    ],
                    usage=aggregate_usage_from_messages(messages_out),
                )


def get_chat_service(
    db: AsyncSession = Depends(get_db),
    session_service: ChatSessionService = Depends(get_chat_session_service),
    history_service: ChatHistoryService = Depends(get_chat_history_service),
) -> ChatService:
    """获取 ChatService 实例的依赖注入函数"""
    return ChatService(db, session_service, history_service)
