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

import time
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.document import VectorRetrieveFilter

# =============================================================================
# Tool Calling Models (OpenAI Compatible)
# =============================================================================


class FunctionCall(BaseModel):
    """OpenAI 兼容的函数调用定义"""

    name: str
    arguments: str  # JSON 字符串


class ToolCall(BaseModel):
    """OpenAI 兼容的工具调用定义"""

    id: str
    type: str = "function"
    function: FunctionCall


class FunctionCallDelta(BaseModel):
    """流式响应中的函数调用增量"""

    name: str | None = None
    arguments: str | None = None


class ToolCallDelta(BaseModel):
    """流式响应中的工具调用增量"""

    index: int
    id: str | None = None
    type: str | None = None
    function: FunctionCallDelta | None = None


# =============================================================================
# Chat Message Models
# =============================================================================


class ChatMessage(BaseModel):
    """OpenAI 兼容的聊天消息"""

    role: str
    content: str | None = None  # 可能为 null（当只有 tool_calls 时）
    name: str | None = None
    tool_calls: list[ToolCall] | None = None  # assistant 角色可能包含
    tool_call_id: str | None = None  # tool 角色必须包含
    additional_kwargs: dict[str, Any] | None = None  # 扩展元数据


class ChatCompletionRequest(BaseModel):
    model: str | None = None
    message: str  # 单条消息（必填）
    thread_id: str  # 会话ID（必填），用于持久化
    temperature: float | None = 0.7
    top_p: float | None = 1.0
    n: int | None = 1
    stream: bool | None = False
    stop: str | list[str] | None = None
    max_tokens: int | None = None
    presence_penalty: float | None = 0.0
    frequency_penalty: float | None = 0.0
    logit_bias: dict[str, float] | None = None
    user: str | None = None
    filter: VectorRetrieveFilter | None = None


class ChatCompletionChoice(BaseModel):
    index: int
    message: ChatMessage
    finish_reason: str | None = None


class ChatCompletionUsage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int = Field(default_factory=lambda: int(time.time()))
    model: str
    choices: list[ChatCompletionChoice]
    usage: ChatCompletionUsage | None = None


# =============================================================================
# Streaming Response Models
# =============================================================================


class ChatCompletionChunkDelta(BaseModel):
    """流式响应的增量内容"""

    role: str | None = None
    content: str | None = None
    tool_calls: list[ToolCallDelta] | None = None  # 工具调用增量


class ChatCompletionChunkChoice(BaseModel):
    index: int
    delta: ChatCompletionChunkDelta
    finish_reason: str | None = None


class ChatCompletionChunk(BaseModel):
    id: str
    object: str = "chat.completion.chunk"
    created: int = Field(default_factory=lambda: int(time.time()))
    model: str
    choices: list[ChatCompletionChunkChoice]
