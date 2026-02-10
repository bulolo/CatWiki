"""LangGraph 状态类型定义

定义 RAG 聊天图的共享状态
"""

from typing import TypedDict, Annotated, List, Optional
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class ChatGraphState(TypedDict):
    """RAG 聊天图的状态定义

    Attributes:
        messages: 对话消息列表，使用 add_messages reducer 支持追加
        context: 检索到的上下文内容
        citations: 引用来源列表
        should_retrieve: 是否需要执行检索（用于路由判断）
        rewritten_query: 改写后的查询（用于优化检索）
    """

    messages: Annotated[list[BaseMessage], add_messages]
    citations: list[dict]
    summary: str  # 对话摘要，用于长期记忆
    site_id: Optional[int]  # 站点ID上下文 (0=全局)
    iteration_count: int  # 工具调用迭代计数，用于限制最大循环次数
    consecutive_empty_count: int  # 连续空结果计数，用于智能终止


class RetrieveInput(TypedDict):
    """检索节点输入"""

    query: str
    filter: Optional[dict]


class GenerateInput(TypedDict):
    """生成节点输入"""

    messages: List[BaseMessage]
    context: str
