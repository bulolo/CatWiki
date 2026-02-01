"""LangGraph 工具调用 Agent (方案 C)

使用 LangGraph create_agent 构建的 RAG Agent：
- 将知识库检索封装为工具
- LLM 自主决定何时调用工具
- 支持多轮工具调用直到完成
"""

import logging
from typing import Literal

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage, BaseMessage
from langchain_core.tools import tool
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
    
    当用户提问需要查找文档、资料或知识库中的信息时使用此工具。
    
    Args:
        query: 搜索查询词，应该是清晰的问题或关键词
        
    Returns:
        搜索到的相关文档内容，包含标题和内容摘要
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
            return "未找到相关文档。请尝试使用不同的关键词或直接回答用户的问题。"
        
        # 按 document_id 聚合
        doc_map = {}
        for doc in retrieved_docs:
            doc_id = doc.document_id
            if not doc_id:
                continue
            
            if doc_id not in doc_map:
                doc_map[doc_id] = {
                    "title": doc.document_title,
                    "content": [],
                    "score": doc.score,
                }
            doc_map[doc_id]["content"].append(doc.content)
        
        # 转换为唯一文档列表
        relevant_docs = []
        seen_ids = set()
        for doc in retrieved_docs:
            doc_id = doc.document_id
            if not doc_id or doc_id in seen_ids:
                continue
            
            seen_ids.add(doc_id)
            info = doc_map[doc_id]
            full_content = "\n...\n".join(info["content"])
            relevant_docs.append({
                "title": info["title"],
                "content": full_content,
                "score": info["score"],
            })
        
        # 构建返回结果
        result_parts = []
        for i, doc in enumerate(relevant_docs):
            result_parts.append(
                f"[文档 {i+1}] {doc['title']}\n"
                f"{doc['content']}\n"
            )
        
        result = "\n---\n".join(result_parts)
        logger.info(f"📚 [Tool] Found {len(relevant_docs)} relevant documents")
        return result
        
    except Exception as e:
        logger.error(f"❌ [Tool] Knowledge base search failed: {e}", exc_info=True)
        return f"搜索知识库时出错: {str(e)}"


# 工具列表
tools = [search_knowledge_base]


# =============================================================================
# Agent 节点
# =============================================================================

async def agent_node(state: ChatGraphState) -> dict:
    """Agent 入口节点
    
    此节点作为图的入口，仅记录日志和透传消息。
    实际的消息处理在 respond_node 中进行。
    """
    logger.info("🤖 [Agent] Entering agent_node")
    
    # 入口节点只透传，不做处理
    return {}


async def retrieve_for_agent(state: ChatGraphState) -> dict:
    """为 Agent 执行检索
    
    从最后一条用户消息中提取查询并执行检索。
    返回上下文和引用来源。
    """
    logger.info("🔍 [Agent] Executing retrieval for agent")
    
    # 提取最后一条用户消息
    query = ""
    for msg in reversed(state["messages"]):
        if isinstance(msg, HumanMessage):
            query = msg.content
            break
    
    if not query:
        return {"context": "", "citations": []}
    
    try:
        # 直接调用 VectorService（不通过工具）以获取完整的文档信息
        retrieved_docs = await VectorService.retrieve(
            query=query,
            k=5,
            threshold=0.3,
        )
        
        if not retrieved_docs:
            logger.info("🤷 [Agent] No relevant context found")
            return {"context": "", "citations": []}
        
        # 按 document_id 聚合
        doc_map = {}
        for doc in retrieved_docs:
            doc_id = doc.document_id
            if not doc_id:
                continue
            
            if doc_id not in doc_map:
                doc_map[doc_id] = {
                    "title": doc.document_title,
                    "content": [],
                    "metadata": doc.metadata,
                    "score": doc.score,
                    "document_id": doc_id
                }
            doc_map[doc_id]["content"].append(doc.content)
        
        # 转换为唯一文档列表（保持相关性排序）
        relevant_docs = []
        seen_ids = set()
        for doc in retrieved_docs:
            doc_id = doc.document_id
            if not doc_id or doc_id in seen_ids:
                continue
            
            seen_ids.add(doc_id)
            info = doc_map[doc_id]
            full_content = "\n...\n".join(info["content"])
            
            relevant_docs.append({
                "title": info["title"],
                "content": full_content,
                "metadata": info["metadata"],
                "score": info["score"],
                "document_id": doc_id
            })
        
        logger.info(f"📚 [Agent] Found {len(retrieved_docs)} chunks -> collapsed to {len(relevant_docs)} unique docs")
        
        # 构建上下文字符串
        context_parts = []
        for i, doc in enumerate(relevant_docs):
            context_parts.append(
                f"Document [{i+1}] (Title: {doc['title']})\n"
                f"{doc['content']}\n"
            )
        context_str = "\n".join(context_parts)
        
        # 构建 Citations
        citations = []
        for i, doc in enumerate(relevant_docs):
            citations.append({
                "id": str(doc["document_id"]),
                "title": doc["title"],
                "siteId": doc["metadata"].get("site_id"),
                "documentId": doc["document_id"],
                "score": doc["score"]
            })
        
        logger.info(f"📎 [Agent] Prepared {len(citations)} citations")
        
        return {
            "context": context_str,
            "citations": citations
        }
        
    except Exception as e:
        logger.error(f"❌ [Agent] Retrieval failed: {e}", exc_info=True)
        return {"context": "", "citations": []}


