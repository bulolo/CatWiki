"""聊天补全端点 (LangGraph 持久化版本)

基于 LangGraph 实现的 RAG 聊天流程：
1. 使用 PostgreSQL Checkpointer 持久化会话历史
2. 使用 LangGraph 图进行检索和消息预处理
3. 调用 OpenAI 兼容 API 生成回答
4. 支持流式输出
5. 自动创建/更新 ChatSession 记录
"""

import logging
import uuid
import json
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
from langchain_core.messages import HumanMessage

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
from app.core.graph import create_agent_graph, langchain_to_openai
from app.core.checkpointer import get_checkpointer
from app.db.database import AsyncSessionLocal
from app.services.chat_session_service import ChatSessionService

router = APIRouter()
logger = logging.getLogger(__name__)


async def stream_generator(
    client: AsyncOpenAI, 
    model: str, 
    messages: list[dict],
    request: ChatCompletionRequest, 
    citations: list = None
) -> AsyncGenerator[str, None]:
    """流式响应生成器"""
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

        full_response = ""
        async for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                full_response += chunk.choices[0].delta.content
            yield f"data: {chunk.model_dump_json()}\n\n"

        # 在结束前发送 Citations
        if citations:
            citation_chunk = {"citations": citations}
            yield f"data: {json.dumps(citation_chunk)}\n\n"

        # 更新会话最后一条消息
        if full_response:
            async with AsyncSessionLocal() as db:
                await ChatSessionService.update_assistant_response(
                    db=db,
                    thread_id=request.thread_id,
                    assistant_message=full_response
                )

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
    
    使用 PostgreSQL Checkpointer 持久化会话历史，
    前端只需传入 thread_id 和当前消息。
    """
    # 1. 获取动态配置
    async with AsyncSessionLocal() as db:
        chat_config = await get_dynamic_chat_config(db)
    
    current_model = chat_config["model"]
    current_api_key = chat_config["apiKey"]
    current_base_url = chat_config["baseUrl"]

    # 实例化客户端
    client = AsyncOpenAI(
        api_key=current_api_key,
        base_url=current_base_url,
    )

    # 记录请求信息
    msg_preview = request.message[:200] + "..." if len(request.message) > 200 else request.message
    
    log_banner = (
        "\n"
        "╭───────────────────────  AI Chat Request (LangGraph) ───────────────────────╮\n"
        f"│ 🤖 Model    : {current_model:<50} │\n"
        f"│ 🌊 Stream   : {str(request.stream):<50} │\n"
        f"│ 🧵 Thread   : {request.thread_id:<50} │\n"
        "│ ──────────────────────────────────────────────────────────────────────────── │\n"
        f"│ 🗨️  Message: {msg_preview[:60]:<60} │\n"
        "╰──────────────────────────────────────────────────────────────────────────────╯"
    )
    print(log_banner)
    logger.info(f"AI Chat Request: model={current_model} thread_id={request.thread_id}")

    # 1.5 创建/更新会话记录
    site_id = request.filter.site_id if request.filter else 1  # 默认站点ID
    async with AsyncSessionLocal() as db:
        await ChatSessionService.create_or_update(
            db=db,
            thread_id=request.thread_id,
            site_id=site_id,
            user_message=request.message,
            member_id=None,  # TODO: 从认证上下文获取
        )

    # 2. 使用 LangGraph 执行 RAG 流程（带持久化）
    try:
        async with get_checkpointer() as checkpointer:
            graph = create_agent_graph(checkpointer=checkpointer)
            
            # 只传入当前消息，历史由 Checkpointer 自动管理
            initial_state = {
                "messages": [HumanMessage(content=request.message)],
                "context": "",
                "citations": [],
                "should_retrieve": True,
                "rewritten_query": ""
            }
            
            # 配置 thread_id
            config = {"configurable": {"thread_id": request.thread_id}}
            
            logger.info(f"🚀 [Chat] Invoking LangGraph (thread={request.thread_id})...")
            result = await graph.ainvoke(initial_state, config)
        
        # 提取结果
        processed_messages = langchain_to_openai(result["messages"])
        citations = result.get("citations", [])
        
        logger.info(f"✅ [Chat] LangGraph completed. Citations: {len(citations)}")
        
    except Exception as e:
        logger.error(f"❌ [Chat] LangGraph error: {e}", exc_info=True)
        # 降级：仅使用当前消息
        processed_messages = [{"role": "user", "content": request.message}]
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
        
        # 更新会话最后一条消息
        assistant_message = response.choices[0].message.content or ""
        async with AsyncSessionLocal() as db:
            await ChatSessionService.update_assistant_response(
                db=db,
                thread_id=request.thread_id,
                assistant_message=assistant_message
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
