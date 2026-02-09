# Copyright 2024 CatWiki Authors
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

from typing import List, Optional, Union, Dict, Any
from pydantic import BaseModel, Field
import time

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
    name: Optional[str] = None
    arguments: Optional[str] = None


class ToolCallDelta(BaseModel):
    """流式响应中的工具调用增量"""
    index: int
    id: Optional[str] = None
    type: Optional[str] = None
    function: Optional[FunctionCallDelta] = None


# =============================================================================
# Chat Message Models
# =============================================================================


class ChatMessage(BaseModel):
    """OpenAI 兼容的聊天消息"""
    role: str
    content: Optional[str] = None  # 可能为 null（当只有 tool_calls 时）
    name: Optional[str] = None
    tool_calls: Optional[List[ToolCall]] = None  # assistant 角色可能包含
    tool_call_id: Optional[str] = None  # tool 角色必须包含


class ChatCompletionRequest(BaseModel):
    model: str = "gpt-3.5-turbo"
    message: str  # 单条消息（必填）
    thread_id: str  # 会话ID（必填），用于持久化
    temperature: Optional[float] = 0.7
    top_p: Optional[float] = 1.0
    n: Optional[int] = 1
    stream: Optional[bool] = False
    stop: Optional[Union[str, List[str]]] = None
    max_tokens: Optional[int] = None
    presence_penalty: Optional[float] = 0.0
    frequency_penalty: Optional[float] = 0.0
    logit_bias: Optional[Dict[str, float]] = None
    user: Optional[str] = None
    filter: Optional[VectorRetrieveFilter] = None


class ChatCompletionChoice(BaseModel):
    index: int
    message: ChatMessage
    finish_reason: Optional[str] = None


class ChatCompletionUsage(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatCompletionResponse(BaseModel):
    id: str
    object: str = "chat.completion"
    created: int = Field(default_factory=lambda: int(time.time()))
    model: str
    choices: List[ChatCompletionChoice]
    usage: Optional[ChatCompletionUsage] = None


# =============================================================================
# Streaming Response Models
# =============================================================================


class ChatCompletionChunkDelta(BaseModel):
    """流式响应的增量内容"""
    role: Optional[str] = None
    content: Optional[str] = None
    tool_calls: Optional[List[ToolCallDelta]] = None  # 工具调用增量


class ChatCompletionChunkChoice(BaseModel):
    index: int
    delta: ChatCompletionChunkDelta
    finish_reason: Optional[str] = None


class ChatCompletionChunk(BaseModel):
    id: str
    object: str = "chat.completion.chunk"
    created: int = Field(default_factory=lambda: int(time.time()))
    model: str
    choices: List[ChatCompletionChunkChoice]
