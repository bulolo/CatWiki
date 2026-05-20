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

"""LangGraph ReAct Agent
1. ReAct 循环: Agent -> Tools -> Agent ... -> End
2. 支持多轮检索和推理
3. 动态引用提取
4. 自动对话摘要 (长期记忆)
"""

import hashlib
import json
import logging
from typing import Annotated, Literal

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
from langgraph.prebuilt import InjectedState, ToolNode

from app.core.ai.message_utils import is_meaningful_message
from app.core.ai.prompts import (
    FORCE_STOP_PROMPT,
    NO_RESULTS_MESSAGE,
    SUMMARIZE_PROMPT,
    SYSTEM_PROMPT,
)
from app.core.common.ai_logging import log_process_step_card
from app.core.infra.config import settings
from app.schemas.document import VectorRetrieveFilter
from app.schemas.graph_state import ChatGraphState
from app.services.rag import RAGRetrievalError, RAGService

logger = logging.getLogger(__name__)

MAX_ITERATIONS = settings.AGENT_MAX_ITERATIONS


# =============================================================================
# 工具定义
# =============================================================================


@tool
async def search_knowledge_base(
    query: str,
    config: RunnableConfig,
    state: Annotated[dict, InjectedState],
) -> str:
    """在知识库中搜索相关信息。

    当用户的问题需要事实依据、文档支持或你不知道答案时，**必须**使用此工具。
    可以多次调用此工具以查找不同方面的信息。

    Args:
        query: 搜索查询词。应该是针对特定信息的清晰问题。

    Returns:
        JSON 格式的字符串，包含搜索结果列表。
        每个结果包含 'content' (内容摘录) 和 'metadata' (包含 title, document_id 等)。
    """
    # 站点 / 租户上下文从 RunnableConfig 取
    site_id = config.get("configurable", {}).get("site_id")
    tenant_id = config.get("configurable", {}).get("tenant_id")

    # 全局 source_index 起点由 graph state 维护（每次 tool 跑完后由 tools_wrapper_node 累加）
    # 而非每次重新扫描历史消息 —— 避免每次工具调用 O(n) JSON 解析。
    offset = int(state.get("source_offset", 0) or 0)

    logger.debug(
        f"🔧 [Tool] search_knowledge_base: query='{query}', site_id={site_id}, offset={offset}"
    )

    try:
        from app.core.infra.tenant import temporary_tenant_context

        # 使用临时租户上下文包裹检索调用，确保 RAGService 能够获取正确的配置和过滤条件
        with temporary_tenant_context(tenant_id):
            retrieved_docs = await RAGService.retrieve(
                query=query,
                k=settings.RAG_RECALL_K,
                filter=VectorRetrieveFilter(
                    site_id=int(site_id) if site_id else None,
                    tenant_id=int(tenant_id) if tenant_id else None,
                ),
                enable_rerank=settings.RAG_ENABLE_RERANK,
                rerank_k=settings.RAG_RERANK_TOP_K,
            )

        if not retrieved_docs:
            return NO_RESULTS_MESSAGE

        # 1. 工具侧“合并”：将属于同一文档的多个片段内容进行拼接
        merged_docs_map = {}
        ordered_ids = []
        for doc in retrieved_docs:
            doc_id = doc.document_id
            if doc_id not in merged_docs_map:
                ordered_ids.append(doc_id)
                merged_docs_map[doc_id] = {
                    "title": doc.document_title,
                    "contents": [doc.content],
                    "score": doc.score,  # 保留第一个片段的分数作为代表
                    "metadata": doc.metadata,
                }
            else:
                merged_docs_map[doc_id]["contents"].append(doc.content)

        # 2. 格式化结果，增加全局索引 source_index
        results = []
        for i, doc_id in enumerate(ordered_ids):
            data = merged_docs_map[doc_id]
            current_idx = offset + i + 1
            # 拼接该文档下的所有片段，使 AI 能获得更完整的信息
            full_content = "\n\n[...]\n\n".join(data["contents"])

            results.append(
                {
                    "source_index": current_idx,
                    "title": data["title"],
                    "content": full_content,
                    "metadata": {
                        "document_id": doc_id,
                        "title": data["title"],
                        "score": data["score"],
                        "site_id": data["metadata"].get("site_id"),
                        **data["metadata"],
                    },
                }
            )

        # 为了让 AI 绝对不会数错，我们在返回的字符串中显式标注
        return json.dumps(results, ensure_ascii=False)

    except RAGRetrievalError as e:
        # 系统级失败（向量库/Embedding/Reranker 不可用）—— 与"召回为空"区分开。
        # 返回明确标记的提示语，agent 应据此停止重试并向用户致歉，而不是换关键词重试。
        logger.warning(f"⚠️ [Tool] RAG retrieval unavailable: {e}")
        return (
            "[系统提示] 知识库检索服务暂时不可用。"
            "请基于已有上下文如实回答用户，并建议稍后重试或联系管理员；"
            "不要换关键词重复尝试本工具。"
        )
    except Exception as e:
        logger.error(f"❌ [Tool] Knowledge base search failed: {e}", exc_info=True)
        return "[系统提示] 检索发生未知异常。请基于已有上下文如实回答用户；不要重复调用本工具。"


