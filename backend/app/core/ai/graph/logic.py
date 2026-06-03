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
from typing import Annotated, Any, Literal

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
    site_id = config.get("configurable", {}).get("site_id")
    tenant_id = config.get("configurable", {}).get("tenant_id")

    # source_offset 由 graph state 维护，避免每次工具调用 O(n) 扫描历史消息
    offset = int(state.get("source_offset", 0) or 0)

    logger.debug(
        f"🔧 [Tool] search_knowledge_base: query='{query}', site_id={site_id}, offset={offset}"
    )

    try:
        from app.core.infra.tenant import temporary_tenant_context

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

        # 将同一文档的多个片段合并，避免 LLM 接收割裂上下文
        merged_docs_map: dict = {}
        ordered_ids: list = []
        for doc in retrieved_docs:
            doc_id = doc.document_id
            if doc_id not in merged_docs_map:
                ordered_ids.append(doc_id)
                merged_docs_map[doc_id] = {
                    "title": doc.document_title,
                    "contents": [doc.content],
                    "score": doc.score,
                    "metadata": doc.metadata,
                }
            else:
                merged_docs_map[doc_id]["contents"].append(doc.content)

        results = []
        for i, doc_id in enumerate(ordered_ids):
            data = merged_docs_map[doc_id]
            results.append(
                {
                    "source_index": offset + i + 1,
                    "title": data["title"],
                    "content": "\n\n[...]\n\n".join(data["contents"]),
                    "metadata": {
                        "document_id": doc_id,
                        "title": data["title"],
                        "score": data["score"],
                        "site_id": data["metadata"].get("site_id"),
                        **data["metadata"],
                    },
                }
            )

        return json.dumps(results, ensure_ascii=False)

    except RAGRetrievalError as e:
        # 系统级失败（向量库/Embedding/Reranker 不可用）——与"召回为空"区分，
        # 返回专用提示语，agent 应停止重试并向用户致歉
        logger.warning(f"⚠️ [Tool] RAG retrieval unavailable: {e}")
        return (
            "[系统提示] 知识库检索服务暂时不可用。"
            "请基于已有上下文如实回答用户，并建议稍后重试或联系管理员；"
            "不要换关键词重复尝试本工具。"
        )
    except Exception as e:
        logger.error(f"❌ [Tool] Knowledge base search failed: {e}", exc_info=True)
        return "[系统提示] 检索发生未知异常。请基于已有上下文如实回答用户；不要重复调用本工具。"


tools = [search_knowledge_base]


# =============================================================================
# 节点函数（模块级，显式依赖，可独立单元测试）
# =============================================================================


async def _agent_node(
    state: ChatGraphState,
    config: RunnableConfig,
    *,
    model_with_tools: Any,
) -> dict:
    """Agent 决策节点：注入 System Prompt（含摘要）后调用 LLM。

    observability：timing 与 RAG Pipeline 汇总卡片由 ChatService 在流结束时输出，
    本节点不单独打 usage signal。
    """
    logger.debug("🤖 [Agent] Thinking...")

    messages = list(state["messages"])

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


async def _summarize_node(
    state: ChatGraphState,
    config: RunnableConfig,
    *,
    model: Any,
    keep_last_n: int,
) -> dict:
    """对话摘要节点：生成摘要并剪枝超出保留窗口的旧消息。"""
    logger.info("📝 [Summarize] Summarizing conversation history...")
    messages = state["messages"]
    summary = state.get("summary", "")

    summarize_message = SUMMARIZE_PROMPT
    if summary:
        summarize_message += f"\n\n(现有摘要: {summary})"

    conversation_messages = [msg for msg in messages if is_meaningful_message(msg)]
    if not conversation_messages:
        return {}

    response = await model.ainvoke(
        conversation_messages + [HumanMessage(content=summarize_message)],
        config,
    )
    new_summary = str(response.content)
    logger.info(f"📝 [Summarize] New summary: {new_summary[:100]}...")

    if len(conversation_messages) > keep_last_n:
        to_delete = conversation_messages[:-keep_last_n]
        delete_messages = [RemoveMessage(id=m.id) for m in to_delete if m.id]
        logger.info(f"🗑️ [Summarize] Pruning {len(delete_messages)} old messages")
        return {"summary": new_summary, "messages": delete_messages}

    return {"summary": new_summary}


