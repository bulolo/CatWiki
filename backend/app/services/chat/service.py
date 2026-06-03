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
import contextlib
import json
import logging
import time
import uuid
from collections.abc import AsyncGenerator, AsyncIterable
from dataclasses import dataclass, field
from typing import Literal

from fastapi import BackgroundTasks, Depends
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
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
from app.core.common.chat_timing import (
    emit_chat_timing_card,
    get_chat_timing,
    get_chat_timing_phase,
    mark_chat_timing,
    start_chat_timing,
)
from app.core.infra.config import settings
from app.core.infra.tenant import set_current_tenant
from app.core.web.exceptions import CatWikiError, ForbiddenException
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
    ResponseOutputContent,
    ResponseOutputItem,
    ResponsesAPIResponse,
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

# 落库 / SSE 下发的 trace 字段白名单——只暴露前端会渲染的 3 个
# （ttfb / first_token / total）。tool_N_start/_end / init / graph_done 等中间
# 相位仍在内存 timing dict 里供日志卡片消费，不再吐给客户端 / 占 DB。
_TRACE_PUBLIC_KEYS = ("ttfb", "first_token", "total")


def _tool_chunk_id(tc_chunk) -> str | None:
    """从 LangChain ``tool_call_chunk`` 元素取 OpenAI tool_call_id。

    ToolCallChunk 是 TypedDict——**运行时即 dict**——所以 ``getattr(chunk, "id")``
    永远返回 None。这里同时兼容 dict 形态（当前实际形态）与对象形态（防 LangChain
    某次升级改成 Pydantic model）。**不要"简化"成纯 getattr**——曾经踩过坑，导致
    持久化 elapsed_ms 全部丢失。
    """
    if isinstance(tc_chunk, dict):
        return tc_chunk.get("id")
    return getattr(tc_chunk, "id", None)


def _count_chunks(tool_output) -> int | None:
    """从 on_tool_end 的输出里提取"结果条数"。

    LangGraph 工具返回形态多样：ToolMessage 对象、JSON 字符串、原生 list/dict。
    只有当解析后是 list（如知识库检索返回的 chunks）才有"N chunks"的语义，
    其他形态（错误信息字符串、单条文本等）返回 None，前端不渲染数量。
    """
    if tool_output is None:
        return None
    raw = getattr(tool_output, "content", tool_output)
    if isinstance(raw, list):
        return len(raw)
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            return None
        if isinstance(parsed, list):
            return len(parsed)
    return None


def _slim_trace(timing: dict | None) -> dict | None:
    """从完整 timing dict 中提取公开字段。

    要求至少有 ``ttfb`` 或 ``first_token`` 之一（仅 ``total`` 的孤立数据信息量不
    足，反而引入"半成品"噪音）。不满足返回 ``None``，调用方据此跳过下发/落库。
    """
    if not timing:
        return None
    slim = {k: timing[k] for k in _TRACE_PUBLIC_KEYS if k in timing}
    if "ttfb" not in slim and "first_token" not in slim:
        return None
    return slim


def _log_rag_summary(stats: dict, model_name: str, turn_start_time: float) -> None:
    """打印 RAG Pipeline 汇总日志卡片，并清空 ContextVar。"""
    total_duration = time.time() - turn_start_time
    steps_count = stats.get("steps", 1)
    steps_info = f" ({steps_count} turns)" if steps_count > 1 else ""

    queries = stats.get("queries", [])
    if not queries and "query" in stats:
        queries = [stats["query"]]
    if len(queries) > 1:
        query_display = f"{queries[0][:60]}... (+{len(queries) - 1} searches)"
    elif queries:
        q = queries[0]
        query_display = f"{q[:80]}{'...' if len(q) > 80 else ''}"
    else:
        query_display = "N/A"

    emb_hash = stats["embedding_hash"]
    threshold_info = (
        f"after threshold ({stats['threshold']})"
        if stats.get("threshold_applied")
        else "(threshold N/A, ranking order)"
    )
    logger.info(
        f"\n{'=' * 72}\n"
        f"📋 [RAG Pipeline Summary]{steps_info}\n"
        f"   Query    : {query_display}\n"
        f"   Site     : {stats['site']}\n"
        f"{'─' * 72}\n"
        f"   1️⃣  Embedding : {stats['embedding_model']} ({emb_hash[:8] if emb_hash else 'N/A'})\n"
        f"      Backend   : {stats.get('vector_backend', 'N/A')}\n"
        f"      Recalled  : {stats['recalled_count']} chunks → {stats['filtered_count']} {threshold_info}\n"
        f"   2️⃣  Reranker  : {stats['rerank_model']}\n"
        f"      Output    : {stats['output_count']} results (top_k={stats['top_k']})\n"
        f"   3️⃣  Chat      : {model_name}\n"
        f"{'─' * 72}\n"
        f"   ⏱️  Total Dur : {total_duration:.3f}s (Retrieval: {stats['retrieval_duration']:.3f}s)\n"
        f"{'=' * 72}"
    )
    rag_stats_var.set(None)


