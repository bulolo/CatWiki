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


import logging
from typing import Any

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.tenant import Tenant
from app.schemas.tenant import TenantCreate, TenantUpdate

logger = logging.getLogger(__name__)


class CRUDTenant(CRUDBase[Tenant, TenantCreate, TenantUpdate]):
    """租户 CRUD 操作"""

    def _apply_filters(self, query: Select, **kwargs) -> Select:
        keyword = kwargs.get("keyword")
        if keyword:
            from sqlalchemy import or_

            query = query.where(
                or_(
                    Tenant.name.ilike(f"%{keyword}%"),
                    Tenant.slug.ilike(f"%{keyword}%"),
                )
            )
        return super()._apply_filters(query, **kwargs)

    async def get(self, db: AsyncSession, id: Any) -> Tenant | None:
        """获取租户 (带缓存)"""

        async def _fetch():
            return await super(CRUDTenant, self).get(db, id)

        return await self._cached_get(db, f"tenant:id:{id}", _fetch, ttl=3600)

    async def get_by_slug(self, db: AsyncSession, *, slug: str) -> Tenant | None:
        """根据 slug 获取租户 (带缓存)"""

        async def _fetch():
            result = await db.execute(select(Tenant).where(Tenant.slug == slug))
            return result.scalar_one_or_none()

        return await self._cached_get(db, f"tenant:slug:{slug}", _fetch, ttl=3600)

    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: Tenant,
        obj_in: TenantUpdate | dict[str, Any],
        auto_commit: bool = False,
    ) -> Tenant:
        """更新租户 (带缓存失效)"""
        tenant = await super().update(db, db_obj=db_obj, obj_in=obj_in, auto_commit=auto_commit)

        from app.core.infra.cache import get_cache

        cache = get_cache()
        await cache.delete(f"tenant:id:{tenant.id}")
        await cache.delete(f"tenant:slug:{tenant.slug}")
        return tenant

    async def remove(self, db: AsyncSession, *, id: int) -> Tenant:
        """删除租户并清理相关向量数据及缓存"""
        # 先获取旧数据用于清理缓存键
        tenant = await self.get(db, id=id)

        # 1. 清理该租户下所有站点的向量数据
        try:
            from app.core.vector.vector_store import VectorStoreManager

            vector_mgr = await VectorStoreManager.get_instance()
            await vector_mgr.delete_by_metadata("tenant_id", id)
        except Exception as e:
            logger.warning(f"⚠️ [Cleanup] 租户 {id} 向量清理失败: {e}")

        # 2. 执行数据库删除
        tenant = await super().delete(db, id=id)

        # 3. 清理缓存
        if tenant:
            from app.core.infra.cache import get_cache

            cache = get_cache()
            await cache.delete(f"tenant:id:{tenant.id}")
            await cache.delete(f"tenant:slug:{tenant.slug}")
            # 同时清理该租户相关的配置缓存
            await cache.delete_by_prefix(f"config:tenant:{tenant.id}")

        return tenant


crud_tenant = CRUDTenant(Tenant)
