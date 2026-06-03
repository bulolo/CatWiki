# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""Chat 请求 timing 埋点。

用 ContextVar 在请求生命周期内累积关键时间戳（毫秒级），结束时打印一行结构化
日志：``⏱️  [Timing] thread=xxx ttfb=42ms first_token=510ms graph_done=2300ms ...``，
``grep + awk`` 即可出延迟分布。

每个键的值是「从 ``start_chat_timing`` 到该 phase 的毫秒数」；调用 ``mark_chat_timing``
会把当前 phase 的毫秒数累加进 dict，``emit_chat_timing_card`` 在请求末尾打印并清空。
"""

import logging
import time
from contextvars import ContextVar

_chat_timing_var: ContextVar[dict | None] = ContextVar("chat_timing", default=None)


def start_chat_timing() -> None:
    """初始化 timing；幂等——如果已经开始就不动。"""
    if _chat_timing_var.get() is None:
        _chat_timing_var.set({"_start": time.monotonic()})


def mark_chat_timing(phase: str, *, overwrite: bool = True) -> None:
    """记录从 timing 开始到当前的耗时（ms）。

    ``overwrite=False`` 时若该 phase 已存在则跳过——避免在 ``finally`` 块再次打点
    时覆盖在 try 末尾 snapshot 时刻的值。
    """
    timing = _chat_timing_var.get()
    if timing is None:
        return
    if not overwrite and phase in timing:
        return
    timing[phase] = (time.monotonic() - timing["_start"]) * 1000


def get_chat_timing() -> dict | None:
    """返回当前 timing 字典副本（去掉 ``_start`` 内部字段）。

    在 chat 流末尾用来打包 ``response.pipeline_trace`` 事件——只在需要透传给客户端
    时调用，普通日志路径仍走 ``emit_chat_timing_card``。
    """
    timing = _chat_timing_var.get()
    if timing is None:
        return None
    return {k: v for k, v in timing.items() if not k.startswith("_")}


def get_chat_timing_phase(phase: str) -> float | None:
    """轻量查询单个 phase 的耗时（ms）——直接读 ContextVar 不做 dict 拷贝。

    适合 hot path（如每个 ``on_tool_end`` 取 elapsed）；需要整份 snapshot 走
    ``get_chat_timing()``。
    """
    timing = _chat_timing_var.get()
    if timing is None:
        return None
    return timing.get(phase)


def emit_chat_timing_card(thread_id: str | None = None) -> None:
    """打印一行结构化的 timing 卡片并清空 ContextVar。"""
    timing = _chat_timing_var.get()
    if timing is None:
        return
    pairs = " ".join(f"{k}={v:.0f}ms" for k, v in timing.items() if not k.startswith("_"))
    tid = f"thread={thread_id} " if thread_id else ""
    logging.getLogger("app.services.chat.timing").info(f"⏱️  [Timing] {tid}{pairs}")
    _chat_timing_var.set(None)
