"""Chat Session Model - 会话元数据表"""

from sqlalchemy import Column, ForeignKey, Integer, String, Text

from app.models.base import BaseModel


class ChatSession(BaseModel):
    """会话元数据模型
    
    存储会话的索引信息，与 LangGraph Checkpointer 配合使用：
    - ChatSession: 元数据/索引层（快速查询）
    - Checkpointer: 消息内容层（完整对话）
    
    两者通过 thread_id 关联。
    """
    
    __tablename__ = "chat_sessions"
    
    # 关联 Checkpointer 的 thread_id
    thread_id = Column(String(255), unique=True, nullable=False, index=True)
    
    # 站点隔离
    site_id = Column(Integer, nullable=False, index=True)
    
    # 用户关联（可选，支持匿名）
    member_id = Column(Integer, nullable=True, index=True)
    
    # 会话标题（通常取首条用户消息截取）
    title = Column(String(255), nullable=True)
    
    # 最后消息预览
    last_message = Column(Text, nullable=True)
    last_message_role = Column(String(20), nullable=True)  # 'user' / 'assistant'
    
    # 消息统计
    message_count = Column(Integer, default=0)
    
    def __repr__(self) -> str:
        return f"<ChatSession(id={self.id}, thread_id={self.thread_id}, site_id={self.site_id})>"
