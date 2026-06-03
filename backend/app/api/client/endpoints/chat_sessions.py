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

"""Chat Sessions API - 会话管理端点"""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.common.i18n import _
from app.schemas.chat_session import (
    ChatSessionListResponse,
    ChatSessionMessagesResponse,
    ChatSessionResponse,
)
from app.schemas.response import ApiResponse
from app.services.chat import (
    ChatHistoryService,
    ChatSessionService,
    get_chat_history_service,
    get_chat_session_service,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get(
    "/sessions",
    response_model=ApiResponse[ChatSessionListResponse],
    operation_id="listChatSessions",
)
async def list_sessions(
    member_id: str = Query(..., min_length=1, description="访客ID（必填，仅返回该访客的会话）"),
    site_id: int | None = Query(None, description="站点ID过滤"),
    keyword: str | None = Query(None, description="搜索关键词（匹配标题或最后消息）"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    is_pager: int = Query(1, description="是否分页，0=返回全部，1=分页"),
    service: ChatSessionService = Depends(get_chat_session_service),
) -> ApiResponse[ChatSessionListResponse]:
    """
    获取会话列表

    member_id 为必填，仅返回该访客自己的会话。站点级全量审计请使用 Admin API。
    """

    sessions, paginator = await service.list_sessions(
        site_id=site_id,
        member_id=member_id,
        keyword=keyword,
        page=page,
        size=size,
        is_pager=is_pager,
    )

    return ApiResponse.ok(
        data=ChatSessionListResponse(
            list=[ChatSessionResponse.model_validate(s) for s in sessions],
            total=paginator.total,
            page=paginator.page,
            size=paginator.size,
        )
    )


@router.get(
    "/sessions/{thread_id}",
    response_model=ApiResponse[ChatSessionResponse],
    operation_id="getChatSession",
)
async def get_session(
    thread_id: str,
    member_id: str = Query(..., min_length=1, description="访客ID，验证会话所有权"),
    site_id: int | None = Query(None, description="站点ID，验证会话所属站点"),
    service: ChatSessionService = Depends(get_chat_session_service),
) -> ApiResponse[ChatSessionResponse]:
    """
    获取会话详情

    返回会话元数据。如需获取完整消息历史，请调用 GET /chat/sessions/{thread_id}/messages。
    """
    session = await service.get_session_for_access(
        thread_id=thread_id,
        member_id=member_id,
        site_id=site_id,
    )

    if not session:
        raise HTTPException(status_code=404, detail=_("session.not_found"))

    return ApiResponse.ok(data=ChatSessionResponse.model_validate(session))


@router.get(
    "/sessions/{thread_id}/messages",
    response_model=ApiResponse[ChatSessionMessagesResponse],
    operation_id="getChatSessionMessages",
)
async def get_session_messages(
    thread_id: str,
    member_id: str = Query(..., min_length=1, description="访客ID，验证会话所有权"),
    site_id: int | None = Query(None, description="站点ID，验证会话所属站点"),
    history_service: ChatHistoryService = Depends(get_chat_history_service),
    session_service: ChatSessionService = Depends(get_chat_session_service),
) -> ApiResponse[ChatSessionMessagesResponse]:
    """
    获取单个会话的完整聊天历史信息

    从数据库全量历史表中读取所有消息。
    """
    session = await session_service.get_session_for_access(
        thread_id=thread_id,
        member_id=member_id,
        site_id=site_id,
    )
    if not session:
        raise HTTPException(status_code=404, detail=_("session.not_found"))

    result = await history_service.get_chat_history(thread_id=thread_id)

    return ApiResponse.ok(
        data=ChatSessionMessagesResponse(
            thread_id=thread_id,
            messages=result["messages"],
        )
    )


@router.get(
    "/sessions/{thread_id}/tool-result/{tool_call_id}",
    response_model=ApiResponse[dict],
    operation_id="getChatToolResult",
)
async def get_tool_result(
    thread_id: str,
    tool_call_id: str,
    member_id: str = Query(..., min_length=1, description="访客ID，验证会话所有权"),
    site_id: int | None = Query(None, description="站点ID，验证会话所属站点"),
    history_service: ChatHistoryService = Depends(get_chat_history_service),
    session_service: ChatSessionService = Depends(get_chat_session_service),
) -> ApiResponse[dict]:
    """
    获取单个工具调用的检索结果

    根据 tool_call_id 查找对应的 tool 消息内容。
    """
    session = await session_service.get_session_for_access(
        thread_id=thread_id,
        member_id=member_id,
        site_id=site_id,
    )
    if not session:
        raise HTTPException(status_code=404, detail=_("session.not_found"))

    result = await history_service.get_tool_result(thread_id=thread_id, tool_call_id=tool_call_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Tool result not found")
    return ApiResponse.ok(data={"tool_call_id": tool_call_id, "content": result})


@router.delete(
    "/sessions",
    response_model=ApiResponse[dict],
    operation_id="clearAllChatSessions",
)
async def clear_all_sessions(
    member_id: str = Query(..., min_length=1, description="访客ID，仅删除该访客的会话"),
    site_id: int | None = Query(None, description="站点ID，限定删除范围"),
    service: ChatSessionService = Depends(get_chat_session_service),
) -> ApiResponse[dict]:
    """
    清空指定访客的全部会话

    删除该访客在指定站点（或全局）下的所有会话及 LangGraph checkpoints。
    """
    count = await service.delete_all_sessions_by_member(
        member_id=member_id,
        site_id=site_id,
    )
    return ApiResponse.ok(data={"message": "全部会话已删除", "deleted": count})


@router.delete(
    "/sessions/{thread_id}", response_model=ApiResponse[dict], operation_id="deleteChatSession"
)
async def delete_session(
    thread_id: str,
    member_id: str = Query(..., min_length=1, description="访客ID，验证会话所有权"),
    site_id: int | None = Query(None, description="站点ID，验证会话所属站点"),
    service: ChatSessionService = Depends(get_chat_session_service),
) -> ApiResponse[dict]:
    """
    删除会话

    删除会话元数据记录，并同步删除 LangGraph Checkpointer 中的消息历史。
    仅允许删除自己（member_id 匹配）的会话。
    """
    session = await service.get_session_for_access(
        thread_id=thread_id, member_id=member_id, site_id=site_id
    )

    if not session:
        raise HTTPException(status_code=404, detail=_("session.not_found"))

    await service.delete_session_by_thread_id(
        thread_id=thread_id, member_id=member_id, site_id=site_id
    )
    return ApiResponse.ok(data={"message": "会话已删除", "thread_id": thread_id})
