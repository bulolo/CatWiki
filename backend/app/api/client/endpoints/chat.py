"""聊天补全端点 (LangGraph ReAct 版本)

基于 LangGraph 实现的 ReAct Agent 聊天流程：
1. Agent 自主决定检索、推理循环
2. 使用 astream_events 实时流式输出
3. 自动提取引用并同步
"""

import json
import logging
import time
import uuid
from collections.abc import AsyncGenerator

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException
from fastapi.responses import StreamingResponse
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_openai import ChatOpenAI

from app.core.checkpointer import get_checkpointer
from app.core.graph import create_agent_graph
from app.core.rag_utils import convert_tool_call_chunk_to_openai, extract_sources_from_messages
from app.db.database import AsyncSessionLocal
from app.schemas.chat import (
    ChatCompletionChoice,
    ChatCompletionChunk,
    ChatCompletionChunkChoice,
    ChatCompletionChunkDelta,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatMessage,
)
from app.services.chat_session_service import ChatSessionService

router = APIRouter()
logger = logging.getLogger(__name__)


async def stream_graph_events(
    graph,
    input_state: dict,
    config: dict,
    model_name: str,
    thread_id: str,
    background_tasks: BackgroundTasks,
) -> AsyncGenerator[str, None]:
    """流式响应生成器 - 适配 OpenAI SSE 格式（含 tool_calls 支持）"""
    full_response = ""
    sources = []

    # 生成唯一的 chunk ID 前缀
    chunk_id_prefix = f"chatcmpl-{uuid.uuid4()}"

    try:
        # 使用 v1 event 格式
        async for event in graph.astream_events(input_state, config, version="v1"):
            kind = event["event"]

            # 1. 处理 LLM 流式输出 (Token)
            if kind == "on_chat_model_stream":
                chunk_data = event["data"]["chunk"]
                chunk_content = chunk_data.content

                # 处理文本内容
                if chunk_content:
                    full_response += chunk_content

                    # 构造 OpenAI 兼容 chunk
                    chunk = ChatCompletionChunk(
                        id=chunk_id_prefix,
                        object="chat.completion.chunk",
                        created=int(time.time()),
                        model=model_name,
                        choices=[
                            ChatCompletionChunkChoice(
                                index=0,
                                delta=ChatCompletionChunkDelta(content=chunk_content),
                                finish_reason=None,
                            )
                        ],
                    )
                    yield f"data: {chunk.model_dump_json()}\n\n"

                # 处理 tool_calls (如果存在)
                if hasattr(chunk_data, "tool_call_chunks") and chunk_data.tool_call_chunks:
                    for tc_chunk in chunk_data.tool_call_chunks:
                        cleaned_tc = convert_tool_call_chunk_to_openai(tc_chunk)

                        chunk = ChatCompletionChunk(
                            id=chunk_id_prefix,
                            object="chat.completion.chunk",
                            created=int(time.time()),
                            model=model_name,
                            choices=[
                                ChatCompletionChunkChoice(
                                    index=0,
                                    delta=ChatCompletionChunkDelta(tool_calls=[cleaned_tc]),
                                    finish_reason=None,
                                )
                            ],
                        )
                        yield f"data: {chunk.model_dump_json()}\n\n"

            # 2. 工具开始调用 - 发送状态指示
            elif kind == "on_tool_start":
                tool_name = event.get("name", "unknown")
                logger.debug(f"🔧 [Stream] Tool started: {tool_name}")
                # 可选：发送自定义状态 chunk 供前端显示 "正在搜索..."
                # 这不是 OpenAI 标准，但可作为扩展
                status_chunk = {"status": "tool_calling", "tool": tool_name}
                yield f"data: {json.dumps(status_chunk)}\n\n"

            # 3. 监听工具调用结束
            elif kind == "on_tool_end":
                pass

        # 循环结束，处理收尾工作

        # 从 Checkpoint 获取最终状态以提取引用
        # 注意: astream_events 结束时，graph 状态已更新
        # 我们需要一个新的 state snapshot 或者从 event history 分析
        # 最简单是重新获取 state
        state_snapshot = await graph.aget_state(config)
        if state_snapshot.values:
            final_messages = state_snapshot.values.get("messages", [])

            sources = extract_sources_from_messages(final_messages, from_last_turn=True)

        # 发送 Sources (自定义协议，客户端需支持)
        if sources:
            source_chunk = {"sources": sources}
            yield f"data: {json.dumps(source_chunk)}\n\n"

        # 发送 [DONE]
        yield "data: [DONE]\n\n"

        # 3. 异步更新数据库记录 (Side Effect)
        async def save_history():
            async with AsyncSessionLocal() as db:
                # 获取最终消息列表
                state_snapshot = await graph.aget_state(config)
                final_messages = (
                    state_snapshot.values.get("messages", []) if state_snapshot.values else []
                )

                # 提取最后一条 AI 回复
                final_response = ""
                if final_messages:
                    for msg in reversed(final_messages):
                        if isinstance(msg, AIMessage) and msg.content:
                            final_response = msg.content
                            break

                # 保存 AI 回复，优先使用消息列表中的内容，若无则使用 full_response
                persistent_content = final_response or full_response

                if persistent_content:
                    await ChatSessionService.update_assistant_response(
                        db=db, thread_id=thread_id, assistant_message=persistent_content
                    )

                # 保存这一轮产生的所有新消息（AIMessage, ToolMessage 等）
                await ChatSessionService.save_history_from_messages(
                    db=db, thread_id=thread_id, messages=final_messages
                )

        background_tasks.add_task(save_history)

    except Exception as e:
        logger.error(f"❌ [Chat] Stream error: {e}", exc_info=True)
        # 发送错误信息给前端
        error_chunk = ChatCompletionChunk(
            id=f"error-{uuid.uuid4()}",
            model=model_name,
            choices=[
                ChatCompletionChunkChoice(
                    index=0,
                    delta=ChatCompletionChunkDelta(content=f"\n\n[System Error: {str(e)}]"),
                    finish_reason="stop",
                )
            ],
        )
        yield f"data: {error_chunk.model_dump_json()}\n\n"
        yield "data: [DONE]\n\n"


