# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""chat 子包 —— 聊天链路核心服务与协议序列化。

外部调用方应当**只**从本包顶层 import，不要直接引用子模块（``from
app.services.chat import ChatService`` 而非 ``from
app.services.chat.service import ChatService``），这样未来子模块重命名 / 拆分时
不会泄漏到调用方。

子模块结构：

| 文件 | 内容 |
|---|---|
| ``service``     | ``ChatService`` —— 聊天编排，DI 服务（FastAPI Depends 入口）|
| ``session``     | ``ChatSessionService`` —— 会话 CRUD，DI 服务 |
| ``history``     | ``ChatHistoryService`` —— 消息持久化，DI 服务 |
| ``tasks``       | 背景任务，``persist_chat_turn`` 等（FastAPI BackgroundTasks 喂的对象）|
| ``completions`` | OpenAI ``/v1/chat/completions`` chunk 构造与文本切分辅助 |
| ``responses``   | OpenAI ``/v1/chat/responses`` SSE 翻译层 |
"""

from app.services.chat.history import ChatHistoryService, get_chat_history_service
from app.services.chat.service import ChatService, get_chat_service
from app.services.chat.session import ChatSessionService, get_chat_session_service

__all__ = [
    "ChatService",
    "get_chat_service",
    "ChatSessionService",
    "get_chat_session_service",
    "ChatHistoryService",
    "get_chat_history_service",
]
