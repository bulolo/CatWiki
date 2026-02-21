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

import logging

from fastapi import APIRouter, BackgroundTasks, Header
from fastapi.responses import StreamingResponse

from app.schemas.chat import (
    ChatCompletionRequest,
    ChatCompletionResponse,
)
from app.services.chat.chat_service import ChatService

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
    # 统一通过 ChatService 处理，它已包含 Site/Tenant 路由、LLM 池化和流式支持
    from app.services.chat.chat_service import ChatService

    return await ChatService.process_chat_request(request, background_tasks)
