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
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.chat_message_feedback import delete_feedback, upsert_feedback
from app.db.database import get_db
from app.db.transaction import transactional
from app.schemas.chat import ResponsesAPIRequest, ResponsesAPIResponse
from app.schemas.chat_message_feedback import FeedbackOut, FeedbackSubmit
from app.services.chat import ChatService, get_chat_service
from app.services.chat.history import ChatHistoryService, get_chat_history_service

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


@transactional()
async def _submit_feedback(
    db: AsyncSession,
    history: ChatHistoryService,
    payload: FeedbackSubmit,
) -> FeedbackOut:
    """resolve (thread_id, message_seq) → chat_message_id；upsert 或 delete。"""
    from app.core.web.exceptions import NotFoundException

    msg_id = await history.resolve_assistant_message_id(payload.thread_id, payload.message_seq)
    if msg_id is None:
        # 等过持久化重试窗口仍找不到——返回 404，让前端短暂等待后重试
        raise NotFoundException("消息尚未落库，请稍后重试")

    if payload.rating is None:
        await delete_feedback(db, chat_message_id=msg_id, member_id=payload.member_id)
        return FeedbackOut(
            chat_message_id=msg_id, member_id=payload.member_id, rating=None, reason=None
        )

    row = await upsert_feedback(
        db,
        chat_message_id=msg_id,
        member_id=payload.member_id,
        rating=payload.rating,
        reason=payload.reason if payload.rating == "down" else None,
    )
    return FeedbackOut.model_validate(
        {
            "chat_message_id": row.chat_message_id,
            "member_id": row.member_id,
            "rating": row.rating,
            "reason": row.reason,
        }
    )


@router.post("/feedback", response_model=FeedbackOut, operation_id="submitChatFeedback")
async def submit_chat_feedback(
    payload: FeedbackSubmit,
    db: AsyncSession = Depends(get_db),
    history: ChatHistoryService = Depends(get_chat_history_service),
) -> FeedbackOut:
    """对某条 assistant 消息提交 👍 / 👎 反馈；rating=null 撤销。

    幂等：同 visitor 对同一消息再次提交即 upsert；撤销即 DELETE。
    """
    return await _submit_feedback(db, history, payload)
