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

"""Chat Sessions API - 会话管理端点"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.schemas.response import ApiResponse
from app.schemas.chat_session import (
    ChatSessionListResponse,
    ChatSessionResponse,
    ChatSessionMessagesResponse,
)
from app.services.chat_session_service import ChatSessionService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get(
    "/sessions",
    response_model=ApiResponse[ChatSessionListResponse],
    operation_id="listChatSessions",
)
async def list_sessions(
    site_id: Optional[int] = Query(None, description="站点ID过滤"),
    member_id: Optional[str] = Query(None, description="会员ID或访客ID过滤"),
    keyword: Optional[str] = Query(None, description="搜索关键词（匹配标题或最后消息）"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[ChatSessionListResponse]:
    """
    获取会话列表

    支持按站点和会员过滤，支持关键词搜索，按更新时间倒序排列。
    """
    sessions, total = await ChatSessionService.list_sessions(
        db=db,
        site_id=site_id,
        member_id=member_id,
        keyword=keyword,
        page=page,
        size=size,
    )

    return ApiResponse.ok(
        data=ChatSessionListResponse(
            items=[ChatSessionResponse.model_validate(s) for s in sessions],
            total=total,
            page=page,
            size=size,
        )
    )


@router.get(
    "/sessions/{thread_id}",
    response_model=ApiResponse[ChatSessionResponse],
    operation_id="getChatSession",
)
async def get_session(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[ChatSessionResponse]:
    """
    获取会话详情

    返回会话元数据。如需获取完整消息历史，请调用 /chat/completions 或使用 LangGraph API。
    """
    session = await ChatSessionService.get_by_thread_id(db=db, thread_id=thread_id)

    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")

    return ApiResponse.ok(data=ChatSessionResponse.model_validate(session))


@router.get(
    "/sessions/{thread_id}/messages",
    response_model=ApiResponse[ChatSessionMessagesResponse],
    operation_id="getChatSessionMessages",
)
async def get_session_messages(
    thread_id: str,
) -> ApiResponse[ChatSessionMessagesResponse]:
    """
    获取单个会话的完整聊天历史信息

    从持久化 Checkpointer 中读取所有消息。
    """
    result = await ChatSessionService.get_session_messages(thread_id=thread_id)

    return ApiResponse.ok(
        data=ChatSessionMessagesResponse(
            thread_id=thread_id,
            messages=result["messages"],
            citations=result["citations"],
        )
    )


@router.delete(
    "/sessions/{thread_id}", response_model=ApiResponse[dict], operation_id="deleteChatSession"
)
async def delete_session(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """
    删除会话

    删除会话元数据记录，并同步删除 LangGraph Checkpointer 中的消息历史。
    """
    success = await ChatSessionService.delete_by_thread_id(db=db, thread_id=thread_id)

    if not success:
        raise HTTPException(status_code=404, detail="会话不存在")

    return ApiResponse.ok(data={"message": "会话已删除", "thread_id": thread_id})
