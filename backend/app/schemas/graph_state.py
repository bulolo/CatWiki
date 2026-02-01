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
    messages: Annotated[List[BaseMessage], add_messages]
    context: str
    citations: List[dict]
    should_retrieve: bool
    rewritten_query: str


class RetrieveInput(TypedDict):
    """检索节点输入"""
    query: str
    filter: Optional[dict]


class GenerateInput(TypedDict):
    """生成节点输入"""
    messages: List[BaseMessage]
    context: str
