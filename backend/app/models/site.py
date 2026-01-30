from sqlalchemy import Column, Integer, String, Text, JSON

from app.models.base import BaseModel


class Site(BaseModel):
    """站点模型"""

    __tablename__ = "sites"

    name = Column(String(100), nullable=False, index=True, comment="站点名称")
    domain = Column(String(200), nullable=True, unique=True, comment="站点域名")
    description = Column(Text, nullable=True, comment="站点描述")
    icon = Column(String(50), nullable=True, comment="图标名称")
    status = Column(String(20), default="active", nullable=False, comment="状态: active(激活), disabled(禁用)")
    article_count = Column(Integer, default=0, nullable=False, comment="文章数量")
    theme_color = Column(String(50), nullable=True, default="blue", comment="主题色")
    layout_mode = Column(String(20), nullable=True, default="sidebar", comment="布局模式: sidebar, top")
    quick_questions = Column(JSON, nullable=True, comment="快速问题配置，JSON数组格式")
    bot_config = Column(JSON, nullable=True, comment="机器人配置，包含网页挂件、API等")

    def __repr__(self) -> str:
        return f"<Site(id={self.id}, name='{self.name}')>"