@dataclass
class _ToolCallTracker:
    """LLM 流里 tool_call_id ↔ run_id 的配对状态机。

    astream_events 里 on_chat_model_stream 给 tool_call_id，
    on_tool_start/end 给 run_id；两者通过 FIFO 配对，
    确保 on_tool_end 能取到正确的 tool_call_id 以注入 elapsed_ms。
    """

    current_index: int = 0
    _pending: list[str] = field(default_factory=list)
    _seen: set[str] = field(default_factory=set)
    _run_to_idx: dict[str, int] = field(default_factory=dict)
    _run_to_call_id: dict[str, str] = field(default_factory=dict)

    def register_chunk_id(self, tcid: str) -> None:
        """记录 LLM chunk 里的 tool_call_id，去重后入 FIFO。"""
        if tcid not in self._seen:
            self._seen.add(tcid)
            self._pending.append(tcid)

    def on_tool_start(self, run_id_raw: str | None) -> tuple[int, str]:
        """响应 on_tool_start 事件；返回 (1-based 序号, 实际 run_id)。"""
        self.current_index += 1
        run_id = run_id_raw or f"_anon_{self.current_index}"
        self._run_to_idx[run_id] = self.current_index
        if self._pending:
            self._run_to_call_id[run_id] = self._pending.pop(0)
        return self.current_index, run_id

    def on_tool_end(self, run_id_raw: str | None) -> tuple[int, str | None]:
        """响应 on_tool_end 事件；返回 (tool_index, tool_call_id | None)。"""
        run_id = run_id_raw or f"_anon_{self.current_index}"
        idx = self._run_to_idx.get(run_id, self.current_index)
        tcid = self._run_to_call_id.get(run_id)
        return idx, tcid


