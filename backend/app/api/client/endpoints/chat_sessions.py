"""Chat Sessions API - 会话管理端点"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.schemas.chat_session import (
    ChatSessionListResponse,
    ChatSessionResponse,
)
from app.services.chat_session_service import ChatSessionService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/sessions", response_model=ChatSessionListResponse, operation_id="listChatSessions")
async def list_sessions(
    site_id: Optional[int] = Query(None, description="站点ID过滤"),
    member_id: Optional[int] = Query(None, description="会员ID过滤"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: AsyncSession = Depends(get_db),
) -> ChatSessionListResponse:
    """
    获取会话列表
    
    支持按站点和会员过滤，按更新时间倒序排列。
    """
    sessions, total = await ChatSessionService.list_sessions(
        db=db,
        site_id=site_id,
        member_id=member_id,
        page=page,
        size=size,
    )
    
    return ChatSessionListResponse(
        items=[ChatSessionResponse.model_validate(s) for s in sessions],
        total=total,
        page=page,
        size=size,
    )


@router.get("/sessions/{thread_id}", response_model=ChatSessionResponse, operation_id="getChatSession")
async def get_session(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
) -> ChatSessionResponse:
    """
    获取会话详情
    
    返回会话元数据。如需获取完整消息历史，请调用 /chat/completions 或使用 LangGraph API。
    """
    session = await ChatSessionService.get_by_thread_id(db=db, thread_id=thread_id)
    
    if not session:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    return ChatSessionResponse.model_validate(session)


@router.delete("/sessions/{thread_id}", operation_id="deleteChatSession")
async def delete_session(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    删除会话
    
    删除会话元数据记录。注意：这不会删除 Checkpointer 中的消息历史。
    """
    success = await ChatSessionService.delete_by_thread_id(db=db, thread_id=thread_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="会话不存在")
    
    return {"message": "会话已删除", "thread_id": thread_id}