def should_use_tools(state: ChatGraphState) -> Literal["retrieve", "respond"]:
    """判断是否需要使用工具（简化版路由）
    
    在完整的 Agent 实现中，这个判断会由 LLM 通过 tool_calls 决定。
    这里使用简化的规则判断。
    """
    # 提取最后一条用户消息
    query = ""
    for msg in reversed(state["messages"]):
        if isinstance(msg, HumanMessage):
            query = msg.content
            break
    
    if not query:
        return "respond"
    
    # 简单的规则判断
    greetings = ["你好", "hi", "hello", "hey", "嗨", "早上好", "晚上好", "在吗"]
    query_lower = query.lower().strip()
    
    if len(query) < 20 and any(g in query_lower for g in greetings):
        logger.info("👋 [Agent] Detected greeting, skipping tools")
        return "respond"
    
    logger.info("🔧 [Agent] Will use knowledge base tool")
    return "retrieve"


async def respond_node(state: ChatGraphState) -> dict:
    """响应节点：准备最终响应的消息
    
    此节点在工具调用完成后（或跳过工具时）执行，
    整理消息列表供后续 LLM 调用使用。
    """
    logger.info("💬 [Agent] Entering respond_node")
    
    messages = list(state["messages"])
    context = state.get("context", "")
    
    if context:
        # 注入检索到的上下文
        system_prompt = (
            "你是一个知识库的智能 AI 助手。\n"
            "请使用以下检索到的上下文片段来回答用户的问题。\n"
            "如果无法从上下文中找到答案，请告知用户你根据知识库无法回答，但你可以尝试提供帮助。\n"
            "如果相关，请始终引用文档标题。\n\n"
            "上下文信息:\n"
            f"{context}\n"
        )
        
        if messages and isinstance(messages[0], SystemMessage):
            messages[0] = SystemMessage(content=messages[0].content + f"\n\n{system_prompt}")
        else:
            messages.insert(0, SystemMessage(content=system_prompt))
        
        logger.debug(f"📝 [Agent] Context injected into system prompt ({len(context)} chars)")
    else:
        # 无上下文时使用默认 System Prompt
        default_prompt = "你是一个友好的 AI 助手，可以帮助用户回答各种问题。"
        if not messages or not isinstance(messages[0], SystemMessage):
            messages.insert(0, SystemMessage(content=default_prompt))
            logger.debug("📝 [Agent] Default system prompt added (no context)")
    
    return {"messages": messages}


# =============================================================================
# 构建 Agent 图
# =============================================================================

def create_agent_graph(checkpointer=None):
    """创建工具调用 Agent 图
    
    流程:
        START -> agent
        agent --[需要工具]--> retrieve -> respond -> END
        agent --[不需要工具]--> respond -> END
    
    Args:
        checkpointer: 可选的 Checkpointer 实例，用于持久化状态
    
    Returns:
        编译后的 StateGraph
    """
    graph_builder = StateGraph(ChatGraphState)
    
    # 添加节点
    graph_builder.add_node("agent", agent_node)
    graph_builder.add_node("retrieve", retrieve_for_agent)
    graph_builder.add_node("respond", respond_node)
    
    # 添加边
    graph_builder.add_edge(START, "agent")
    
    # 条件边：决定是否使用工具
    graph_builder.add_conditional_edges(
        "agent",
        should_use_tools,
        {
            "retrieve": "retrieve",
            "respond": "respond"
        }
    )
    
    graph_builder.add_edge("retrieve", "respond")
    graph_builder.add_edge("respond", END)
    
    return graph_builder.compile(checkpointer=checkpointer)


# 全局单例图实例
rag_graph = create_agent_graph()


# =============================================================================
# 辅助函数
# =============================================================================

def messages_to_langchain(messages: list[dict]) -> list[BaseMessage]:
    """将 OpenAI 格式消息转换为 LangChain 格式"""
    result = []
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        
        if role == "system":
            result.append(SystemMessage(content=content))
        elif role == "assistant":
            result.append(AIMessage(content=content))
        else:
            result.append(HumanMessage(content=content))
    
    return result


def langchain_to_openai(messages: list[BaseMessage]) -> list[dict]:
    """将 LangChain 格式消息转换为 OpenAI 格式"""
    result = []
    for msg in messages:
        if isinstance(msg, SystemMessage):
            result.append({"role": "system", "content": msg.content})
        elif isinstance(msg, AIMessage):
            result.append({"role": "assistant", "content": msg.content})
        elif isinstance(msg, HumanMessage):
            result.append({"role": "user", "content": msg.content})
    
    return result


def get_tools():
    """获取可用工具列表（供外部使用）"""
    return tools
