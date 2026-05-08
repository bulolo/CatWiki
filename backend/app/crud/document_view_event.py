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

"""文档浏览事件 CRUD 操作"""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document_view_event import DocumentViewEvent


class CRUDDocumentViewEvent:
    """文档浏览事件 CRUD 操作"""

    async def create(
        self,
        db: AsyncSession,
        *,
        document_id: int,
        site_id: int,
        tenant_id: int | None = None,  # 保留参数以兼容手动设置
        ip_address: str | None = None,
        member_id: int | None = None,  # 预留：未来会员系统
        user_agent: str | None = None,
        referer: str | None = None,
        auto_commit: bool = False,
        background_tasks: Any = None,  # 新增：FastAPI BackgroundTasks
    ) -> DocumentViewEvent:
        """记录一次文档浏览事件（支持租户 ID 自动填充）"""

        # 如果有后台任务且有 IP，则先设为 None，由后台异步回填
        location = None
        should_background = background_tasks and ip_address

        if not should_background and ip_address:
            # 兼容模式：如果没有后台任务，则实时解析
            from app.core.common.ip_utils import get_ip_location

            location = get_ip_location(ip_address)

        event = DocumentViewEvent(
            document_id=document_id,
            site_id=site_id,
            tenant_id=tenant_id,
            ip_address=ip_address,
            location=location,
            member_id=member_id,
            user_agent=user_agent,
            referer=referer,
        )
        db.add(event)

        # 必须 Flush 以获取自增 ID
        if auto_commit:
            await db.commit()
            await db.refresh(event)
        else:
            await db.flush()

        # 如果开启了后台任务，则注册它
        if should_background:
            from app.core.common.ip_utils import update_event_location_task

            background_tasks.add_task(update_event_location_task, event.id, ip_address)

        return event

    async def get_views_today(self, db: AsyncSession, *, site_id: int) -> int:
        """获取今日浏览总量"""
        now = datetime.now(UTC)
        start_of_day = datetime(now.year, now.month, now.day, tzinfo=UTC)

        result = await db.execute(
            select(func.count(DocumentViewEvent.id)).where(
                DocumentViewEvent.site_id == site_id,
                DocumentViewEvent.viewed_at >= start_of_day,
            )
        )
        return result.scalar() or 0

    async def get_unique_ips_today(self, db: AsyncSession, *, site_id: int) -> int:
        """获取今日独立 IP 数"""
        now = datetime.now(UTC)
        start_of_day = datetime(now.year, now.month, now.day, tzinfo=UTC)

        result = await db.execute(
            select(func.count(func.distinct(DocumentViewEvent.ip_address))).where(
                DocumentViewEvent.site_id == site_id,
                DocumentViewEvent.viewed_at >= start_of_day,
                DocumentViewEvent.ip_address.isnot(None),
            )
        )
        return result.scalar() or 0

    async def get_total_unique_ips(self, db: AsyncSession, *, site_id: int) -> int:
        """获取历史独立 IP 总数"""
        result = await db.execute(
            select(func.count(func.distinct(DocumentViewEvent.ip_address))).where(
                DocumentViewEvent.site_id == site_id,
                DocumentViewEvent.ip_address.isnot(None),
            )
        )
        return result.scalar() or 0

    async def get_daily_view_trends(
        self, db: AsyncSession, *, site_id: int, days: int = 7
    ) -> list[dict]:
        """获取最近 N 天的浏览趋势"""
        from datetime import timedelta

        now = datetime.now(UTC)
        trends = []

        for i in range(days - 1, -1, -1):
            day = now - timedelta(days=i)
            day_start = datetime(day.year, day.month, day.day, tzinfo=UTC)
            day_end = day_start + timedelta(days=1)

            # 当日浏览量
            views_result = await db.execute(
                select(func.count(DocumentViewEvent.id)).where(
                    DocumentViewEvent.site_id == site_id,
                    DocumentViewEvent.viewed_at >= day_start,
                    DocumentViewEvent.viewed_at < day_end,
                )
            )
            views_count = views_result.scalar() or 0

            # 当日独立 IP
            ips_result = await db.execute(
                select(func.count(func.distinct(DocumentViewEvent.ip_address))).where(
                    DocumentViewEvent.site_id == site_id,
                    DocumentViewEvent.viewed_at >= day_start,
                    DocumentViewEvent.viewed_at < day_end,
                    DocumentViewEvent.ip_address.isnot(None),
                )
            )
            ips_count = ips_result.scalar() or 0

            trends.append(
                {
                    "date": day_start.strftime("%m-%d"),
                    "views": views_count,
                    "unique_ips": ips_count,
                }
            )

        return trends

    async def get_hourly_distribution(
        self, db: AsyncSession, *, site_id: int, days: int = 7
    ) -> list[dict]:
        """获取最近 N 天的小时分布"""
        from datetime import timedelta

        start = datetime.now(UTC) - timedelta(days=days)
        result = await db.execute(
            select(
                func.extract("hour", DocumentViewEvent.viewed_at).label("hour"),
                func.count(DocumentViewEvent.id).label("count"),
            )
            .where(DocumentViewEvent.site_id == site_id, DocumentViewEvent.viewed_at >= start)
            .group_by("hour")
            .order_by("hour")
        )
        hour_map = {int(r.hour): r.count for r in result}
        return [{"hour": h, "count": hour_map.get(h, 0)} for h in range(24)]

    async def get_top_documents(
        self, db: AsyncSession, *, site_id: int, days: int = 7, limit: int = 10
    ) -> list[dict]:
        """获取最近 N 天的热门文档"""
        from datetime import timedelta

        from app.models.document import Document

        start = datetime.now(UTC) - timedelta(days=days)
        result = await db.execute(
            select(
                DocumentViewEvent.document_id,
                Document.title,
                func.count(DocumentViewEvent.id).label("views"),
                func.count(func.distinct(DocumentViewEvent.ip_address)).label("unique_visitors"),
            )
            .join(Document, Document.id == DocumentViewEvent.document_id)
            .where(DocumentViewEvent.site_id == site_id, DocumentViewEvent.viewed_at >= start)
            .group_by(DocumentViewEvent.document_id, Document.title)
            .order_by(func.count(DocumentViewEvent.id).desc())
            .limit(limit)
        )
        return [
            {
                "document_id": r.document_id,
                "title": r.title,
                "views": r.views,
                "unique_visitors": r.unique_visitors,
            }
            for r in result
        ]

    async def get_visitor_stats(
        self, db: AsyncSession, *, site_id: int, days: int = 7, limit: int = 10
    ) -> list[dict]:
        """获取最近 N 天的访客 IP 排名（EE 版使用）"""
        from datetime import timedelta

        start = datetime.now(UTC) - timedelta(days=days)
        result = await db.execute(
            select(
                DocumentViewEvent.ip_address,
                func.count(DocumentViewEvent.id).label("views"),
                func.max(DocumentViewEvent.viewed_at).label("last_active"),
                func.max(DocumentViewEvent.location).label("location"),
            )
            .where(
                DocumentViewEvent.site_id == site_id,
                DocumentViewEvent.viewed_at >= start,
                DocumentViewEvent.ip_address.isnot(None),
            )
            .group_by(DocumentViewEvent.ip_address)
            .order_by(func.count(DocumentViewEvent.id).desc())
            .limit(limit)
        )
        rows = result.all()

        return [
            {
                "ip": r.ip_address,
                "views": r.views,
                "last_active": r.last_active,
                "location": r.location or "未知位置",
            }
            for r in rows
        ]

    async def get_region_stats(
        self, db: AsyncSession, *, site_id: int, days: int = 7
    ) -> list[dict]:
        """获取按区域划分的 UV 统计（EE 版，直接 SQL 聚合）"""
        from datetime import timedelta

        start = datetime.now(UTC) - timedelta(days=days)

        # 统计逻辑：按 location 聚合，计算去重后的 IP 数量 (UV)
        result = await db.execute(
            select(
                DocumentViewEvent.location,
                func.count(func.distinct(DocumentViewEvent.ip_address)).label("count"),
            )
            .where(
                DocumentViewEvent.site_id == site_id,
                DocumentViewEvent.viewed_at >= start,
                DocumentViewEvent.location.isnot(None),
            )
            .group_by(DocumentViewEvent.location)
            .order_by(func.count(func.distinct(DocumentViewEvent.ip_address)).desc())
        )
        rows = result.all()

        # 进一步按“省份”清理聚合（因为数据库存的是 "省 城市"，我们报表可能只需要省）
        # 这里在内存中做最终合并
        province_map: dict[str, int] = {}
        for r in rows:
            loc = r.location
            province = loc.split(" ")[0] if " " in loc else loc
            province_map[province] = province_map.get(province, 0) + r.count

        return sorted(
            [{"region": k, "count": v} for k, v in province_map.items()],
            key=lambda x: x["count"],
            reverse=True,
        )

    async def get_referer_stats(
        self, db: AsyncSession, *, site_id: int, days: int = 7
    ) -> list[dict]:
        """获取最近 N 天的流量来源分布"""
        from datetime import timedelta
        from urllib.parse import urlparse

        start = datetime.now(UTC) - timedelta(days=days)
        result = await db.execute(
            select(DocumentViewEvent.referer).where(
                DocumentViewEvent.site_id == site_id, DocumentViewEvent.viewed_at >= start
            )
        )
        sources: dict[str, int] = {}
        for (referer,) in result:
            if not referer:
                key = "direct"
            else:
                try:
                    domain = urlparse(referer).netloc or "direct"
                    key = domain
                except Exception:
                    key = "other"
            sources[key] = sources.get(key, 0) + 1
        sorted_sources = sorted(sources.items(), key=lambda x: x[1], reverse=True)
        return [{"source": k, "count": v} for k, v in sorted_sources[:20]]


crud_document_view_event = CRUDDocumentViewEvent()
