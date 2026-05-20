# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""文档元数据 AI 增强 (content enrichment) —— 摘要 / 标签等衍生字段。

这是经典的 content enrichment 模式：以文档正文为输入，让 LLM 派生出可结构化
的元数据字段。当前覆盖 ``summary`` / ``tags``；未来若加自动分类、自动 SEO
描述、自动语言识别等同类衍生字段，都归入本模块。

设计要点：
- 不依赖 DB session 或其他 DI 服务；只需要租户上下文和 chat_provider。
- 提供两级回退：function_calling（首选，OpenAI 与多数兼容 provider 都支持）→
  纯文本 JSON parsing（针对 R1 等不支持工具调用的推理模型）。
- 调用方：``DocumentService.ai_generate_fields`` 转发；worker 直接调用。
"""

import json
import logging
import re

from pydantic import BaseModel as PydanticBaseModel

from app.core.common.i18n import _
from app.core.infra.tenant import get_current_tenant
from app.core.web.exceptions import BadRequestException

logger = logging.getLogger(__name__)


async def enrich_document_with_llm(
    content: str,
    fields: list[str],
    *,
    summary_max_length: int | None = None,
    tags_max_count: int | None = None,
) -> dict:
    """用 LLM 把文档正文派生为指定的元数据字段（``summary`` 和/或 ``tags``）。

    返回的 dict 只包含被请求的字段；解析失败时抛 ``BadRequestException``。
    函数名带 ``_with_llm`` 后缀是给观测者一个信号：本次调用会触发 LLM 请求
    （命中租户的 chat provider），便于日志与计费追踪。
    """
    from langchain_core.messages import HumanMessage, SystemMessage

    from app.core.ai.providers.chat import chat_provider

    active_tenant_id = get_current_tenant()

    try:
        llm = await chat_provider.get_model(
            tenant_id=active_tenant_id,
            temperature=0.3,
            purpose="AI 生成文档字段",
        )
    except Exception as e:
        raise BadRequestException(detail=_("doc.ai_llm_unavailable")) from e

    field_instructions = []
    if "summary" in fields:
        limit = summary_max_length or 150
        field_instructions.append(
            f'- "summary": 用不超过 {limit} 字概括文章核心内容，语言简洁客观，不要以"本文"开头'
        )
    if "tags" in fields:
        count = tags_max_count or 8
        field_instructions.append(
            f'- "tags": 提取最多 {count} 个关键词标签，每个标签 2~6 字，以 JSON 数组返回'
        )

    messages = [
        SystemMessage(
            content=(
                "你是一个专业的内容编辑助手。请根据用户提供的文章内容，生成指定字段。\n"
                "严格以 JSON 格式返回，只包含被要求的字段，不要输出任何多余内容。\n"
                "字段说明：\n" + "\n".join(field_instructions)
            )
        ),
        HumanMessage(content=f"请根据以下文章内容生成字段：\n\n{content}"),
    ]

    # 动态构造 Pydantic schema：with_structured_output 需要类型注解，
    # 我们只在请求时知道用户要哪几个字段
    annotations: dict = {}
    defaults: dict = {}
    if "summary" in fields:
        annotations["summary"] = str | None
        defaults["summary"] = None
    if "tags" in fields:
        annotations["tags"] = list[str] | None
        defaults["tags"] = None
    dynamic_schema = type(
        "GeneratedFields",
        (PydanticBaseModel,),
        {"__annotations__": annotations, **defaults},
    )

    # 策略 1：function_calling（兼容 OpenAI / DeepSeek V3 等多数 provider）
    # 注：默认 method="json_schema" 用 OpenAI strict 模式，DeepSeek 不支持，须显式指定
    try:
        result = await llm.with_structured_output(
            dynamic_schema, method="function_calling"
        ).ainvoke(messages)
        data: dict = {k: getattr(result, k, None) for k in fields}
    except Exception as e:
        # 仅当模型「不支持工具调用」时降级到策略 2；其余（鉴权/网络/限流）直接抛
        if not _is_tool_unsupported_error(e):
            raise BadRequestException(detail=_("doc.ai_generate_failed", error=str(e))) from e
        logger.warning("function_calling not supported by model, falling back to plain text: %s", e)
        # 策略 2：纯文本回退（兜底 R1 等不支持工具调用的推理模型）
        try:
            raw_result = await llm.ainvoke(messages)
        except Exception as e2:
            raise BadRequestException(detail=_("doc.ai_generate_failed", error=str(e2))) from e2
        raw_text = raw_result.content if hasattr(raw_result, "content") else str(raw_result)
        try:
            data = _extract_json_object(raw_text)
        except Exception as e2:
            raise BadRequestException(detail=_("doc.ai_generate_failed", error=str(e2))) from e2

    output: dict = {}
    if "summary" in fields:
        output["summary"] = data.get("summary") or None
    if "tags" in fields:
        raw = data.get("tags")
        output["tags"] = raw if isinstance(raw, list) else []
    return output


def _is_tool_unsupported_error(exc: BaseException) -> bool:
    """判断异常是否因模型不支持工具调用（400 Bad Request）引起。

    用异常类型而非字符串匹配，避免多语言错误消息或措辞差异导致的误判：
    - 400 BadRequest：视为工具调用不兼容，允许降级到纯文本策略
    - 401/403/429/网络类：属于配置或临时性错误，直接抛出不降级
    """
    import openai

    if isinstance(
        exc,
        openai.AuthenticationError
        | openai.PermissionDeniedError
        | openai.RateLimitError
        | openai.APIConnectionError
        | openai.APITimeoutError,
    ):
        return False
    if isinstance(exc, openai.BadRequestError):
        return True
    # 兜底：检查 __cause__ 链（LangChain 可能包装异常）
    if exc.__cause__ is not None:
        return _is_tool_unsupported_error(exc.__cause__)
    return False


def _extract_json_object(text: str) -> dict:
    """从 LLM 返回文本中提取第一个完整 JSON 对象。

    解析顺序：
    1. 整体直接 parse（模型返回纯 JSON）
    2. 定位代码块起始位置后，复用括号计数提取（避免非贪婪正则被字符串内 } 截断）
    3. 从全文第一个 { 用括号计数定位最外层对象
    """
    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    code_block = re.search(r"```(?:json)?\s*", text)
    search_from = code_block.end() if code_block else 0
    start = text.find("{", search_from)
    if start == -1:
        raise ValueError("LLM 响应中未找到 JSON 对象")
    depth = 0
    for i, ch in enumerate(text[start:], start):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return json.loads(text[start : i + 1])
    raise ValueError("LLM 响应中 JSON 括号不匹配")