@dataclass
class ChatContext:
    """initialize_chat_context 的返回值：LLM 实例 + Graph 输入 + 会话配置。"""

    llm: ChatOpenAI
    initial_state: dict
    config: dict
    tenant_id: int | None

    @property
    def thread_id(self) -> str:
        return self.config["configurable"]["thread_id"]

    @property
    def model_name(self) -> str:
        return self.llm.model_name


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

        if not license_service.is_valid():
            raise ForbiddenException("企业版授权无效，bot 渠道不可用")

    @staticmethod
    def _resolve_filter_ids(request) -> tuple[int, int | None]:
        """从 ChatCompletionRequest / ResponsesAPIRequest 的 filter 字段提取
        ``(site_id, tenant_id)``。``site_id=0`` 表示全局检索（无站点过滤）。"""
        site_id = request.filter.site_id if (request.filter and request.filter.site_id) else 0
        tenant_id = request.filter.tenant_id if request.filter else None
        return site_id, tenant_id

    async def _resolve_show_pipeline_trace(
        self, site_id: int, channel: Literal["internal", "bot"] = "internal"
    ) -> bool:
        """读取站点 ``show_pipeline_trace`` 开关。

        - bot 渠道（Telegram / 企业微信 …）一律 False，trace 永远不下发
        - site_id 缺失 / 站点不存在 → False
        - 命中 ``crud_site.get`` 的 600s 缓存，admin 翻 toggle 时 update 会自动失效
        """
        if channel == "bot" or not site_id:
            return False
        site_obj = await crud_site.get(self.db, id=site_id)
        if site_obj is None:
            return False
        return bool(getattr(site_obj, "show_pipeline_trace", False))

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
        show_pipeline_trace: bool = False,
    ) -> AsyncGenerator[ChatCompletionChunk | dict, None]:
        """核心流式响应生成器 - 产出原始 Chunk 对象或状态 dict"""
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

        first_token_marked = False
        # {tool_call_id: elapsed_ms}，按 id 精确对位落库（并行工具不错位）
        tool_elapsed_by_id: dict[str, int] = {}
        tool_tracker = _ToolCallTracker()

        try:
            # 首个空 chunk：触发 HTTP flush，让代理/CDN 立即建立流连接
            yield build_openai_chunk(
                chunk_id=chunk_id_prefix,
                model_name=model_name,
                role="assistant",
            )
            # ⏱️ 第一个 chunk 到达客户端即为 HTTP 层 TTFB
            mark_chat_timing("ttfb")

            # _run_graph_stream 内部用 asyncio.Task 隔离：超时 → TimeoutError，
            # 客户端断连 → finally 取消 Task，中止飞行中的 LLM API 调用
            async for event in self._run_graph_stream(
                graph, input_state, config, settings.CHAT_STREAM_TIMEOUT_SECONDS
            ):
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

                    # (1) tool_call_chunks 一趟过：收集 tool_call_id 入 FIFO
                    # 给后续 on_tool_start 配对 run_id；同时按配置下发 OpenAI 增量
                    emit_tc_deltas = (
                        has_tool_call_chunks
                        and emit_openai_tool_chunks
                        and not buffer_tool_calls_until_end
                    )
                    if has_tool_call_chunks:
                        for tc_chunk in chunk_data.tool_call_chunks:
                            tcid = _tool_chunk_id(tc_chunk)
                            if tcid:
                                tool_tracker.register_chunk_id(tcid)
                            if emit_tc_deltas:
                                yield build_openai_chunk(
                                    chunk_id=chunk_id_prefix,
                                    model_name=model_name,
                                    tool_calls=[convert_tool_call_chunk_to_openai(tc_chunk)],
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
                    tool_idx, _run_id = tool_tracker.on_tool_start(event.get("run_id"))
                    mark_chat_timing(f"tool_{tool_idx}_start")
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
                    idx, tcid = tool_tracker.on_tool_end(event.get("run_id"))
                    mark_chat_timing(f"tool_{idx}_end")
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
                        completed_event: dict = {"status": "tool_completed", "tool": name}
                        if tcid:
                            completed_event["tool_call_id"] = tcid
                        chunk_count = _count_chunks(event.get("data", {}).get("output"))
                        if chunk_count is not None:
                            completed_event["chunk_count"] = chunk_count
                        if show_pipeline_trace:
                            start_ms = get_chat_timing_phase(f"tool_{idx}_start")
                            end_ms = get_chat_timing_phase(f"tool_{idx}_end")
                            if start_ms is not None and end_ms is not None:
                                elapsed = int(end_ms - start_ms)
                                completed_event["elapsed_ms"] = elapsed
                                if tcid:
                                    tool_elapsed_by_id[tcid] = elapsed
                        yield completed_event

            # ⏱️ astream_events 已耗尽：langgraph 这一回合的推理 + 工具调用全部跑完
            mark_chat_timing("graph_done")

            # 3. 提取最终状态 + 引用来源
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
                # 分段输出：在标点处优先断开，改善第三方客户端渲染观感
                for piece in split_text_for_stream(persistent_content):
                    if not piece:
                        continue
                    yield build_openai_chunk(
                        chunk_id=chunk_id_prefix,
                        model_name=model_name,
                        content=piece,
                    )

            # OpenAI 兼容：显式发送 finish_reason=stop 标志流结束
            yield build_openai_chunk(
                chunk_id=chunk_id_prefix,
                model_name=model_name,
                finish_reason="stop",
            )

            # 落库前先 mark + snapshot trace，避免 finally 清空 ContextVar 导致背景
            # 任务拿不到数据；同一 snapshot 既给后续 SSE 事件也给 persist_chat_turn
            trace_snapshot: dict | None = None
            tool_elapsed_for_persist: dict[str, int] | None = None
            if show_pipeline_trace:
                mark_chat_timing("total")
                trace_snapshot = _slim_trace(get_chat_timing())
                tool_elapsed_for_persist = tool_elapsed_by_id or None

            background_tasks.add_task(
                persist_chat_turn,
                thread_id,
                final_messages,
                persistent_content,
                trace=trace_snapshot,
                tool_elapsed=tool_elapsed_for_persist,
            )

            stats = rag_stats_var.get()
            if stats:
                _log_rag_summary(stats, model_name, turn_start_time)

            # 站点开关开启时，把上面已经 snapshot 好的 timing 卡片打包成 SSE 事件
            if trace_snapshot:
                yield {"pipeline_trace": trace_snapshot}

        except asyncio.CancelledError:
            mark_chat_timing("cancelled")
            logger.info(
                f"🔌 [ChatService] Client disconnected, graph cancelled: thread_id={thread_id}"
            )
            raise
        except TimeoutError:
            mark_chat_timing("timeout")
            logger.warning(
                f"⏱️ [ChatService] Stream timed out after {settings.CHAT_STREAM_TIMEOUT_SECONDS}s: "
                f"thread_id={thread_id}"
            )
            yield ChatCompletionChunk(
                id=f"timeout-{uuid.uuid4()}",
                model=model_name,
                choices=[
                    ChatCompletionChunkChoice(
                        index=0,
                        delta=ChatCompletionChunkDelta(content="\n\n[响应超时，请稍后重试]"),
                        finish_reason="stop",
                    )
                ],
            )
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
            # overwrite=False：避免覆盖 snapshot 时刻已经写入的 total，保持 SSE/DB/日志一致
            mark_chat_timing("total", overwrite=False)
            emit_chat_timing_card(thread_id=thread_id)

    @staticmethod
    async def _run_graph_stream(
        graph,
        input_state: dict,
        config: dict,
        timeout_s: float,
    ) -> AsyncGenerator:
        """在独立 asyncio.Task 里运行 graph.astream_events，隔离超时与断连两种取消路径。

        - 超时：asyncio.timeout 触发 TimeoutError，经 _exc 列表传递给 consumer
        - 断连：consumer 的 finally 块调用 task.cancel()，将 CancelledError 注入
          producer 当前阻塞的 await（通常是飞行中的 LLM API 调用），避免后端无效计算
        """
        _done = object()
        queue: asyncio.Queue = asyncio.Queue()
        _exc: list[BaseException] = []

        async def _produce() -> None:
            try:
                async with asyncio.timeout(timeout_s):
                    async for event in graph.astream_events(input_state, config, version="v2"):
                        await queue.put(event)
            except asyncio.CancelledError:
                raise
            except BaseException as e:
                _exc.append(e)
            finally:
                with contextlib.suppress(Exception):
                    queue.put_nowait(_done)

        task = asyncio.create_task(_produce())
        try:
            while True:
                item = await queue.get()
                if item is _done:
                    if _exc:
                        raise _exc[0]
                    break
                yield item
        finally:
            if not task.done():
                task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await task

    async def _stream_as_openai_sse(
        self,
        chunks: AsyncIterable[ChatCompletionChunk | dict],
    ) -> AsyncGenerator[str, None]:
        """将 chunk 流序列化为 OpenAI 兼容 SSE 文本行（data: ...\\n\\n）。"""
        async for chunk in chunks:
            if isinstance(chunk, ChatCompletionChunk):
                yield f"data: {chunk.model_dump_json()}\n\n"
            else:
                yield f"data: {json.dumps(chunk)}\n\n"
        yield "data: [DONE]\n\n"

    async def _generate_graph_chunks(
        self,
        ctx: ChatContext,
        background_tasks: BackgroundTasks,
        *,
        include_internal_events: bool = True,
        emit_openai_tool_chunks: bool | None = None,
        suppress_intermediate_tool_text: bool | None = None,
        emit_tool_status_text: bool = False,
        show_pipeline_trace: bool = False,
        emit_usage: bool = False,
    ) -> AsyncGenerator[ChatCompletionChunk | dict, None]:
        """创建图并驱动 generate_chat_chunks，两条 API 路径（completions / responses）共用。

        emit_usage=True 时在所有 chunk 之后追加 make_usage_chunk，供 Responses API 的
        stream_responses_api 注入 response.completed.usage；completions 路径不需要此行为。
        """
        async with get_checkpointer() as cp:
            graph = create_agent_graph(checkpointer=cp, model=ctx.llm)
            async for chunk in self.generate_chat_chunks(
                graph,
                ctx.initial_state,
                ctx.config,
                ctx.model_name,
                ctx.thread_id,
                background_tasks,
                include_internal_events=include_internal_events,
                emit_openai_tool_chunks=emit_openai_tool_chunks,
                suppress_intermediate_tool_text=suppress_intermediate_tool_text,
                emit_tool_status_text=emit_tool_status_text,
                show_pipeline_trace=show_pipeline_trace,
            ):
                yield chunk
            if emit_usage:
                try:
                    state = await graph.aget_state(ctx.config)
                    final_msgs = (state.values or {}).get("messages") or []
                    usage = aggregate_usage_from_messages(final_msgs)
                    if usage is not None:
                        yield make_usage_chunk(usage)
                except Exception as e:
                    logger.warning("流式 usage 聚合失败（已忽略）: %s", e)

    async def _invoke_graph_blocking(
        self,
        ctx: ChatContext,
        background_tasks: BackgroundTasks,
    ) -> tuple[list[BaseMessage], str]:
        """非流式路径：执行图推理，落库，返回 (messages, content)。"""
        async with get_checkpointer() as cp:
            graph = create_agent_graph(checkpointer=cp, model=ctx.llm)
            result = await graph.ainvoke(ctx.initial_state, ctx.config)
        messages = result["messages"]
        last = messages[-1] if messages else AIMessage(content="")
        content = last.content if isinstance(last, BaseMessage) else ""
        background_tasks.add_task(persist_chat_turn, ctx.thread_id, messages, content)
        return messages, content

    @staticmethod
    def _make_sse_response(generator: AsyncIterable[str]) -> StreamingResponse:
        """构造带标准流式响应头的 SSE StreamingResponse。"""
        return StreamingResponse(
            generator,
            media_type="text/event-stream",
            headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
        )

    @staticmethod
    async def _error_sse_stream(model: str, detail: str) -> AsyncGenerator[str, None]:
        """业务异常流：单个 error chunk + DONE，供流式模式下在气泡内展示错误。"""
        chunk = ChatCompletionChunk(
            id=f"error-{uuid.uuid4()}",
            model=model,
            choices=[
                ChatCompletionChunkChoice(
                    index=0,
                    delta=ChatCompletionChunkDelta(content=f"⚠️ {detail}"),
                    finish_reason="stop",
                )
            ],
        )
        yield f"data: {chunk.model_dump_json()}\n\n"
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
    ) -> ChatContext:
        """初始化聊天上下文：解析租户、构建 LLM、持久化首条消息并准备 Graph 状态。"""
        # ⏱️ 启动 timing（幂等；同一请求多次调用以最早一次为准）
        start_chat_timing()

        # 1. 确定 thread_id (会话识别)
        # 没有显式传 thread_id 一律生成新 UUID —— user_id 是「访客身份」，跨会话稳定，
        # 把它当 thread_id 会让同访客的所有"新对话"全部 pin 到同一条 session 上。
        # member_id 单独走 create_or_update，足够追踪是谁发起的。
        if not thread_id:
            thread_id = f"auto-{uuid.uuid4().hex[:12]}"

        # 2. 识别用户输入
        input_message = ""
        context_messages = []

        if messages:
            for m in messages:
                if m.role == "user":
                    context_messages.append(HumanMessage(content=m.content or ""))
                elif m.role == "assistant":
                    context_messages.append(AIMessage(content=m.content or ""))
                elif m.role == "system":
                    context_messages.append(SystemMessage(content=m.content or ""))

            for m in reversed(messages):
                if m.role == "user":
                    input_message = m.content or ""
                    break
        else:
            input_message = message or ""
            context_messages = [HumanMessage(content=input_message)]

        # 3. 解析 site_id 和 tenant_id
        if site_id and (site := await crud_site.get(self.db, id=site_id)):
            tenant_id = site.tenant_id

        set_current_tenant(tenant_id)

        # 4. 打印全量 AI 栈配置快照（仅 DEBUG 模式）
        # 命中 ConfigResolver 缓存时无额外 DB 查询；生产日志噪声较大，默认关闭
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

        # 6. 持久化首条用户消息
        try:
            await self.session_service.create_or_update(
                thread_id=thread_id,
                site_id=site_id,
                user_message=input_message,
                member_id=user_id,
                tenant_id=tenant_id,
                source=source,
            )
            await self.history_service.save_message(
                thread_id=thread_id, role="user", content=input_message
            )
        except Exception as e:
            if isinstance(e, CatWikiError):
                raise
            logger.error(f"❌ [ChatService] Failed to persist chat session: {e}")

        # 7. 准备 Graph 初始状态
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
        return ChatContext(llm=llm, initial_state=initial_state, config=config, tenant_id=tenant_id)

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
        self._guard_channel_policy(
            channel=channel,
            emit_tool_status_text=emit_tool_status_text,
        )

        site_id, tenant_id_val = self._resolve_filter_ids(request)
        # bot 渠道一律关闭 trace；internal 渠道（OpenAI 兼容 API）按站点开关决定
        show_pipeline_trace = await self._resolve_show_pipeline_trace(site_id, channel=channel)

        try:
            ctx = await self.initialize_chat_context(
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
        except CatWikiError as e:
            # 流式模式下将业务异常作为 SSE 错误事件返回，前端可在气泡内自然展示
            # 必须在 except 块内捕获 e.detail，Python 3.12 会在块结束后清除 e
            if request.stream:
                return StreamingResponse(
                    self._error_sse_stream(request.model or "unknown", e.detail),
                    media_type="text/event-stream",
                )
            raise

        try:
            if request.stream:
                return self._make_sse_response(
                    self._stream_as_openai_sse(
                        self._generate_graph_chunks(
                            ctx,
                            background_tasks,
                            include_internal_events=include_internal_events,
                            emit_openai_tool_chunks=emit_openai_tool_chunks,
                            suppress_intermediate_tool_text=suppress_intermediate_tool_text,
                            emit_tool_status_text=emit_tool_status_text,
                            show_pipeline_trace=show_pipeline_trace,
                        )
                    )
                )

            messages, content = await self._invoke_graph_blocking(ctx, background_tasks)
            return ChatCompletionResponse(
                id=f"chatcmpl-{uuid.uuid4()}",
                object="chat.completion",
                created=int(time.time()),
                model=ctx.model_name,
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
            raise

    async def process_responses_request(
        self,
        request,  # ResponsesAPIRequest
        background_tasks: BackgroundTasks,
    ):
        """处理标准 Responses API 请求，通过 _generate_graph_chunks 驱动图执行，Responses API 格式序列化"""
        if isinstance(request.input, str):
            message = request.input
            messages = None
            if request.instructions:
                messages = [
                    ChatMessage(role="system", content=request.instructions),
                    ChatMessage(role="user", content=request.input),
                ]
        else:
            messages = request.input
            if request.instructions:
                messages = [ChatMessage(role="system", content=request.instructions)] + list(
                    messages
                )
            message = next((m.content for m in reversed(request.input) if m.role == "user"), "")

        site_id, tenant_id_val = self._resolve_filter_ids(request)
        # Responses API 路径仅 web 渠道使用，trace 由站点开关控制
        show_pipeline_trace = await self._resolve_show_pipeline_trace(site_id, channel="internal")

        try:
            ctx = await self.initialize_chat_context(
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

        try:
            if request.stream:
                return self._make_sse_response(
                    stream_responses_api(
                        ctx.thread_id,
                        self._generate_graph_chunks(
                            ctx,
                            background_tasks,
                            include_internal_events=True,
                            show_pipeline_trace=show_pipeline_trace,
                            emit_usage=True,
                        ),
                    )
                )

            messages, content = await self._invoke_graph_blocking(ctx, background_tasks)
            return ResponsesAPIResponse(
                id=ctx.thread_id,
                model=ctx.model_name,
                output=[
                    ResponseOutputItem(
                        id=f"msg-{uuid.uuid4().hex[:12]}",
                        content=[ResponseOutputContent(text=content)],
                    )
                ],
                usage=aggregate_usage_from_messages(messages),
            )
        except Exception as e:
            logger.error(f"❌ [ChatService] Execution Error: {e}", exc_info=True)
            raise


def get_chat_service(
    db: AsyncSession = Depends(get_db),
    session_service: ChatSessionService = Depends(get_chat_session_service),
    history_service: ChatHistoryService = Depends(get_chat_history_service),
) -> ChatService:
    """获取 ChatService 实例的依赖注入函数"""
    return ChatService(db, session_service, history_service)
