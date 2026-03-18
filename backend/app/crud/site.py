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

from __future__ import annotations

from typing import Any

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.site import Site
from app.schemas.site import SiteCreate, SiteUpdate


class CRUDSite(CRUDBase[Site, SiteCreate, SiteUpdate]):
    """站点 CRUD 操作（异步版本）"""

    def _apply_filters(self, query, status: str | None = None):
        """应用通用的过滤条件"""
        if status is not None:
            query = query.where(self.model.status == status)
        return query

    async def create(
        self, db: AsyncSession, *, obj_in: SiteCreate, auto_commit: bool = False
    ) -> Site:
        """创建站点（过滤掉非模型字段，并支持租户 ID 自动填充）"""
        from app.core.infra.tenant import get_current_tenant

        obj_in_data = obj_in.model_dump(exclude={"admin_email", "admin_name", "admin_password"})

        # 自动填充租户 ID
        if obj_in_data.get("tenant_id") is None:
            tenant_id = get_current_tenant()
            if tenant_id is not None:
                obj_in_data["tenant_id"] = tenant_id

        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        if auto_commit:
            await db.commit()
        else:
            await db.flush()
        await db.refresh(db_obj)

        # 清理缓存
        from app.core.infra.cache import get_cache

        cache = get_cache()
        await cache.delete(f"site:slug:{db_obj.slug}")
        await cache.delete(f"site:id:{db_obj.id}")

        return db_obj

    async def get(self, db: AsyncSession, id: Any) -> Site | None:
        """获取站点 (带缓存)"""
        from app.core.infra.cache import get_cache

        cache = get_cache()
        cache_key = f"site:id:{id}"

        async def _fetch():
            return await super(CRUDSite, self).get(db, id)

        return await cache.get_or_set(cache_key, _fetch, ttl=600)

    async def get_by_name(self, db: AsyncSession, *, name: str) -> Site | None:
        """根据名称获取站点"""
        result = await db.execute(select(self.model).where(self.model.name == name))
        return result.scalar_one_or_none()

    async def get_by_slug(self, db: AsyncSession, *, slug: str) -> Site | None:
        """根据标识获取站点 (带缓存)"""
        from app.core.infra.cache import get_cache

        cache = get_cache()
        cache_key = f"site:slug:{slug}"

        async def _fetch():
            result = await db.execute(select(self.model).where(self.model.slug == slug))
            return result.scalar_one_or_none()

        return await cache.get_or_set(cache_key, _fetch, ttl=600)

    async def get_by_api_token(self, db: AsyncSession, *, api_token: str) -> Site | None:
        """根据 API Token 获取站点 (查询 bot_config->api_bot->api_key)"""
        # 1. 使用 get_or_set 自动处理 缓存读取/数据库查询/回写逻辑
        from app.core.infra.cache import get_cache

        cache = get_cache()
        cache_key = f"site_by_token:{api_token}"

        async def _fetch_from_db():
            # 使用 func.json_extract_path_text 提取 JSON 文本值
            # 这种方式比 cast 更稳健，避免了不同 SQLAlchemy/Driver 版本生成的 SQL 语法不兼容问题 ([...])
            result = await db.execute(
                select(self.model).where(
                    func.json_extract_path_text(self.model.bot_config, "api_bot", "api_key")
                    == api_token,
                    func.json_extract_path_text(self.model.bot_config, "api_bot", "enabled")
                    == "true",
                )
            )
            return result.scalar_one_or_none()

        return await cache.get_or_set(cache_key, _fetch_from_db, ttl=3600)

    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: Site,
        obj_in: SiteUpdate | dict[str, Any],
        auto_commit: bool = False,
    ) -> Site:
        """更新站点 (重写以处理缓存失效)"""
        # 1. 获取旧的 API Key (用于清除缓存)
        old_api_key = None
        if db_obj.bot_config and "api_bot" in db_obj.bot_config:
            old_api_key = db_obj.bot_config["api_bot"].get("api_key")

        # 2. 执行更新
        updated_site = await super().update(
            db, db_obj=db_obj, obj_in=obj_in, auto_commit=auto_commit
        )

        # 3. 清理缓存
        from app.core.infra.cache import get_cache

        cache = get_cache()

        await cache.delete(f"site:id:{updated_site.id}")
        await cache.delete(f"site:slug:{updated_site.slug}")
        if old_api_key:
            await cache.delete(f"site_by_token:{old_api_key}")

        return updated_site

    async def get_with_tenant(self, db: AsyncSession, id: int) -> Site | None:
        """获取站点详情（预加载租户信息）"""
        from sqlalchemy.orm import joinedload

        result = await db.execute(
            select(self.model).where(self.model.id == id).options(joinedload(self.model.tenant))
        )
        return result.scalar_one_or_none()

    async def get_by_slug_with_tenant(self, db: AsyncSession, slug: str) -> Site | None:
        """根据标识获取站点（预加载租户信息）"""
        from sqlalchemy.orm import joinedload

        result = await db.execute(
            select(self.model).where(self.model.slug == slug).options(joinedload(self.model.tenant))
        )
        return result.scalar_one_or_none()

    async def list_with_tenant(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        status: str | None = None,
    ) -> list[Site]:
        """获取站点列表（预加载租户信息）"""
        from sqlalchemy.orm import joinedload

        stmt = select(self.model).options(joinedload(self.model.tenant))
        if status:
            stmt = stmt.where(self.model.status == status)

        stmt = stmt.offset(skip).limit(limit).order_by(self.model.id.desc())
        result = await db.execute(stmt)
        return list(result.scalars())

    async def increment_article_count(
        self, db: AsyncSession, *, site_id: int, auto_commit: bool = False
    ) -> None:
        """原子增加文章计数（支持租户隔离）"""
        from app.core.infra.tenant import get_current_tenant

        tenant_id = get_current_tenant()
        stmt = update(Site).where(Site.id == site_id)
        if tenant_id is not None:
            stmt = stmt.where(Site.tenant_id == tenant_id)

        await db.execute(stmt.values(article_count=Site.article_count + 1))
        if auto_commit:
            await db.commit()

    async def decrement_article_count(
        self, db: AsyncSession, *, site_id: int, auto_commit: bool = False
    ) -> None:
        """原子减少文章计数（支持租户隔离）"""
        from app.core.infra.tenant import get_current_tenant

        tenant_id = get_current_tenant()
        stmt = update(Site).where(Site.id == site_id).where(Site.article_count > 0)
        if tenant_id is not None:
            stmt = stmt.where(Site.tenant_id == tenant_id)

        await db.execute(stmt.values(article_count=Site.article_count - 1))
        if auto_commit:
            await db.commit()

    async def remove_with_relationships(
        self, db: AsyncSession, *, id: int, auto_commit: bool = False
    ) -> bool:
        """删除站点及其所有关联数据（高性能批量删除，支持租户隔离）"""
        from app.core.infra.tenant import get_current_tenant
        from app.models.collection import Collection
        from app.models.document import Document

        tenant_id = get_current_tenant()

        # 1. 查找站点（会自动应用拦截器过滤）
        site = await self.get(db, id=id)
        if not site:
            return False

        # 2. 批量删除文档
        doc_del = delete(Document).where(Document.site_id == id)
        if tenant_id is not None:
            doc_del = doc_del.where(Document.tenant_id == tenant_id)
        await db.execute(doc_del)

        # 3. 批量删除合集
        coll_del = delete(Collection).where(Collection.site_id == id)
        if tenant_id is not None:
            coll_del = coll_del.where(Collection.tenant_id == tenant_id)
        await db.execute(coll_del)

        # 4. 清理向量库数据
        try:
            from app.core.vector.vector_store import VectorStoreManager

            vector_mgr = await VectorStoreManager.get_instance()
            await vector_mgr.delete_by_metadata("site_id", id)

            from app.core.infra.logging import logger

            logger.info(f"✅ [Cleanup] 已成功清理站点 {id} 的向量数据")
        except Exception as e:
            from app.core.infra.logging import logger

            logger.warning(f"⚠️ [Cleanup] 站点 {id} 向量清理失败: {e}")

        # 5. 删除站点
        await db.delete(site)
        if auto_commit:
            await db.commit()
        else:
            await db.flush()

        # 6. 清理缓存
        from app.core.infra.cache import get_cache

        cache = get_cache()
        await cache.delete(f"site:id:{id}")
        await cache.delete(f"site:slug:{site.slug}")
        if site.bot_config and "api_bot" in site.bot_config:
            k = site.bot_config["api_bot"].get("api_key")
            if k:
                await cache.delete(f"site_by_token:{k}")

        return True

    async def list_active(
        self,
        db: AsyncSession,
        *,
        page: int,
        size: int,
        tenant_id: int | None = None,
        tenant_slug: str | None = None,
        keyword: str | None = None,
    ) -> tuple[list[Site], int]:
        """获取激活的站点列表（下沉自 Service 层）"""
        from sqlalchemy import func, or_, select
        from sqlalchemy.orm import joinedload

        from app.core.common.utils import Paginator

        # 构建基础查询条件
        base_filters = [self.model.status == "active"]

        if tenant_id is not None:
            base_filters.append(self.model.tenant_id == tenant_id)
        elif tenant_slug:
            from app.models.tenant import Tenant

            # 这是一个跨表查询，下沉到 CRUD 层处理更合适
            stmt_tenant = select(Tenant.id).where(Tenant.slug == tenant_slug)
            tenant_id_res = (await db.execute(stmt_tenant)).scalar_one_or_none()
            if tenant_id_res:
                base_filters.append(self.model.tenant_id == tenant_id_res)
            else:
                return [], 0

        if keyword:
            base_filters.append(
                or_(
                    self.model.name.icontains(keyword),
                    self.model.description.icontains(keyword),
                )
            )

        # 统计总数
        count_stmt = select(func.count()).select_from(self.model).where(*base_filters)
        total = (await db.execute(count_stmt)).scalar_one()

        paginator = Paginator(page=page, size=size, total=total)

        # 查询列表
        from app.models.document_view_event import DocumentViewEvent

        # 统计浏览量的子查询
        view_count_subquery = (
            select(func.count(DocumentViewEvent.id))
            .where(DocumentViewEvent.site_id == self.model.id)
            .scalar_subquery()
            .label("view_count")
        )

        stmt = (
            select(self.model, view_count_subquery)
            .where(*base_filters)
            .options(joinedload(self.model.tenant))
        )
        result = await db.execute(stmt.offset(paginator.skip).limit(paginator.size))

        sites = []
        for row in result:
            site_obj = row[0]
            # 手动将统计结果注入对象，以便 Pydantic 导出
            setattr(site_obj, "view_count", row[1] or 0)
            sites.append(site_obj)

        return sites, total

    async def get_active(
        self, db: AsyncSession, *, site_id: int | None = None, slug: str | None = None
    ) -> Site | None:
        """获取单个激活的站点详情 (带缓存)"""
        from app.core.infra.cache import get_cache

        cache = get_cache()

        target = f"id:{site_id}" if site_id else f"slug:{slug}"
        cache_key = f"site:active:{target}"

        async def _fetch():
            from sqlalchemy import select
            from sqlalchemy.orm import joinedload

            if site_id:
                stmt = select(self.model).where(self.model.id == site_id)
            else:
                stmt = select(self.model).where(self.model.slug == slug)

            stmt = stmt.where(self.model.status == "active").options(joinedload(self.model.tenant))
            result = await db.execute(stmt)
            return result.scalar_one_or_none()

        return await cache.get_or_set(cache_key, _fetch, ttl=600)


crud_site = CRUDSite(Site)
