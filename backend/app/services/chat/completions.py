# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""OpenAI ``/v1/chat/completions`` chunk 构造与文本切分辅助。

这些函数没有 self 状态依赖，从 ``ChatService`` 抽出，便于复用与单元测试。
所有字段命名与 OpenAI ChatCompletionChunk schema 对齐。
"""

import json
import re
import time
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage

from app.schemas.chat import (
    ChatCompletionChunk,
    ChatCompletionChunkChoice,
    ChatCompletionChunkDelta,
)

# 默认流式切分参数
_DEFAULT_TARGET_LEN = 26
_DEFAULT_MAX_LEN = 48

# 中英文混合标点 + 换行：用于自然断句
_BOUNDARY_CHARS = "。！？；，、,.!?;\n"
# 一次性匹配"任意非边界字符 + 可选边界字符"，把整段答案切成可累积合并的片段
_SEGMENT_PATTERN = re.compile(rf"[^{re.escape(_BOUNDARY_CHARS)}]*[{re.escape(_BOUNDARY_CHARS)}]?")


def build_openai_chunk(
    *,
    chunk_id: str,
    model_name: str,
    content: str | None = None,
    role: str | None = None,
    tool_calls: list[dict[str, Any]] | None = None,
    finish_reason: str | None = None,
) -> ChatCompletionChunk:
    """统一构造 OpenAI 兼容 chunk，减少调用方的模板代码。"""
    delta = ChatCompletionChunkDelta(content=content, role=role, tool_calls=tool_calls)
    return ChatCompletionChunk(
        id=chunk_id,
        object="chat.completion.chunk",
        created=int(time.time()),
        model=model_name,
        choices=[
            ChatCompletionChunkChoice(
                index=0,
                delta=delta,
                finish_reason=finish_reason,
            )
        ],
    )


def split_text_for_stream(
    text: str,
    target_len: int = _DEFAULT_TARGET_LEN,
    max_len: int = _DEFAULT_MAX_LEN,
) -> list[str]:
    """把最终答案切成更自然的流式片段（优先在标点 / 换行处断开）。

    规则：累积小段直到达到 target_len 并遇到标点边界；超过 max_len 则强制
    切分。比逐字符 ``buf += ch`` 拼接的实现更省时（regex 一次性分词）。
    """
    if not text:
        return []

    # regex 把"非边界字符 + 边界"或纯非边界尾部切成 token；过滤空串
    segments = [m.group(0) for m in _SEGMENT_PATTERN.finditer(text) if m.group(0)]

    pieces: list[str] = []
    buf = ""
    for seg in segments:
        ends_on_boundary = bool(seg) and seg[-1] in _BOUNDARY_CHARS
        candidate = buf + seg
        if ends_on_boundary and len(candidate) >= target_len:
            pieces.append(candidate)
            buf = ""
        elif len(candidate) >= max_len:
            pieces.append(candidate)
            buf = ""
        else:
            buf = candidate

    if buf:
        pieces.append(buf)
    return pieces


def extract_last_turn_tool_calls(messages: list[BaseMessage]) -> list[dict[str, Any]]:
    """提取最后一轮工具调用，返回 OpenAI 兼容 tool_calls 数组。

    多轮 ReAct 历史下，如果把所有历史 tool_calls 一次性回发，第三方客户端会
    重复渲染。这里只取最近一条 AIMessage 携带的 tool_calls。
    """
    last_tool_call_msg: AIMessage | None = None
    for msg in reversed(messages):
        if isinstance(msg, AIMessage) and getattr(msg, "tool_calls", None):
            last_tool_call_msg = msg
            break

    if not last_tool_call_msg:
        return []

    tool_calls: list[dict[str, Any]] = []
    for tc in last_tool_call_msg.tool_calls:
        args = tc.get("args", {})
        arguments_json = args if isinstance(args, str) else json.dumps(args, ensure_ascii=False)
        tool_calls.append(
            {
                "index": len(tool_calls),
                "id": tc.get("id"),
                "type": "function",
                "function": {
                    "name": tc.get("name"),
                    "arguments": arguments_json,
                },
            }
        )
    return tool_calls
