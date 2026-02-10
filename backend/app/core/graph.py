"""LangGraph ReAct Agent
1. ReAct 循环: Agent -> Tools -> Agent ... -> End
2. 支持多轮检索和推理
3. 动态引用提取
4. 自动对话摘要 (长期记忆)
"""

import json
import logging
from typing import Literal

from langchain_core.messages import (
    HumanMessage,
    RemoveMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.prebuilt import ToolNode

from app.core.prompts import FORCE_STOP_PROMPT, NO_RESULTS_MESSAGE, SUMMARIZE_PROMPT, SYSTEM_PROMPT
from app.core.rag_utils import is_meaningful_message
from app.schemas.document import VectorRetrieveFilter
from app.schemas.graph_state import ChatGraphState
from app.services.vector_service import VectorService

logger = logging.getLogger(__name__)

# 最大迭代次数限制，防止 Agent 无限循环（从配置读取）
from app.core.config import settings

MAX_ITERATIONS = settings.AGENT_MAX_ITERATIONS


# =============================================================================
# 工具定义
# =============================================================================


@tool
async def search_knowledge_base(query: str, config: RunnableConfig) -> str:
    """在知识库中搜索相关信息。

    当用户的问题需要事实依据、文档支持或你不知道答案时，**必须**使用此工具。
    可以多次调用此工具以查找不同方面的信息。

    Args:
        query: 搜索查询词。应该是针对特定信息的清晰问题。

    Returns:
        JSON 格式的字符串，包含搜索结果列表。
        每个结果包含 'content' (内容摘录) 和 'metadata' (包含 title, document_id 等)。
    """
    # 获取站点上下文和消息历史以计算偏移量
    site_id = config.get("configurable", {}).get("site_id")
    messages = config.get("configurable", {}).get("messages", [])

    offset = 0
    if messages:
        for msg in messages:
            if isinstance(msg, ToolMessage) and msg.name == "search_knowledge_base":
                try:
                    prev_results = json.loads(msg.content)
                    if isinstance(prev_results, list):
                        offset += len(prev_results)
                except:
                    continue

    logger.info(
        f"🔧 [Tool] search_knowledge_base: query='{query}', site_id={site_id}, offset={offset}"
    )

    try:
        search_filter = VectorRetrieveFilter(site_id=int(site_id)) if site_id else None

        # 执行检索
        retrieved_docs = await VectorService.retrieve(
            query=query,
            filter=search_filter,
        )

        if not retrieved_docs:
            return NO_RESULTS_MESSAGE

        # 格式化结果，增加全局索引 source_index
        results = []
        for i, doc in enumerate(retrieved_docs):
            current_idx = offset + i + 1
            results.append(
                {
                    "source_index": current_idx,
                    "title": doc.document_title,
                    "content": doc.content,
                    "metadata": {
                        "document_id": doc.document_id,
                        "title": doc.document_title,
                        "score": doc.score,
                        "source_index": current_idx,  # 冗余存一份在 metadata
                        **doc.metadata,
                    },
                }
            )

        # 为了让 AI 绝对不会数错，我们在返回的字符串中显式标注
        return json.dumps(results, ensure_ascii=False)

    except Exception as e:
        logger.error(f"❌ [Tool] Knowledge base search failed: {e}", exc_info=True)
        return f"搜索知识库时出错: {str(e)}"


# 工具列表
tools = [search_knowledge_base]


# =============================================================================
# 辅助函数：引用提取
# =============================================================================


# extract_citations_from_messages moved to app.core.rag_utils


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
        messages = list(state["messages"])

        # 注入/更新 System Prompt (包含摘要)
        system_content = SYSTEM_PROMPT
        if state.get("summary"):
            system_content += f"\n\n#### 之前的对话摘要 ####\n{state['summary']}"

        # 确保第一条消息始终是包含最新摘要的 SystemMessage
        if not messages or not isinstance(messages[0], SystemMessage):
            messages.insert(0, SystemMessage(content=system_content))
        else:
            messages[0] = SystemMessage(content=system_content)

        response = await model_with_tools.ainvoke(messages)
        return {"messages": [response]}

    async def summarize_conversation(state: ChatGraphState) -> dict:
        """对话摘要节点"""
        logger.info("📝 [Summarize] Summarizing conversation history...")
        messages = state["messages"]
        summary = state.get("summary", "")

        # 构造摘要 prompt
        summarize_message = SUMMARIZE_PROMPT
        if summary:
            summarize_message += f"\n\n(现有摘要: {summary})"

        # 只取除了 SystemMessage/RemoveMessage 之外的消息进行摘要
        conversation_messages = [msg for msg in messages if is_meaningful_message(msg)]

        if not conversation_messages:
            return {}

        # 添加摘要指令 (HumanMessage)
        prompt_messages = conversation_messages + [HumanMessage(content=summarize_message)]

        # 调用模型生成摘要
        response = await model.ainvoke(prompt_messages)
        new_summary = str(response.content)
        logger.info(f"📝 [Summarize] New summary: {new_summary[:100]}...")

        # 删除旧消息，保留最近的 N 条交互
        KEEP_LAST_N = 6
        if len(conversation_messages) > KEEP_LAST_N:
            # 计算需要删除的消息
            messages_to_delete = conversation_messages[:-KEEP_LAST_N]
            delete_messages = [RemoveMessage(id=m.id) for m in messages_to_delete if m.id]
            logger.info(f"🗑️ [Summarize] Pruning {len(delete_messages)} old messages")
            return {"summary": new_summary, "messages": delete_messages}

        return {"summary": new_summary}

    # 3. 构建图
    graph_builder = StateGraph(ChatGraphState)

    # 工具节点包装器：递增迭代计数 + 检测空结果
    tool_node = ToolNode(tools)

    # 连续空结果终止阈值（从配置读取）
    MAX_CONSECUTIVE_EMPTY = settings.AGENT_MAX_CONSECUTIVE_EMPTY
    SUMMARY_TRIGGER_COUNT = settings.AGENT_SUMMARY_TRIGGER_MSG_COUNT

    async def tools_wrapper_node(state: ChatGraphState) -> dict:
        """工具节点包装器，执行工具并追踪迭代计数和空结果"""
        current_count = state.get("iteration_count", 0)
        consecutive_empty = state.get("consecutive_empty_count", 0)

        # 检查是否触及中止阈值
        if current_count >= MAX_ITERATIONS or consecutive_empty >= MAX_CONSECUTIVE_EMPTY:
            logger.warning(
                f"⚠️ [Graph] Force stopping tools. Iterations: {current_count}, Empty: {consecutive_empty}"
            )
            # 生成中止提示给 Agent，要求其停止搜索并直接回答
            last_msg = state["messages"][-1]
            tool_messages = []
            if hasattr(last_msg, "tool_calls"):
                for tool_call in last_msg.tool_calls:
                    tool_messages.append(
                        ToolMessage(
                            tool_call_id=tool_call["id"],
                            content=FORCE_STOP_PROMPT,
                        )
                    )

            return {
                "messages": tool_messages,
                "iteration_count": current_count + 1,
                "consecutive_empty_count": consecutive_empty,
            }

        # 正常执行工具
        result = await tool_node.ainvoke(state)

        # 递增迭代计数
        result["iteration_count"] = current_count + 1

        # 检测工具返回是否为空结果
        is_empty_result = False
        if result.get("messages"):
            last_tool_msg = result["messages"][-1]
            if last_tool_msg:
                content = getattr(last_tool_msg, "content", "")
                if content == NO_RESULTS_MESSAGE or "未找到相关文档" in content or content == "[]":
                    is_empty_result = True

        if is_empty_result:
            result["consecutive_empty_count"] = consecutive_empty + 1
            logger.debug(
                f"🔄 [Graph] Empty result, consecutive count: {result['consecutive_empty_count']}/{MAX_CONSECUTIVE_EMPTY}"
            )
        else:
            result["consecutive_empty_count"] = 0

        logger.debug(f"🔄 [Graph] Iteration count: {result['iteration_count']}/{MAX_ITERATIONS}")
        return result

    # 条件路由函数：检查迭代次数限制 + 连续空结果
    def route_after_agent(state: ChatGraphState) -> Literal["tools", "should_summarize"]:
        """Agent 后的路由决策"""
        messages = state["messages"]
        last_message = messages[-1] if messages else None

        # 检查是否需要调用工具
        if last_message and hasattr(last_message, "tool_calls") and last_message.tool_calls:
            # 即使已经超出限制，也最后一次路由到 tools 节点，由 tools_wrapper_node 注入“停止”指令
            # 这样可以确保 Agent 收到一个 ToolMessage 响应，从而能够生成最终的文本回复。
            return "tools"

        # 如果没有工具调用，说明 Agent 已经生成了文本回复，走向摘要/结束
        return "should_summarize"

    async def check_summary_node(state: ChatGraphState) -> dict:
        """检查摘要节点的占位符（Pass-through node）"""
        # 该节点不修改状态，仅作为条件路由的中转
        return {}

    def should_summarize(state: ChatGraphState) -> Literal["summarize_conversation", "__end__"]:
        """判断是否需要摘要"""
        messages = state["messages"]

        # 简单策略：非 System 消息总数超过阈值则触发摘要
        non_system_msgs = [m for m in messages if not isinstance(m, SystemMessage)]

        # 实际生产中可以计算 Token 数
        if len(non_system_msgs) > SUMMARY_TRIGGER_COUNT:
            logger.info(
                f"📊 [Graph] Message count {len(non_system_msgs)} > {SUMMARY_TRIGGER_COUNT}, triggering summarization"
            )
            return "summarize_conversation"

        return "__end__"

    graph_builder.add_node("agent", agent_node)
    graph_builder.add_node("tools", tools_wrapper_node)
    graph_builder.add_node("summarize_conversation", summarize_conversation)
    graph_builder.add_node("check_summary_node", check_summary_node)

    # 4. 定义边
    graph_builder.add_edge(START, "agent")

    # 条件边: Agent -> (Tools | Check Summary)
    graph_builder.add_conditional_edges(
        "agent", route_after_agent, {"tools": "tools", "should_summarize": "check_summary_node"}
    )

    # 循环边: Tools -> Agent
    graph_builder.add_edge("tools", "agent")

    # 条件边: Check Summary -> (Summarize | End)
    graph_builder.add_conditional_edges(
        "check_summary_node",
        should_summarize,
        {"summarize_conversation": "summarize_conversation", "__end__": END},
    )

    # 摘要结束后 -> End
    graph_builder.add_edge("summarize_conversation", END)

    return graph_builder.compile(checkpointer=checkpointer)
