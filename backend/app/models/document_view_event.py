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
    tenant_id: Mapped[int] = mapped_column(nullable=False, index=True)
    document_id: Mapped[int] = mapped_column(
        ForeignKey("document.id", ondelete="CASCADE"), nullable=False, index=True
    )
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"), nullable=False)

    # 浏览时间
    viewed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # 访客信息
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)  # 支持 IPv6
    member_id: Mapped[int | None] = mapped_column(nullable=True, index=True)  # 预留：未来会员系统
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    referer: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 创建时间
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # 复合索引：按租户、站点和时间查询
    __table_args__ = (
        Index("idx_view_events_tenant_site_date", "tenant_id", "site_id", "viewed_at"),
        Index("idx_view_events_tenant_doc_date", "tenant_id", "document_id", "viewed_at"),
    )

    # 关联关系（可选）
    # document = relationship("Document", back_populates="view_events")
