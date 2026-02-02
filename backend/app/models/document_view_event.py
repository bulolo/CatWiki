"""文档浏览事件模型"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class DocumentViewEvent(Base):
    """文档浏览事件日志
    
    记录每次文档访问的详细信息，用于统计今日浏览量、独立访客等指标。
    """
    __tablename__ = "document_view_events"
    
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    
    # 外键关联
    document_id: Mapped[int] = mapped_column(
        ForeignKey("document.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    site_id: Mapped[int] = mapped_column(
        ForeignKey("sites.id", ondelete="CASCADE"), 
        nullable=False
    )
    
    # 浏览时间
    viewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(),
        nullable=False
    )
    
    # 访客信息
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)  # 支持 IPv6
    member_id: Mapped[int | None] = mapped_column(nullable=True, index=True)  # 预留：未来会员系统
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    referer: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # 创建时间
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now(),
        nullable=False
    )
    
    # 复合索引：按站点和时间查询
    __table_args__ = (
        Index("idx_view_events_site_date", "site_id", "viewed_at"),
        Index("idx_view_events_doc_date", "document_id", "viewed_at"),
    )
    
    # 关联关系（可选）
    # document = relationship("Document", back_populates="view_events")
