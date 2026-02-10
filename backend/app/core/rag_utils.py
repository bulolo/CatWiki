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

def extract_citations_from_messages(
    messages: list[BaseMessage], from_last_turn: bool = False
) -> list[dict]:
    """从历史消息的 ToolMessage 中提取引用

    Args:
        messages: 消息列表
        from_last_turn: 是否仅提取最后一轮对话的引用 (从最后一条 HumanMessage 开始)
    """
    citations = {}
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

    for msg in target_messages:
        if isinstance(msg, ToolMessage) and msg.name == "search_knowledge_base":
            try:
                content = msg.content if isinstance(msg.content, str) else json.dumps(msg.content)
                results = json.loads(content)

                if isinstance(results, list):
                    for doc in results:
                        meta = doc.get("metadata", {})
                        doc_id = meta.get("document_id")
                        if doc_id and doc_id not in citations:
                            citations[doc_id] = {
                                "id": str(doc_id),
                                "title": meta.get("title", "Unknown"),
                                "siteId": meta.get("site_id"),
                                "documentId": doc_id,
                                "score": meta.get("score"),
                            }
            except (json.JSONDecodeError, AttributeError):
                continue
            except Exception as e:
                logger.error(f"❌ Error extracting citations: {e}")

    return list(citations.values())

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
        cleaned_tc["function"] = {
            k: v for k, v in cleaned_tc["function"].items() if v is not None
        }
    return cleaned_tc

def is_meaningful_message(msg: BaseMessage) -> bool:
    """判断消息是否具有实际语义内容（过滤掉 System、Remove 等）"""
    if isinstance(msg, SystemMessage | RemoveMessage):
        return False
    if isinstance(msg, AIMessage) and not msg.content and not msg.tool_calls:
        return False
    return True
