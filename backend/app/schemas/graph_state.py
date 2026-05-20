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

"""LangGraph 状态类型定义

定义 RAG 聊天图的共享状态
"""

from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class ChatGraphState(TypedDict):
    """RAG 聊天图的状态定义

    Attributes:
        messages: 对话消息列表，使用 add_messages reducer 支持追加
        sources: 引用来源列表
        summary: 对话摘要，用于长期记忆
        site_id: 站点ID上下文 (0=全局)
        iteration_count: 工具调用迭代计数，用于限制最大循环次数
        consecutive_empty_count: 连续空结果计数，用于智能终止
        source_offset: 跨工具调用累计的全局 source_index 起点
        seen_tool_hashes: 已见过的工具返回内容哈希集合，用于 O(1) 重复检测
    """

    messages: Annotated[list[BaseMessage], add_messages]
    sources: list[dict]
    summary: str
    site_id: int | None
    iteration_count: int
    consecutive_empty_count: int
    source_offset: int
    seen_tool_hashes: list[str]