async def _tools_wrapper_node(
    state: ChatGraphState,
    config: RunnableConfig,
    *,
    tool_node: ToolNode,
    max_iterations: int,
    max_consecutive_empty: int,
) -> dict:
    """工具节点包装器：执行工具并维护迭代/去重/source_offset 状态。

    核心状态变量：
    - iteration_count：迭代次数（硬上限 max_iterations）
    - consecutive_empty_count：连续空结果计数（硬上限 max_consecutive_empty）
    - source_offset：跨工具调用累计的 source_index 起点
    - seen_tool_hashes：已见工具输出的 md5 哈希集合，O(1) 查重
    """
    current_count = state.get("iteration_count", 0)
    consecutive_empty = state.get("consecutive_empty_count", 0)
    current_offset = int(state.get("source_offset", 0) or 0)
    seen_hashes = list(state.get("seen_tool_hashes") or [])

    if current_count >= max_iterations or consecutive_empty >= max_consecutive_empty:
        logger.warning(
            f"⚠️ [Graph] Force stopping tools. Iterations: {current_count}, Empty: {consecutive_empty}"
        )
        last_msg = state["messages"][-1]
        tool_messages = []
        if hasattr(last_msg, "tool_calls"):
            for tool_call in last_msg.tool_calls:
                tool_messages.append(
                    ToolMessage(tool_call_id=tool_call["id"], content=FORCE_STOP_PROMPT)
                )
        return {
            "messages": tool_messages,
            "iteration_count": current_count + 1,
            "consecutive_empty_count": consecutive_empty,
        }

    result = await tool_node.ainvoke(state, config)
    result["iteration_count"] = current_count + 1

    # 解析最后一条 ToolMessage：判定空结果 / 计数新增文档 / 哈希查重
    is_empty_result = False
    duplicate_tool_result = False
    docs_added = 0

    last_tool_msg = (result.get("messages") or [None])[-1]
    content = getattr(last_tool_msg, "content", "") if last_tool_msg else ""

    if content == NO_RESULTS_MESSAGE:
        is_empty_result = True
    elif content:
        try:
            parsed = json.loads(content)
            if isinstance(parsed, list):
                docs_added = len(parsed)
                if docs_added == 0:
                    is_empty_result = True
        except (json.JSONDecodeError, TypeError):
            pass

    if content:
        content_hash = hashlib.md5(content.encode("utf-8")).hexdigest()
        if content_hash in seen_hashes:
            duplicate_tool_result = True
        else:
            seen_hashes.append(content_hash)

    if duplicate_tool_result:
        logger.warning("⚠️ [Graph] Duplicate tool output detected, forcing convergence.")
        result["consecutive_empty_count"] = max_consecutive_empty
    else:
        result["consecutive_empty_count"] = consecutive_empty + 1 if is_empty_result else 0

    result["source_offset"] = current_offset + docs_added
    result["seen_tool_hashes"] = seen_hashes

    log_process_step_card(
        "graph",
        "Reasoning Loop",
        result["iteration_count"],
        max_iterations,
        details=(
            f"Consecutive empty: {result['consecutive_empty_count']}/{max_consecutive_empty}"
            if result["consecutive_empty_count"] > 0
            else "Active discovery"
        ),
    )
    return result


def _route_after_agent(
    state: ChatGraphState,
    *,
    summary_trigger_count: int,
) -> Literal["tools", "summarize_conversation", "__end__"]:
    """Agent 后的路由决策：工具调用 → tools；超阈值 → 摘要；否则 → 结束。

    即使已超出迭代上限，有 tool_calls 时仍路由到 tools，
    让 _tools_wrapper_node 注入停止指令，确保 Agent 收到 ToolMessage 后能生成最终回复。
    """
    messages = state["messages"]
    last_message = messages[-1] if messages else None

    if last_message and hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools"

    non_system = [m for m in messages if not isinstance(m, SystemMessage)]
    if len(non_system) > summary_trigger_count:
        logger.info(
            f"📊 [Graph] Message count {len(non_system)} > {summary_trigger_count}, triggering summarization"
        )
        return "summarize_conversation"

    return "__end__"


# =============================================================================
# 图工厂（薄汇编层：绑定依赖 → 注册节点 → compile）
# =============================================================================


def create_agent_graph(checkpointer=None, model: ChatOpenAI = None):
    """创建 ReAct Agent 图。

    Args:
        checkpointer: 可选的 LangGraph Checkpointer 实例
        model: 配置好的 LLM 实例（必须支持 bind_tools）

    Returns:
        编译后的 StateGraph
    """
    if model is None:
        raise ValueError("Model must be provided to create_agent_graph")

    # 依赖实例化
    model_with_tools = model.bind_tools(tools)
    tool_node = ToolNode(tools)
    max_consecutive_empty = settings.AGENT_MAX_CONSECUTIVE_EMPTY
    summary_trigger_count = settings.AGENT_SUMMARY_TRIGGER_MSG_COUNT
    keep_last_n = settings.AGENT_SUMMARY_KEEP_LAST_N

    # 薄闭包：无业务逻辑，只做参数绑定
    async def agent_node(state: ChatGraphState, config: RunnableConfig) -> dict:
        return await _agent_node(state, config, model_with_tools=model_with_tools)

    async def summarize_conversation(state: ChatGraphState, config: RunnableConfig) -> dict:
        return await _summarize_node(state, config, model=model, keep_last_n=keep_last_n)

    async def tools_wrapper_node(state: ChatGraphState, config: RunnableConfig) -> dict:
        return await _tools_wrapper_node(
            state,
            config,
            tool_node=tool_node,
            max_iterations=MAX_ITERATIONS,
            max_consecutive_empty=max_consecutive_empty,
        )

    def route_after_agent(
        state: ChatGraphState,
    ) -> Literal["tools", "summarize_conversation", "__end__"]:
        return _route_after_agent(state, summary_trigger_count=summary_trigger_count)

    # 图装配
    graph_builder = StateGraph(ChatGraphState)
    graph_builder.add_node("agent", agent_node)
    graph_builder.add_node("tools", tools_wrapper_node)
    graph_builder.add_node("summarize_conversation", summarize_conversation)

    graph_builder.add_edge(START, "agent")
    graph_builder.add_conditional_edges(
        "agent",
        route_after_agent,
        {"tools": "tools", "summarize_conversation": "summarize_conversation", "__end__": END},
    )
    graph_builder.add_edge("tools", "agent")
    graph_builder.add_edge("summarize_conversation", END)

    return graph_builder.compile(checkpointer=checkpointer)