# 工具列表
tools = [search_knowledge_base]


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
    async def agent_node(state: ChatGraphState, config: RunnableConfig) -> dict:
        """Agent 决策节点

        observability：本节点不再单独打 chat usage signal。
        ChatProvider.get_model() 在请求初始化时已经记录了一次实例命中；
        每轮的工具/迭代进度由 tools_wrapper_node 的 log_process_step_card 反映；
        端到端 timing 与 RAG Pipeline 汇总卡片由 ChatService 在流结束时输出。
        """
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

        response = await model_with_tools.ainvoke(messages, config)
        return {"messages": [response]}

    async def summarize_conversation(state: ChatGraphState, config: RunnableConfig) -> dict:
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
        response = await model.ainvoke(prompt_messages, config)
        new_summary = str(response.content)
        logger.info(f"📝 [Summarize] New summary: {new_summary[:100]}...")

        # 删除旧消息，保留最近的 N 条交互
        keep_last_n = 6
        if len(conversation_messages) > keep_last_n:
            # 计算需要删除的消息
            messages_to_delete = conversation_messages[:-keep_last_n]
            delete_messages = [RemoveMessage(id=m.id) for m in messages_to_delete if m.id]
            logger.info(f"🗑️ [Summarize] Pruning {len(delete_messages)} old messages")
            return {"summary": new_summary, "messages": delete_messages}

        return {"summary": new_summary}

    # 3. 构建图
    graph_builder = StateGraph(ChatGraphState)

    # LangGraph 提供的标准工具调度节点；wrapper 在外面再包一层状态维护
    tool_node = ToolNode(tools)

    # 连续空结果终止阈值（从配置读取）
    max_consecutive_empty = settings.AGENT_MAX_CONSECUTIVE_EMPTY
    summary_trigger_count = settings.AGENT_SUMMARY_TRIGGER_MSG_COUNT

    async def tools_wrapper_node(state: ChatGraphState, config: RunnableConfig) -> dict:
        """工具节点包装器：执行工具并维护迭代/去重/source_offset 状态。

        核心状态变量：
        - iteration_count：迭代次数 (硬上限 MAX_ITERATIONS)
        - consecutive_empty_count：连续空结果计数 (硬上限 max_consecutive_empty)
        - source_offset：跨工具调用累计的 source_index 起点
        - seen_tool_hashes：已见工具输出的 md5 哈希集合，O(1) 查重
        """
        current_count = state.get("iteration_count", 0)
        consecutive_empty = state.get("consecutive_empty_count", 0)
        current_offset = int(state.get("source_offset", 0) or 0)
        seen_hashes = list(state.get("seen_tool_hashes") or [])

        # 检查是否触及中止阈值
        if current_count >= MAX_ITERATIONS or consecutive_empty >= max_consecutive_empty:
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
        result = await tool_node.ainvoke(state, config)
        result["iteration_count"] = current_count + 1

        # 解析最后一条 ToolMessage 一次，用于：(a) 判定空结果 (b) 计数新增文档 (c) 哈希查重
        is_empty_result = False
        duplicate_tool_result = False
        docs_added = 0

        last_tool_msg = (result.get("messages") or [None])[-1]
        content = getattr(last_tool_msg, "content", "") if last_tool_msg else ""

        if content == NO_RESULTS_MESSAGE:
            is_empty_result = True
        elif content:
            # 只解析最新一条 (O(content_size))，不再扫历史 (避免 O(n × content))
            try:
                parsed = json.loads(content)
                if isinstance(parsed, list):
                    docs_added = len(parsed)
                    if docs_added == 0:
                        is_empty_result = True
            except (json.JSONDecodeError, TypeError):
                # 非 JSON 内容（如错误字符串）—— 视作非真实结果，不计入 offset
                pass

        # O(1) 重复检测：用稳定哈希 (md5) 代替整串相等比较
        if content:
            content_hash = hashlib.md5(content.encode("utf-8")).hexdigest()
            if content_hash in seen_hashes:
                duplicate_tool_result = True
            else:
                seen_hashes.append(content_hash)

        if duplicate_tool_result:
            logger.warning("⚠️ [Graph] Duplicate tool output detected, forcing convergence.")
            # 直接拉满连续空计数，下一次若仍尝试工具调用将触发强制停止
            result["consecutive_empty_count"] = max_consecutive_empty
        else:
            result["consecutive_empty_count"] = consecutive_empty + 1 if is_empty_result else 0

        # 把 source_offset / seen_tool_hashes 写回 state，供下一轮使用
        result["source_offset"] = current_offset + docs_added
        result["seen_tool_hashes"] = seen_hashes

        log_process_step_card(
            "graph",
            "Reasoning Loop",
            result["iteration_count"],
            MAX_ITERATIONS,
            details=f"Consecutive empty: {result['consecutive_empty_count']}/{max_consecutive_empty}"
            if result["consecutive_empty_count"] > 0
            else "Active discovery",
        )
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
        if len(non_system_msgs) > summary_trigger_count:
            logger.info(
                f"📊 [Graph] Message count {len(non_system_msgs)} > {summary_trigger_count}, triggering summarization"
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
