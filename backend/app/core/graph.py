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

"""LangGraph ReAct Agent
1. ReAct 循环: Agent -> Tools -> Agent ... -> End
2. 支持多轮检索和推理
3. 动态引用提取
"""

import logging
import json
from typing import Literal, List, Annotated

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage, ToolMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode, tools_condition

from app.schemas.graph_state import ChatGraphState
from app.services.vector_service import VectorService

logger = logging.getLogger(__name__)


# =============================================================================
# 工具定义
# =============================================================================


@tool
async def search_knowledge_base(query: str) -> str:
    """在知识库中搜索相关信息。
    
    当用户的问题需要事实依据、文档支持或你不知道答案时，**必须**使用此工具。
    可以多次调用此工具以查找不同方面的信息。
    
    Args:
        query: 搜索查询词。应该是针对特定信息的清晰问题。
    
    Returns:
        JSON 格式的字符串，包含搜索结果列表。
        每个结果包含 'content' (内容摘录) 和 'metadata' (包含 title, document_id 等)。
    """
    logger.info(f"🔧 [Tool] search_knowledge_base called with query: {query}")

    try:
        # 执行检索
        retrieved_docs = await VectorService.retrieve(
            query=query,
            k=5,
            threshold=0.3,
        )

        if not retrieved_docs:
            return "未找到相关文档。请尝试尝试使用更泛化或同义的关键词搜索。"

        # 格式化为 JSON 以便 LLM 和引用提取逻辑使用
        results = []
        for doc in retrieved_docs:
            results.append({
                "content": doc.content,
                "metadata": {
                    "document_id": doc.document_id,
                    "title": doc.document_title,
                    "score": doc.score,
                    # 尽可能保留更多元数据供引用使用
                    **doc.metadata
                }
            })
        
        # 返回 JSON 字符串，LLM 可以理解结构化数据
        return json.dumps(results, ensure_ascii=False)

    except Exception as e:
        logger.error(f"❌ [Tool] Knowledge base search failed: {e}", exc_info=True)
        return f"搜索知识库时出错: {str(e)}"


# 工具列表
tools = [search_knowledge_base]


# =============================================================================
# 辅助函数：引用提取
# =============================================================================

def extract_citations_from_messages(messages: List[BaseMessage]) -> List[dict]:
    """从历史消息的 ToolMessage 中提取引用"""
    citations = {}
    
    for msg in messages:
        if isinstance(msg, ToolMessage) and msg.name == "search_knowledge_base":
            try:
                # 尝试解析 JSON 输出
                content = msg.content
                if isinstance(content, str):
                    results = json.loads(content)
                else:
                    results = content
                
                if isinstance(results, list):
                    for doc in results:
                        if isinstance(doc, dict) and "metadata" in doc:
                            meta = doc["metadata"]
                            doc_id = meta.get("document_id")
                            if doc_id:
                                #去重: 使用 document_id 作为 key
                                if doc_id not in citations:
                                    citations[doc_id] = {
                                        "id": str(doc_id),
                                        "title": meta.get("title", "Unknown"),
                                        "siteId": meta.get("site_id"),
                                        "documentId": doc_id,
                                        "score": meta.get("score")
                                    }
            except json.JSONDecodeError:
                logger.warning(f"⚠️ Failed to parse tool output as JSON for citations: {msg.content[:50]}...")
            except Exception as e:
                logger.error(f"❌ Error extracting citations: {e}")

    return list(citations.values())


# =============================================================================
# Agent 图构建
# =============================================================================


def create_agent_graph(checkpointer=None, model: ChatOpenAI = None):
    """创建 ReAct Agent 图
    
    Args:
        checkpointer: 可选的 Checkpointer 实例
        model: 配置好的 LLM 实例 (必须支持 bind_tools)
        
    Returns:
        编译后的 StateGraph
    """
    if model is None:
        raise ValueError("Model must be provided to create_agent_graph")

    # 1. 绑定工具到模型
    model_with_tools = model.bind_tools(tools)

    # 2. 定义节点
    async def agent_node(state: ChatGraphState) -> dict:
        """Agent 决策节点"""
        logger.debug("🤖 [Agent] Thinking...")
        messages = state["messages"]
        
        # 确保 SystemPrompt 存在
        system_prompt = (
            "你是一个智能 AI 助手，同时也能够访问外部知识库。\n"
            "能够进行多步推理和检索。\n"
            "请遵循以下规则：\n"
            "1. 如果用户的问题需要事实信息，请务必使用 search_knowledge_base 工具。\n"
            "2. 如果第一次搜索结果不完整，请尝试从不同角度再次搜索。\n"
            "3. 回答时请依据检索到的信息，保持客观准确。\n"
            "4. 如果检索结果为空，请诚实告知用户。\n"
        )
        
        # 如果历史消息中第一条不是 SystemMessage，则插入
        if not messages or not isinstance(messages[0], SystemMessage):
            messages = [SystemMessage(content=system_prompt)] + list(messages)
        elif isinstance(messages[0], SystemMessage):
             # 确保 System Prompt 内容是最新的（或者是合并的）
             # 这里简单起见，我们假设外部调用者可能会传入 SystemMessage，或者我们在这里强制覆盖/追加
             pass

        # 调用模型
        response = await model_with_tools.ainvoke(messages)
        return {"messages": [response]}

    async def citation_node(state: ChatGraphState) -> dict:
        """后处理节点：提取引用"""
        citations = extract_citations_from_messages(state["messages"])
        logger.info(f"📚 [Graph] Extracted {len(citations)} citations")
        return {"citations": citations}

    # 3. 构建图
    graph_builder = StateGraph(ChatGraphState)

    graph_builder.add_node("agent", agent_node)
    graph_builder.add_node("tools", ToolNode(tools))
    
    # 引用提取节点（可选，可以作为最后一步优化状态）
    # 为了简化流式处理，我们通常不在图中显式加这个节点作为必须步骤，
    # 而是让前端或外层从 messages 中提取。但为了 State 完整性，我们可以加一个结束前的节点。
    # graph_builder.add_node("process_citations", citation_node)

    # 4. 定义边
    graph_builder.add_edge(START, "agent")
    
    # 条件边: Agent -> (Tools | END)
    graph_builder.add_conditional_edges(
        "agent",
        tools_condition,
    )
    
    # 循环边: Tools -> Agent
    graph_builder.add_edge("tools", "agent")

    return graph_builder.compile(checkpointer=checkpointer)


# =============================================================================
# 辅助函数
# =============================================================================

def langchain_to_openai(messages: list[BaseMessage], filter_system: bool = False) -> list[dict]:
    """将 LangChain 格式消息转换为 OpenAI 格式 (用于前端展示)"""
    result = []
    for msg in messages:
        if isinstance(msg, SystemMessage):
            if filter_system:
                continue
            result.append({"role": "system", "content": msg.content})
        elif isinstance(msg, AIMessage):
            # 处理工具调用
            if msg.tool_calls:
                # OpenAI 格式通常不直接展示 tool_calls 给用户看文本，
                # 但如果是最终的消息历史返回，我们可能只关心文本内容。
                # 如果没有文本内容但有 tool_calls，这通常是中间状态。
                if msg.content:
                    result.append({"role": "assistant", "content": msg.content})
            else:
                result.append({"role": "assistant", "content": msg.content})
        elif isinstance(msg, HumanMessage):
            result.append({"role": "user", "content": msg.content})
        # ToolMessage 通常不直接展示给用户，或者作为 'tool' role 展示
        # 前端 UI 可能需要适配显示 "Thinking..." 或 "Used tool: X"
    
    return result
