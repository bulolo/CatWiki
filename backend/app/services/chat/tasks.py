# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""背景任务：把一轮对话的消息 + 助手最终回复持久化。

调用方一律走 ``background_tasks.add_task(persist_chat_turn, ...)``。函数自己开新
session（请求线程的 session 在背景任务触发时通常已关闭），失败只记日志不再抛
——背景任务没有调用方接收异常。
"""

import logging

from langchain_core.messages import BaseMessage

from app.db.database import AsyncSessionLocal
from app.services.chat.history import ChatHistoryService
from app.services.chat.session import ChatSessionService

logger = logging.getLogger(__name__)


async def persist_chat_turn(
    thread_id: str,
    messages: list[BaseMessage],
    assistant_content: str | None,
    *,
    trace: dict | None = None,
    tool_elapsed: dict[str, int] | None = None,
) -> None:
    """把本轮的所有 graph 消息 + 助手最终回复落到数据库。

    Args:
        thread_id:        LangGraph thread_id（对应 ChatSession.thread_id）。
        messages:         graph 状态里本轮的全部消息（含 tool calls / tool results）。
        assistant_content: 助手最终回复正文。``None`` 或空时只写 history 不更新
                           ChatSession.last_message —— 适用于"只跑了工具但没出
                           最终答复"的边缘场景。
        trace:            站点 ``show_pipeline_trace=True`` 时由 stream 末尾 snapshot
                           的 chat_timing 字典（已 slim 到 ttfb/first_token/total）。
                           落到最后一条 assistant ChatMessage 的 ``additional_kwargs.trace``。
        tool_elapsed:     与 ``trace`` 同源，``{tool_call_id: elapsed_ms}`` 映射。
                           按 id 精确匹配写入对应 tool_call JSON 的 ``elapsed_ms`` 字段，
                           并行工具场景也不会错位。
    """
    try:
        async with AsyncSessionLocal() as db:
            session_service = ChatSessionService(db)
            history_service = ChatHistoryService(db)

            if assistant_content:
                await session_service.update_assistant_response(
                    thread_id=thread_id, assistant_message=assistant_content
                )

            if messages:
                saved = await history_service.save_turn_messages(
                    thread_id=thread_id,
                    messages=messages,
                    trace=trace,
                    tool_elapsed=tool_elapsed,
                )
                logger.debug(f"💾 [BackgroundTask] Saved {saved} messages for thread={thread_id}")
            else:
                logger.warning(f"⚠️ [BackgroundTask] No messages to save for thread={thread_id}")
    except Exception as e:
        logger.error(
            f"❌ [BackgroundTask] persist_chat_turn failed for thread={thread_id}: {e}",
            exc_info=True,
        )
