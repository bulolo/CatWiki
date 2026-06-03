# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""OpenAI Responses API SSE 序列化。

把 ``_generate_graph_chunks`` 产出的事件流（``ChatCompletionChunk`` + status
dict）翻译成 OpenAI Responses API 的事件流：

- ``response.created``：流打开
- ``response.completed``：流关闭，始终携带 usage（input/output/total tokens）
- ``response.output_text.delta``：每段正文增量
- ``response.tool_call.delta``：工具调用增量
- ``response.tool_call.started`` / ``response.tool_call.completed``：工具执行边界
  （``completed`` 可携带 ``elapsed_ms``，前端 pill 实时显示耗时）
- ``response.pipeline_trace``：管线 timing 卡片（TTFB / 首字 / 总耗时），仅在
  站点 ``show_pipeline_trace=True`` 时由上游 yield，前端在气泡下方一行渲染
- ``response.knowledge_sources``：检索引用
- ``response.error``：异常事件
- ``[DONE]``：SSE 结束哨兵

参考：https://platform.openai.com/docs/api-reference/responses-streaming
"""

import json
from collections.abc import AsyncIterable, AsyncIterator
from typing import Any

from app.schemas.chat import ChatCompletionChunk, ResponsesAPIUsage

_DONE = "data: [DONE]\n\n"

# 用 dict 在 chunk 流里传 usage 给 ``stream_responses_api``。
# 选 "_" 前缀键避免和 ChatCompletionChunk 的普通 status dict 字段冲突。
_USAGE_SENTINEL_KEY = "_responses_usage"


def aggregate_usage_from_messages(messages: list) -> ResponsesAPIUsage | None:
    """从 LangChain messages 聚合 ``usage_metadata``。

    多轮 ReAct 会产生多条 AIMessage（多次 LLM 调用），每条带自己的
    ``usage_metadata`` —— 这里把它们 sum 出 Responses API 的总用量。
    没有任何 usage_metadata 时返回 None，让上层省略 usage 字段。
    """
    input_t = output_t = total_t = 0
    found = False
    for msg in messages:
        meta = getattr(msg, "usage_metadata", None) or {}
        if not meta:
            continue
        input_t += int(meta.get("input_tokens") or 0)
        output_t += int(meta.get("output_tokens") or 0)
        total_t += int(meta.get("total_tokens") or 0)
        found = True
    if not found:
        return None
    return ResponsesAPIUsage(
        input_tokens=input_t,
        output_tokens=output_t,
        total_tokens=total_t,
    )


def make_usage_chunk(usage: ResponsesAPIUsage) -> dict[str, Any]:
    """构造 chunk_source 末尾 yield 的 usage 标记 dict。

    供 ``ChatService.process_responses_request`` 的流式分支在 graph 完成后
    yield 一次，由 ``stream_responses_api`` 捕获并注入 ``response.completed``。
    """
    return {_USAGE_SENTINEL_KEY: usage.model_dump()}


def _sse(event_type: str, **fields: Any) -> str:
    """构造一行 SSE：``data: {"type": event_type, **fields}\\n\\n``。

    使用紧凑 ``separators=(",", ":")`` —— SSE/JSON spec 不在意空格，
    但严格客户端可能对 payload 格式敏感，保持紧凑输出以降低兼容风险。
    """
    payload: dict[str, Any] = {"type": event_type, **fields}
    return f"data: {json.dumps(payload, ensure_ascii=False, separators=(',', ':'))}\n\n"


def _response_envelope(response_id: str, status: str) -> dict[str, Any]:
    return {"id": response_id, "object": "response", "status": status}


def chunk_to_responses_events(chunk: ChatCompletionChunk | dict) -> list[str]:
    """把一个上游事件映射到 0..N 条 Responses-API SSE 行。

    ChatCompletionChunk → text/tool_call delta；
    dict → sources / tool start / tool completed 中转事件；
    usage 标记 dict 由调用方拦截，不在此发事件。
    其它形态返回空 list（消费方 ``yield from`` 时直接跳过）。
    """
    if isinstance(chunk, ChatCompletionChunk):
        delta = chunk.choices[0].delta
        if delta.content:
            return [_sse("response.output_text.delta", delta=delta.content)]
        if delta.tool_calls:
            return [
                _sse("response.tool_call.delta", tool_call=tc.model_dump(exclude_none=True))
                for tc in delta.tool_calls
            ]
        return []

    if isinstance(chunk, dict):
        if _USAGE_SENTINEL_KEY in chunk:
            return []
        if "sources" in chunk:
            return [_sse("response.knowledge_sources", sources=chunk["sources"])]
        if "pipeline_trace" in chunk:
            return [_sse("response.pipeline_trace", trace=chunk["pipeline_trace"])]
        status = chunk.get("status")
        if status == "tool_calling":
            return [_sse("response.tool_call.started", tool=chunk.get("tool"))]
        if status == "tool_completed":
            fields: dict[str, Any] = {"tool": chunk.get("tool")}
            tcid = chunk.get("tool_call_id")
            if tcid:
                fields["tool_call_id"] = tcid
            chunk_count = chunk.get("chunk_count")
            if chunk_count is not None:
                fields["chunk_count"] = chunk_count
            elapsed = chunk.get("elapsed_ms")
            if elapsed is not None:
                fields["elapsed_ms"] = elapsed
            return [_sse("response.tool_call.completed", **fields)]
        return []

    return []


async def stream_responses_api(
    response_id: str,
    chunk_source: AsyncIterable[ChatCompletionChunk | dict],
) -> AsyncIterator[str]:
    """顶层包装：开 → 流式翻译 → 关 + DONE。

    ``chunk_source`` 通常是 ``ChatService._generate_graph_chunks(...)`` 的产物，
    或任何能产出 ChatCompletionChunk / status dict 的 async iterable。
    若 chunk_source 在末尾 yield 一个 ``make_usage_chunk(...)`` 标记 dict，
    其 usage 会被注入到最终 ``response.completed`` event 的 envelope。
    """
    yield _sse("response.created", response=_response_envelope(response_id, "in_progress"))
    usage_payload: dict[str, Any] | None = None
    async for chunk in chunk_source:
        if isinstance(chunk, dict) and _USAGE_SENTINEL_KEY in chunk:
            usage_payload = chunk[_USAGE_SENTINEL_KEY]
            continue
        for line in chunk_to_responses_events(chunk):
            yield line
    envelope = _response_envelope(response_id, "completed")
    if usage_payload is not None:
        envelope["usage"] = usage_payload
    yield _sse("response.completed", response=envelope)
    yield _DONE


async def stream_responses_error(error_detail: str) -> AsyncIterator[str]:
    """单事件错误流：``response.error`` + ``[DONE]``，给入口层校验失败时用。"""
    yield _sse("response.error", error=error_detail)
    yield _DONE


__all__ = [
    "aggregate_usage_from_messages",
    "chunk_to_responses_events",
    "make_usage_chunk",
    "stream_responses_api",
    "stream_responses_error",
]
