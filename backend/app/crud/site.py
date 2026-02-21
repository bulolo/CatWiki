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

from sqlalchemy import delete, select, update, func, cast, String
from sqlalchemy.dialects.postgresql import JSONB
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

    async def create(self, db: AsyncSession, *, obj_in: SiteCreate) -> Site:
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
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    async def get_by_name(self, db: AsyncSession, *, name: str) -> Site | None:
        """根据名称获取站点"""
        result = await db.execute(select(self.model).where(self.model.name == name))
        return result.scalar_one_or_none()

    async def get_by_slug(self, db: AsyncSession, *, slug: str) -> Site | None:
        """根据标识获取站点"""
        result = await db.execute(select(self.model).where(self.model.slug == slug))
        return result.scalar_one_or_none()

    async def get_by_api_token(self, db: AsyncSession, *, api_token: str) -> Site | None:
        """根据 API Token 获取站点 (查询 bot_config->apiBot->apiKey)"""
        # 1. 尝试从缓存获取
        # TODO: 未来考虑使用 Redis 替代内存缓存，以支持多实例部署和防止容器重启导致缓存失效
        from app.core.infra.cache import get_cache

        cache = get_cache()
        cache_key = f"site_by_token:{api_token}"

        cached_site = cache.get(cache_key)
        if cached_site:
            return cached_site

        # 2. 从数据库查询
        # 使用 func.json_extract_path_text 提取 JSON 文本值
        # 这种方式比 cast 更稳健，避免了不同 SQLAlchemy/Driver 版本生成的 SQL 语法不兼容问题 ([...])
        result = await db.execute(
            select(self.model).where(
                func.json_extract_path_text(self.model.bot_config, "apiBot", "apiKey") == api_token,
                func.json_extract_path_text(self.model.bot_config, "apiBot", "enabled") == "true",
            )
        )
        site = result.scalar_one_or_none()

        # 3. 写入缓存 (有效期 1 小时)
        if site:
            cache.set(cache_key, site, ttl=3600)

        return site

    async def update(
        self, db: AsyncSession, *, db_obj: Site, obj_in: SiteUpdate | dict[str, Any]
    ) -> Site:
        """更新站点 (重写以处理缓存失效)"""
        # 1. 获取旧的 API Key (用于清除缓存)
        old_api_key = None
        if db_obj.bot_config and "apiBot" in db_obj.bot_config:
            old_api_key = db_obj.bot_config["apiBot"].get("apiKey")

        # 2. 执行更新
        updated_site = await super().update(db, db_obj=db_obj, obj_in=obj_in)

        # 3. 清除旧 Key 的缓存
        # 无论是 Key 变了，还是 Site 其他信息变了，都需要清除旧 Key 指向的缓存，
        # 也就是让下一次请求强制刷新
        if old_api_key:
            from app.core.infra.cache import get_cache

            cache = get_cache()
            cache_key = f"site_by_token:{old_api_key}"
            cache.delete(cache_key)

        # 4. 如果 Key 更新了，新 Key 自然没有缓存，无需处理

        return updated_site

    async def increment_article_count(self, db: AsyncSession, *, site_id: int) -> None:
        """原子增加文章计数（支持租户隔离）"""
        from app.core.infra.tenant import get_current_tenant

        tenant_id = get_current_tenant()
        stmt = update(Site).where(Site.id == site_id)
        if tenant_id is not None:
            stmt = stmt.where(Site.tenant_id == tenant_id)

        await db.execute(stmt.values(article_count=Site.article_count + 1))
        await db.commit()

    async def decrement_article_count(self, db: AsyncSession, *, site_id: int) -> None:
        """原子减少文章计数（支持租户隔离）"""
        from app.core.infra.tenant import get_current_tenant

        tenant_id = get_current_tenant()
        stmt = update(Site).where(Site.id == site_id).where(Site.article_count > 0)
        if tenant_id is not None:
            stmt = stmt.where(Site.tenant_id == tenant_id)

        await db.execute(stmt.values(article_count=Site.article_count - 1))
        await db.commit()

    async def remove_with_relationships(self, db: AsyncSession, *, id: int) -> bool:
        """删除站点及其所有关联数据（高性能批量删除，支持租户隔离）"""
        from app.models.collection import Collection
        from app.models.document import Document
        from app.core.infra.tenant import get_current_tenant

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

        # 4. 删除站点
        await db.delete(site)

        await db.commit()
        return True


crud_site = CRUDSite(Site)
