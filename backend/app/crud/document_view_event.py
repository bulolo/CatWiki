"""文档浏览事件 CRUD 操作"""

from datetime import datetime, timezone

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
        ip_address: str | None = None,
        member_id: int | None = None,  # 预留：未来会员系统
        user_agent: str | None = None,
        referer: str | None = None,
    ) -> DocumentViewEvent:
        """记录一次文档浏览事件"""
        event = DocumentViewEvent(
            document_id=document_id,
            site_id=site_id,
            ip_address=ip_address,
            member_id=member_id,
            user_agent=user_agent,
            referer=referer,
        )
        db.add(event)
        await db.commit()
        await db.refresh(event)
        return event
    
    async def get_views_today(self, db: AsyncSession, *, site_id: int) -> int:
        """获取今日浏览总量"""
        now = datetime.now(timezone.utc)
        start_of_day = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        
        result = await db.execute(
            select(func.count(DocumentViewEvent.id)).where(
                DocumentViewEvent.site_id == site_id,
                DocumentViewEvent.viewed_at >= start_of_day,
            )
        )
        return result.scalar() or 0
    
    async def get_unique_ips_today(self, db: AsyncSession, *, site_id: int) -> int:
        """获取今日独立 IP 数"""
        now = datetime.now(timezone.utc)
        start_of_day = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        
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
        self, 
        db: AsyncSession, 
        *, 
        site_id: int, 
        days: int = 7
    ) -> list[dict]:
        """获取最近 N 天的浏览趋势"""
        from datetime import timedelta
        
        now = datetime.now(timezone.utc)
        trends = []
        
        for i in range(days - 1, -1, -1):
            day = now - timedelta(days=i)
            day_start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
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
            
            trends.append({
                "date": day_start.strftime("%m-%d"),
                "views": views_count,
                "unique_ips": ips_count,
            })
        
        return trends


crud_document_view_event = CRUDDocumentViewEvent()
