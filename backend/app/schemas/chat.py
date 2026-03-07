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

from pydantic import BaseModel, ConfigDict, Field, model_validator

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
    messages: list[ChatMessage] | None = None  # 标准 OpenAI 格式：消息列表
    message: str | None = None  # legacy：单条消息
    thread_id: str | None = None  # legacy：会话ID
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


class InternalChatCompletionRequest(BaseModel):
    """内部聊天接口请求（非 OpenAI 兼容）"""

    model_config = ConfigDict(extra="forbid")

    message: str
    thread_id: str | None = None
    temperature: float | None = 0.7
    stream: bool | None = False
    user: str | None = None
    filter: VectorRetrieveFilter | None = None


class OpenAIChatCompletionRequest(BaseModel):
    """严格 OpenAI 兼容聊天请求（用于对外 Bot API）"""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    model: str
    messages: list[ChatMessage]
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
    response_format: dict[str, Any] | None = None
    seed: int | None = None
    tools: list[dict[str, Any]] | None = None
    tool_choice: str | dict[str, Any] | None = None
    stream_options: dict[str, Any] | None = None
    reasoning_effort: str | None = None
    verbosity: str | None = None
    service_tier: str | None = Field(default=None, alias="serviceTier")

    @model_validator(mode="before")
    @classmethod
    def normalize_undefined_values(cls, data: Any) -> Any:
        """兼容部分 OpenAI 客户端会传递的字符串 '[undefined]' 占位值。"""
        if not isinstance(data, dict):
            return data
        for key, value in list(data.items()):
            if isinstance(value, str) and value.strip() in {"[undefined]", "undefined"}:
                data[key] = None
        return data


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


# =============================================================================
# Models List Models
# =============================================================================


class ModelObject(BaseModel):
    id: str
    object: str = "model"
    created: int = Field(default_factory=lambda: int(time.time()))
    owned_by: str = "catwiki"


class ModelList(BaseModel):
    object: str = "list"
    data: list[ModelObject]
