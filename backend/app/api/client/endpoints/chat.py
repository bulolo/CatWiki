# Copyright 2024 CatWiki Authors
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

"""聊天补全端点 (LangGraph ReAct 版本)

基于 LangGraph 实现的 ReAct Agent 聊天流程：
1. Agent 自主决定检索、推理循环
2. 使用 astream_events 实时流式输出
3. 自动提取引用并同步
"""

import logging
import uuid
import json
import time
from typing import AsyncGenerator, List, Any

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import StreamingResponse
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage

from app.schemas.chat import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatCompletionChoice,
    ChatCompletionUsage,
    ChatMessage,
    ChatCompletionChunk,
    ChatCompletionChunkChoice,
    ChatCompletionChunkDelta,
)
from app.core.dynamic_config import get_dynamic_chat_config
from app.core.graph import create_agent_graph, langchain_to_openai, extract_citations_from_messages
from app.core.checkpointer import get_checkpointer
from app.db.database import AsyncSessionLocal
from app.services.chat_session_service import ChatSessionService

router = APIRouter()
logger = logging.getLogger(__name__)


async def stream_graph_events(
    graph,
    input_state: dict,
    config: dict,
    model_name: str,
    thread_id: str,
) -> AsyncGenerator[str, None]:
    """流式响应生成器 - 适配 OpenAI SSE 格式（含 tool_calls 支持）"""
    full_response = ""
    citations = []
    
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
                # LangChain 的 AIMessageChunk 可能包含 tool_call_chunks
                if hasattr(chunk_data, "tool_call_chunks") and chunk_data.tool_call_chunks:
                    for tc_chunk in chunk_data.tool_call_chunks:
                        tool_call_delta = {
                            "index": tc_chunk.get("index", 0),
                            "id": tc_chunk.get("id"),
                            "type": "function" if tc_chunk.get("id") else None,
                            "function": {
                                "name": tc_chunk.get("name"),
                                "arguments": tc_chunk.get("args", "")
                            }
                        }
                        # 清理 None 值
                        tool_call_delta = {k: v for k, v in tool_call_delta.items() if v is not None}
                        if tool_call_delta.get("function"):
                            tool_call_delta["function"] = {k: v for k, v in tool_call_delta["function"].items() if v is not None}
                        
                        chunk = ChatCompletionChunk(
                            id=chunk_id_prefix,
                            object="chat.completion.chunk",
                            created=int(time.time()),
                            model=model_name,
                            choices=[
                                ChatCompletionChunkChoice(
                                    index=0,
                                    delta=ChatCompletionChunkDelta(
                                        tool_calls=[tool_call_delta]
                                    ),
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
            citations = extract_citations_from_messages(final_messages)

        # 发送 Citations (自定义协议，客户端需支持)
        if citations:
            citation_chunk = {"citations": citations}
            yield f"data: {json.dumps(citation_chunk)}\n\n"

        # 发送 [DONE]
        yield "data: [DONE]\n\n"
        
        # 3. 异步更新数据库记录 (Side Effect)
        if full_response:
            async with AsyncSessionLocal() as db:
                await ChatSessionService.update_assistant_response(
                    db=db, thread_id=thread_id, assistant_message=full_response
                )

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
    origin: str | None = Header(None),
    referer: str | None = Header(None),
) -> ChatCompletionResponse | StreamingResponse:
    """
    创建聊天补全 (OpenAI 兼容接口)
    """
    # 如果未指定 site_id，则视为全局多站点模式 (site_id=0)
    site_id = request.filter.site_id if (request.filter and request.filter.site_id) else 0

    return await _process_chat_request(request, site_id)


@router.post(
    "/site-completions",
    response_model=ChatCompletionResponse,
    operation_id="createSiteChatCompletion",
)
async def create_site_chat_completion(
    request: ChatCompletionRequest,
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

    return await _process_chat_request(request, site.id)


async def _process_chat_request(
    request: ChatCompletionRequest, site_id: int
) -> ChatCompletionResponse | StreamingResponse:
    """核心聊天处理逻辑 (ReAct Agent)"""

    # 1. 获取动态配置
    async with AsyncSessionLocal() as db:
        chat_config = await get_dynamic_chat_config(db)

    current_model = chat_config["model"]
    current_api_key = chat_config["apiKey"]
    current_base_url = chat_config["baseUrl"]

    # 2. 初始化 ChatOpenAI
    # 这里的模型参数需要与 conf/config.py 或 动态配置保持一致
    llm = ChatOpenAI(
        model=current_model,
        api_key=current_api_key,
        base_url=current_base_url,
        temperature=request.temperature or 0.7,
        streaming=True, # 启用流式
    )

    # 3. 记录日志
    msg_preview = request.message[:200] + "..." if len(request.message) > 200 else request.message
    log_banner = (
        "\n"
        "╭───────────────────────  AI Chat Request (ReAct) ───────────────────────────╮\n"
        f"│ 🤖 Model    : {current_model:<50} │\n"
        f"│ 🌊 Stream   : {str(request.stream):<50} │\n"
        f"│ 🧵 Thread   : {request.thread_id:<50} │\n"
        f"│ 🏢 Site ID  : {site_id:<50} │\n"
        "│ ──────────────────────────────────────────────────────────────────────────── │\n"
        f"│ 🗨️  Message: {msg_preview[:60]:<60} │\n"
        "╰──────────────────────────────────────────────────────────────────────────────╯"
    )
    print(log_banner)

    # 4. 创建/更新数据库会话记录
    async with AsyncSessionLocal() as db:
        await ChatSessionService.create_or_update(
            db=db,
            thread_id=request.thread_id,
            site_id=site_id,
            user_message=request.message,
            member_id=request.user, 
        )

    # 5. 准备 Agent
    # 使用 checkpointer 管理状态
    checkpointer_cm = get_checkpointer()
    checkpointer = await checkpointer_cm.__aenter__() # 手动 enter 以便后续使用
    
    try:
        graph = create_agent_graph(checkpointer=checkpointer, model=llm)
        
        # 构造初始状态
        initial_state = {
            "messages": [HumanMessage(content=request.message)],
            # 其他状态字段根据 graph_state.py 如果有默认值可省略，或在此初始化
            "site_id": site_id,
        }
        
        config = {"configurable": {"thread_id": request.thread_id}}

        # 6. 处理请求
        if request.stream:
            # 流式响应：返回 StreamingResponse
            # 注意：StreamingResponse 会在后台运行 generator，我们需要在此处不关闭 checkpointer
            # 但 checkpointer 需要关闭... 这是一个问题。
            # 解决方案：在 generator 内部管理 checkpointer？
            # 或者，由于 postgres checkpointer 是无状态连接池，也许可以？
            # 更好的做法：把 checkpointer 的生命周期交给 generator 或者不使用 context manager (如果它支持).
            # 这里我们重构 stream_generator 内部去处理 checkpointer 的获取。
            
            # 为了避免连接泄露，我们先关闭这里的 checkpointer，让 generator 自己去获取
            await checkpointer_cm.__aexit__(None, None, None)
            
            async def protected_generator():
                async with get_checkpointer() as cp:
                    g = create_agent_graph(checkpointer=cp, model=llm)
                    async for chunk in stream_graph_events(g, initial_state, config, current_model, request.thread_id):
                        yield chunk

            return StreamingResponse(
                protected_generator(),
                media_type="text/event-stream",
            )
        
        else:
            # 非流式响应
            result = await graph.ainvoke(initial_state, config)
            
            # 提取最后回复
            messages = result["messages"]
            last_message = messages[-1] if messages else AIMessage(content="")
            content = last_message.content if isinstance(last_message, BaseMessage) else ""
            
            # 提取引用
            citations = extract_citations_from_messages(messages)
            
            # 更新数据库
            async with AsyncSessionLocal() as db:
                await ChatSessionService.update_assistant_response(
                    db=db, thread_id=request.thread_id, assistant_message=content
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
                usage=None, #这里略过 token 计算
                # 注意：标准 OpenAI 响应不包含 citations 字段，
                # 如果客户端需要，通常通过 side-channel 或 message extra 字段。
                # 但 CatWiki 前端可能期望在 response 中? 
                # 根据之前的代码，非流式并没有返回 citations... 
                # 查看之前的代码：citations 似乎没有被返回在 standard response body (Pydantic model) 中。
                # 只有流式最后发送了 citation chunk。
                # 我们可以暂时保持一致。
            )
            
            # 别忘了关闭 checkpointer
            await checkpointer_cm.__aexit__(None, None, None)

    except Exception as e:
        logger.error(f"❌ [Chat] Execution Error: {e}", exc_info=True)
        # 确保资源释放
        try:
             await checkpointer_cm.__aexit__(None, None, None)
        except:
            pass
        raise e
