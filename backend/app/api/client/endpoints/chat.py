import logging
import uuid
import time
import json
import asyncio
from typing import AsyncGenerator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI, APIError

from app.core.config import settings
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

router = APIRouter()
logger = logging.getLogger(__name__)

# Global client removed in favor of dynamic instantiation
# client = AsyncOpenAI(...) 

from app.core.dynamic_config import get_dynamic_chat_config
from app.db.database import AsyncSessionLocal

async def stream_generator(client: AsyncOpenAI, model: str, request: ChatCompletionRequest, citations: list = None) -> AsyncGenerator[str, None]:
    """真实流式响应生成器"""
    try:
        stream = await client.chat.completions.create(
            model=model,
            messages=[msg.model_dump(exclude_none=True) for msg in request.messages],
            stream=True,
            temperature=request.temperature,
            top_p=request.top_p,
            max_tokens=request.max_tokens,
            presence_penalty=request.presence_penalty,
            frequency_penalty=request.frequency_penalty,
        )

        async for chunk in stream:
            # 兼容 OpenAI 格式直接透传
            yield f"data: {chunk.model_dump_json()}\n\n"

        # 在结束前发送 Citations
        if citations:
             citation_chunk = {
                 "citations": citations
             }
             yield f"data: {json.dumps(citation_chunk)}\n\n"

        yield "data: [DONE]\n\n"
        
    except Exception as e:
        logger.error(f"❌ [Chat] Stream error: {e}")
        # 发送错误信息给前端
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
    对接真实 AI 服务
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
    # 记录详细请求信息 (使用显眼的格式)
    last_msg = request.messages[-1].content if request.messages else "No messages"
    last_msg_preview = last_msg[:200] + "..." if len(last_msg) > 200 else last_msg
    
    log_banner = (
        "\n"
        "╭───────────────────────  AI Chat Request ───────────────────────╮\n"
        f"│ 🤖 Model    : {current_model:<46} │\n"
        f"│ 🌊 Stream   : {str(request.stream):<46} │\n"
        f"│ 🔍 Filter   : {str(request.filter if request.filter else 'None (Global Mode)'):<46} │\n"
        f"│  Messages : {len(request.messages):<46} │\n"
        "│ ──────────────────────────────────────────────────────────────── │\n"
        "│ 🗨️  Config      : {current_base_url} ({current_api_key[:6]}...)     \n"
        "│ 🗨️  Last Message:                                                │\n"
        f"{last_msg_preview}\n"
        "╰──────────────────────────────────────────────────────────────────╯"
    )
    # 使用 print 确保直接输出到控制台 (有时候 logger 会有格式化)
    print(log_banner)
    # 同时记录到 logger 供持久化
    logger.info(f"AI Chat Request: model={current_model} filter={request.filter}")

    # 如果有 filter，目前仅打印日志，后续对接 RAG
    if request.filter:
        logger.info(f" [Chat] RAG Filter: {request.filter}")

    # RAG: 如果有最后一条消息，尝试检索相关文档
    context_str = ""
    retrieved_docs = []
    relevant_docs = []
    if request.messages:
        try:
            from app.services.vector_service import VectorService
            
            # 提取最后一条用户消息
            query = request.messages[-1].content
            
            # 执行检索
            logger.info(f"🔍 [Chat] Detecting RAG opportunity for query: '{query[:50]}...'")
            retrieved_docs = await VectorService.retrieve(
                query=query,
                k=10,  # 召回10条
                # 后续可以在 request 中增加 enable_rerank 参数控制
                # enable_rerank=settings.AI_RERANK_ENABLE (已移除，由 VectorService 自动判断)
            )
            
            if retrieved_docs:
                logger.info(f"📚 [Chat] Found {len(retrieved_docs)} relevant context docs")
                
                # 按 document_id 分组
                # 原因：retrieved_docs 是片段级别 (chunks)，可能多个片段属于同一个文档。
                # 如果直接将片段作为 [1], [2]... 喂给 LLM，会导致：
                # 1. LLM 引用 [5]
                # 2. 前端展示的来源列表（基于文档去重）只有 [1], [2], [3]
                # 3. 从而产生引用序号不匹配的问题
                # 
                # 解决方案：
                # 在构建 Prompt 之前先按 document_id 进行聚合，将同一文档的多个片段合并为一个 Context Item。
                # 这样 Prompt 中的 Document [1] 就严格对应前端展示的 Citation [1]。
                doc_map = {}
                for doc in retrieved_docs:
                    doc_id = doc.document_id
                    if not doc_id:
                        continue
                        
                    if doc_id not in doc_map:
                        doc_map[doc_id] = {
                            "title": doc.document_title,
                            "content": [],
                            "metadata": doc.metadata,
                            "score": doc.score,
                            "document_id": doc_id
                        }
                    # 保留 chunk 内容
                    doc_map[doc_id]["content"].append(doc.content)
                
                # 转换回列表 (保持原始相关性排序，即第一次出现的顺序)
                relevant_docs = []
                seen_ids = set()
                for doc in retrieved_docs:
                    doc_id = doc.document_id
                    if not doc_id or doc_id in seen_ids:
                        continue
                        
                    seen_ids.add(doc_id)
                    info = doc_map[doc_id]
                    # 合并内容，用省略号分隔
                    full_content = "\n...\n".join(info["content"])
                    
                    relevant_docs.append({
                        "title": info["title"],
                        "content": full_content,
                        "metadata": info["metadata"],
                        "score": info["score"],
                        "document_id": doc_id
                    })

                logger.info(f"📚 [Chat] Found {len(retrieved_docs)} chunks -> collapsed to {len(relevant_docs)} unique docs")
                
                # 构建上下文 Prompt
                context_parts = []
                for i, doc in enumerate(relevant_docs):
                    # 格式: [1] Title (Score: 0.95): Content...
                    context_parts.append(
                        f"Document [{i+1}] (Title: {doc['title']})\n"
                        f"{doc['content']}\n"
                    )
                
                context_str = "\n".join(context_parts)
                
                # 注入 System Prompt
                system_prompt = (
                    "你是一个知识库的智能 AI 助手。\n"
                    "请使用以下检索到的上下文片段来回答用户的问题。\n"
                    "如果无法从上下文中找到答案，请告知用户你根据知识库无法回答，但你可以尝试提供帮助。\n"
                    "如果相关，请始终引用文档标题。\n\n"
                    "上下文信息:\n"
                    f"{context_str}\n"
                )
                
                # 将 System Message 插入到消息列表最前面
                # 或者如果第一条已经是 system，则追加到 content 或者替换
                if request.messages[0].role == "system":
                   # 追加到现有 system prompt
                   request.messages[0].content += f"\n\n{system_prompt}"
                else:
                   # 插入新的 system prompt
                   request.messages.insert(0, ChatMessage(role="system", content=system_prompt))
                   
                logger.debug(f"📝 [Chat] Context injected into system prompt ({len(context_str)} chars)")
            else:
                logger.info("🤷 [Chat] No relevant context found above threshold")

        except Exception as e:
            logger.error(f"❌ [Chat] RAG retrieval failed: {e}", exc_info=True)
            # 检索失败不影响主流程，继续 naked chat
            
    try:
        if request.stream:
            # 准备引用来源 (Citations)
            citations = []
            if retrieved_docs:
                try:
                    from app.crud import crud_site
                    
                    # 获取涉及到的 site_id
                    site_ids = list(set(doc.metadata.get("site_id") for doc in retrieved_docs if doc.metadata.get("site_id")))
                    
                    site_map = {}
                    if site_ids:
                        async with AsyncSessionLocal() as db:
                            sites = await crud_site.get_multi(db, ids=site_ids)
                            site_map = {site.id: site for site in sites}
                    
                    # 构建 Citation 对象
                    # 注意：relevant_docs 已经是唯一文档列表，且顺序与 Prompt 中的 Context 一致
                    for i, doc in enumerate(relevant_docs):
                        doc_id = doc["document_id"]
                        site_id = doc["metadata"].get("site_id")
                        site = site_map.get(site_id)
                        
                        citations.append({
                            "id": str(doc_id),
                            "title": doc["title"],
                            "siteId": site_id,
                            "siteName": site.name if site else "Unknown",
                            "siteDomain": site.domain if site else "",
                            "documentId": doc_id,
                            "score": doc["score"]
                        })
                    
                    logger.info(f"📎 [Chat] Prepared {len(citations)} citations")
                    
                except Exception as e:
                    logger.error(f"❌ [Chat] Failed to prepare citations: {e}")

            # Pass modified messages (with enhanced system prompt) AND citations
            return StreamingResponse(
                stream_generator(client, current_model, request, citations=citations),
                media_type="text/event-stream"
            )

        # 非流式响应
        response = await client.chat.completions.create(
            model=current_model,
            messages=[msg.model_dump(exclude_none=True) for msg in request.messages],
            stream=False,
            temperature=request.temperature,
            top_p=request.top_p,
            max_tokens=request.max_tokens,
            presence_penalty=request.presence_penalty,
            frequency_penalty=request.frequency_penalty,
        )
        
        # 转换为内部 Schema (虽然结构基本一致，但为了类型安全)
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
        # 这里应该返回标准 HTTP 错误，由全局异常处理器捕获
        raise e