@router.post(
    "/completions", response_model=ChatCompletionResponse, operation_id="createChatCompletion"
)
async def create_chat_completion(
    request: ChatCompletionRequest,
    background_tasks: BackgroundTasks,
    origin: str | None = Header(None),
    referer: str | None = Header(None),
) -> ChatCompletionResponse | StreamingResponse:
    """
    创建聊天补全 (OpenAI 兼容接口)
    """
    # 如果未指定 site_id，则视为全局多站点模式 (site_id=0)
    site_id = request.filter.site_id if (request.filter and request.filter.site_id) else 0

    return await _process_chat_request(request, site_id, background_tasks)


@router.post(
    "/site-completions",
    response_model=ChatCompletionResponse,
    operation_id="createSiteChatCompletion",
)
async def create_site_chat_completion(
    request: ChatCompletionRequest,
    background_tasks: BackgroundTasks,
    authorization: str = Header(..., description="Bearer <api_key>"),
) -> ChatCompletionResponse | StreamingResponse:
    """
    创建聊天补全 (专用接口)
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format")

    token = authorization.replace("Bearer ", "")

    async with AsyncSessionLocal() as db:
        from app.crud.site import crud_site

        site = await crud_site.get_by_api_token(db, api_token=token)

    if not site:
        raise HTTPException(status_code=401, detail="Invalid API Key")

    return await _process_chat_request(request, site.id, background_tasks)


async def _process_chat_request(
    request: ChatCompletionRequest, site_id: int, background_tasks: BackgroundTasks
) -> ChatCompletionResponse | StreamingResponse:
    """核心聊天处理逻辑 (ReAct Agent)"""

    # 1. 获取 Site 信息以确定 Tenant
    site_tenant_id = None
    if site_id > 0:
        async with AsyncSessionLocal() as db:
            from app.crud.site import crud_site
            site = await crud_site.get(db, id=site_id)
            if site:
                site_tenant_id = site.tenant_id

    # 2. 获取动态配置 (通过缓存管理器)
    from app.core.dynamic_config_manager import dynamic_config_manager

    chat_config = await dynamic_config_manager.get_chat_config(tenant_id=site_tenant_id)

    current_model = chat_config["model"]
    current_api_key = chat_config["apiKey"]
    current_base_url = chat_config["baseUrl"]

    # 2. 初始化 ChatOpenAI
    llm = ChatOpenAI(
        model=current_model,
        api_key=current_api_key,
        base_url=current_base_url,
        temperature=request.temperature or 0.7,
        streaming=True,  # 启用流式
    )

    # 3. 记录日志
    msg_preview = request.message[:200] + "..." if len(request.message) > 200 else request.message

    # 4. 创建/更新数据库会话记录
    async with AsyncSessionLocal() as db:
        session = await ChatSessionService.create_or_update(
            db=db,
            thread_id=request.thread_id,
            site_id=site_id,
            user_message=request.message,
            member_id=request.user,
        )
        # 对话轮次 = (消息总数 + 1) // 2
        round_count = (session.message_count + 1) // 2

        # 5. [NEW] 保存全量用户消息历史
        await ChatSessionService.save_message(
            db=db, thread_id=request.thread_id, role="user", content=request.message
        )

    # 6. 准备初始状态
    initial_state = {
        "messages": [HumanMessage(content=request.message)],
        "site_id": site_id,
        "iteration_count": 0,
        "consecutive_empty_count": 0,
    }
    config = {"configurable": {"thread_id": request.thread_id, "site_id": site_id}}

    try:
        # 7. 处理请求
        if request.stream:

            async def protected_generator():
                async with get_checkpointer() as cp:
                    g = create_agent_graph(checkpointer=cp, model=llm)
                    async for chunk in stream_graph_events(
                        g, initial_state, config, current_model, request.thread_id, background_tasks
                    ):
                        yield chunk

            return StreamingResponse(
                protected_generator(),
                media_type="text/event-stream",
            )

        else:
            # 非流式响应
            async with get_checkpointer() as cp:
                graph = create_agent_graph(checkpointer=cp, model=llm)
                result = await graph.ainvoke(initial_state, config)

                # 提取最后回复
                messages = result["messages"]
                last_message = messages[-1] if messages else AIMessage(content="")
                content = last_message.content if isinstance(last_message, BaseMessage) else ""

                # 提取引用 (仅当前回合)
                sources = extract_sources_from_messages(messages, from_last_turn=True)

                # 更新数据库 (元数据 + 全量历史)
                async with AsyncSessionLocal() as db:
                    await ChatSessionService.update_assistant_response(
                        db=db, thread_id=request.thread_id, assistant_message=content
                    )
                    await ChatSessionService.save_history_from_messages(
                        db=db, thread_id=request.thread_id, messages=messages
                    )

                # 构造响应
                return ChatCompletionResponse(
                    id=f"chatcmpl-{uuid.uuid4()}",
                    object="chat.completion",
                    created=int(time.time()),
                    model=current_model,
                    choices=[
                        ChatCompletionChoice(
                            index=0,
                            message=ChatMessage(role="assistant", content=content),
                            finish_reason="stop",
                        )
                    ],
                    usage=None,
                )

    except Exception as e:
        logger.error(f"❌ [Chat] Execution Error: {e}", exc_info=True)
        raise e
