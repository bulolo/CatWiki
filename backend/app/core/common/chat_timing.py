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


def mark_chat_timing(phase: str) -> None:
    """记录从 timing 开始到当前的耗时（ms）。"""
    timing = _chat_timing_var.get()
    if timing is None:
        return
    timing[phase] = (time.monotonic() - timing["_start"]) * 1000


def emit_chat_timing_card(thread_id: str | None = None) -> None:
    """打印一行结构化的 timing 卡片并清空 ContextVar。"""
    timing = _chat_timing_var.get()
    if timing is None:
        return
    pairs = " ".join(f"{k}={v:.0f}ms" for k, v in timing.items() if not k.startswith("_"))
    tid = f"thread={thread_id} " if thread_id else ""
    logging.getLogger("app.services.chat.timing").info(f"⏱️  [Timing] {tid}{pairs}")
    _chat_timing_var.set(None)
