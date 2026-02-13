import logging

from fastapi import APIRouter, BackgroundTasks, Header
from fastapi.responses import StreamingResponse
from app.schemas.chat import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    VectorRetrieveFilter,
)
from app.services.chat_service import ChatService

router = APIRouter()
logger = logging.getLogger(__name__)




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
    # 统一确保 filter 对象存在
    if not request.filter:
        request.filter = VectorRetrieveFilter(site_id=0)

    return await ChatService.process_chat_request(request, background_tasks)




