import json
import logging
from typing import Any

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    RemoveMessage,
    SystemMessage,
    ToolMessage,
)

logger = logging.getLogger(__name__)


def extract_sources_from_messages(
    messages: list[BaseMessage], from_last_turn: bool = False
) -> list[dict]:
    """从历史消息的 ToolMessage 中提取引用

    注意：为了确保与 UI 的自动编号 [1, 2, 3...] 匹配，我们严格按顺序收集。
    由于工具侧已进行“合并”处理，此处按 document_id 过滤仅为多工具调用时的稳健性。
    """
    sources = {}
    target_messages = messages

    if from_last_turn:
        # 找到最后一条 HumanMessage 的索引
        last_human_idx = -1
        for i in range(len(messages) - 1, -1, -1):
            if isinstance(messages[i], HumanMessage):
                last_human_idx = i
                break

        if last_human_idx != -1:
            target_messages = messages[last_human_idx:]

    # 1. 收集所有引用来源
    for msg in target_messages:
        if isinstance(msg, ToolMessage) and msg.name == "search_knowledge_base":
            try:
                content = msg.content if isinstance(msg.content, str) else json.dumps(msg.content)
                results = json.loads(content)

                if isinstance(results, list):
                    for doc in results:
                        meta = doc.get("metadata", {})
                        doc_id = meta.get("document_id")
                        source_idx = doc.get("source_index") or meta.get("source_index")

                        # 仅保留每个文档的首个引用点，以对齐 AI 开始引用该文档时的序号
                        if doc_id and doc_id not in sources:
                            sources[doc_id] = {
                                "id": str(doc_id),
                                "title": meta.get("title", "Unknown"),
                                "siteId": meta.get("site_id"),
                                "documentId": doc_id,
                                "score": meta.get("score"),
                                "sourceIndex": int(source_idx) if source_idx is not None else None,
                            }
            except (json.JSONDecodeError, AttributeError):
                continue
            except Exception as e:
                logger.error(f"❌ Error extracting sources: {e}")

    # 按 sourceIndex 排序以确保前端列表序号递增
    sorted_sources = sorted(
        sources.values(),
        key=lambda x: x.get("sourceIndex") if x.get("sourceIndex") is not None else 999,
    )
    return sorted_sources


def convert_tool_call_chunk_to_openai(tc_chunk: dict[str, Any]) -> dict[str, Any]:
    """将 LangChain 的 tool_call_chunk 转换为 OpenAI 兼容格式"""
    tc = {
        "index": tc_chunk.get("index", 0),
        "id": tc_chunk.get("id"),
        "type": "function" if tc_chunk.get("id") else None,
        "function": {
            "name": tc_chunk.get("name"),
            "arguments": tc_chunk.get("args", ""),
        },
    }
    # 清理 None 值
    cleaned_tc = {k: v for k, v in tc.items() if v is not None}
    if "function" in cleaned_tc:
        cleaned_tc["function"] = {k: v for k, v in cleaned_tc["function"].items() if v is not None}
    return cleaned_tc


def is_meaningful_message(msg: BaseMessage) -> bool:
    """判断消息是否具有实际语义内容（过滤掉 System、Remove 等）"""
    if isinstance(msg, SystemMessage | RemoveMessage):
        return False
    if isinstance(msg, AIMessage) and not msg.content and not msg.tool_calls:
        return False
    return True
