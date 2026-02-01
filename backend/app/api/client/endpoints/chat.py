"""聊天补全端点 (LangGraph 版本)

基于 LangGraph 实现的 RAG 聊天流程：
1. 使用 LangGraph 图进行检索和消息预处理
2. 调用 OpenAI 兼容 API 生成回答
3. 支持流式输出
"""

import logging
import uuid
import json
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI

from app.schemas.chat import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatCompletionChoice,
    ChatCompletionUsage,
    ChatMessage,
    ChatCompletionChunk,
    ChatCompletionChunkChoice,
    ChatCompletionChunkDelta
)
from app.core.dynamic_config import get_dynamic_chat_config
from app.core.graph import rag_graph, messages_to_langchain, langchain_to_openai
from app.db.database import AsyncSessionLocal

router = APIRouter()
logger = logging.getLogger(__name__)


async def stream_generator(
    client: AsyncOpenAI, 
    model: str, 
    messages: list[dict],
    request: ChatCompletionRequest, 
    citations: list = None
) -> AsyncGenerator[str, None]:
    """流式响应生成器
    
    Args:
        client: OpenAI 客户端
        model: 模型名称
        messages: 消息列表（已包含 RAG 上下文）
        request: 原始请求（用于参数）
        citations: 引用来源列表
    """
    try:
        stream = await client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
            temperature=request.temperature,
            top_p=request.top_p,
            max_tokens=request.max_tokens,
            presence_penalty=request.presence_penalty,
            frequency_penalty=request.frequency_penalty,
        )

        async for chunk in stream:
            yield f"data: {chunk.model_dump_json()}\n\n"

        # 在结束前发送 Citations
        if citations:
            citation_chunk = {"citations": citations}
            yield f"data: {json.dumps(citation_chunk)}\n\n"

        yield "data: [DONE]\n\n"
        
    except Exception as e:
        logger.error(f"❌ [Chat] Stream error: {e}")
        error_chunk = ChatCompletionChunk(
            id=f"error-{uuid.uuid4()}",
            model=model,
            choices=[
                ChatCompletionChunkChoice(
                    index=0,
                    delta=ChatCompletionChunkDelta(content=f"\n\n[Error: {str(e)}]"),
                    finish_reason="stop"
                )
            ]
        )
        yield f"data: {error_chunk.model_dump_json()}\n\n"
        yield "data: [DONE]\n\n"


@router.post("/completions", response_model=ChatCompletionResponse, operation_id="createChatCompletion")
async def create_chat_completion(
    request: ChatCompletionRequest,
) -> ChatCompletionResponse | StreamingResponse:
    """
    创建聊天补全 (OpenAI 兼容接口)
    
    使用 LangGraph 进行 RAG 检索和消息预处理，
    然后调用配置的 AI 服务生成回答。
    """
    # 1. 获取动态配置
    async with AsyncSessionLocal() as db:
        chat_config = await get_dynamic_chat_config(db)
    
    current_model = chat_config["model"]
    current_api_key = chat_config["apiKey"]
    current_base_url = chat_config["baseUrl"]

    # 实例化客户端 (Per-request)
    client = AsyncOpenAI(
        api_key=current_api_key,
        base_url=current_base_url,
    )

    # 记录请求信息
    last_msg = request.messages[-1].content if request.messages else "No messages"
    last_msg_preview = last_msg[:200] + "..." if len(last_msg) > 200 else last_msg
    
    log_banner = (
        "\n"
        "╭───────────────────────  AI Chat Request (LangGraph) ───────────────────────╮\n"
        f"│ 🤖 Model    : {current_model:<50} │\n"
        f"│ 🌊 Stream   : {str(request.stream):<50} │\n"
        f"│ 🔍 Filter   : {str(request.filter if request.filter else 'None (Global Mode)'):<50} │\n"
        f"│ 📨 Messages : {len(request.messages):<50} │\n"
        "│ ──────────────────────────────────────────────────────────────────────────── │\n"
        f"│ 🗨️  Last Message: {last_msg_preview[:60]:<60} │\n"
        "╰──────────────────────────────────────────────────────────────────────────────╯"
    )
    print(log_banner)
    logger.info(f"AI Chat Request (LangGraph): model={current_model} filter={request.filter}")

    # 2. 使用 LangGraph 执行 RAG 流程
    try:
        # 转换消息格式
        langchain_messages = messages_to_langchain(
            [msg.model_dump(exclude_none=True) for msg in request.messages]
        )
        
        # 构建初始状态
        initial_state = {
            "messages": langchain_messages,
            "context": "",
            "citations": [],
            "should_retrieve": True,
            "rewritten_query": ""
        }
        
        # 执行图
        logger.info("� [Chat] Invoking LangGraph RAG pipeline...")
        result = await rag_graph.ainvoke(initial_state)
        
        # 提取结果
        processed_messages = langchain_to_openai(result["messages"])
        citations = result.get("citations", [])
        
        logger.info(f"✅ [Chat] LangGraph completed. Citations: {len(citations)}")
        
    except Exception as e:
        logger.error(f"❌ [Chat] LangGraph error: {e}", exc_info=True)
        # 降级：使用原始消息
        processed_messages = [msg.model_dump(exclude_none=True) for msg in request.messages]
        citations = []

    # 3. 调用 LLM 生成回答
    try:
        if request.stream:
            return StreamingResponse(
                stream_generator(client, current_model, processed_messages, request, citations=citations),
                media_type="text/event-stream"
            )

        # 非流式响应
        response = await client.chat.completions.create(
            model=current_model,
            messages=processed_messages,
            stream=False,
            temperature=request.temperature,
            top_p=request.top_p,
            max_tokens=request.max_tokens,
            presence_penalty=request.presence_penalty,
            frequency_penalty=request.frequency_penalty,
        )
        
        return ChatCompletionResponse(
            id=response.id,
            object=response.object,
            created=response.created,
            model=response.model,
            choices=[
                ChatCompletionChoice(
                    index=c.index,
                    message=ChatMessage(
                        role=c.message.role,
                        content=c.message.content or ""
                    ),
                    finish_reason=c.finish_reason
                ) for c in response.choices
            ],
            usage=ChatCompletionUsage(
                prompt_tokens=response.usage.prompt_tokens,
                completion_tokens=response.usage.completion_tokens,
                total_tokens=response.usage.total_tokens
            ) if response.usage else None
        )

    except Exception as e:
        logger.error(f"❌ [Chat] API Error: {e}", exc_info=True)
        raise e
