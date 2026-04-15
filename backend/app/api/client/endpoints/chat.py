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

from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse

from app.schemas.chat import ResponsesAPIRequest, ResponsesAPIResponse
from app.services.chat.chat_service import ChatService, get_chat_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/responses", response_model=ResponsesAPIResponse, operation_id="createResponse")
async def create_response(
    request: ResponsesAPIRequest,
    background_tasks: BackgroundTasks,
    service: ChatService = Depends(get_chat_service),
) -> ResponsesAPIResponse | StreamingResponse:
    """
    创建 AI 响应（标准 OpenAI Responses API，含 CatWiki 扩展字段 filter）
    """
    return await service.process_responses_request(request, background_tasks)
