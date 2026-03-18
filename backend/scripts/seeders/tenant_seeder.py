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

"""
Tenant Seeder - 通用租户数据播种器
"""

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import select

from app.core.common.reading_time import calculate_reading_time
from app.core.infra.config import (
    AI_CHAT_CONFIG_KEY,
    AI_EMBEDDING_CONFIG_KEY,
    AI_RERANK_CONFIG_KEY,
    AI_VL_CONFIG_KEY,
)
from app.crud.collection import crud_collection
from app.crud.document import crud_document
from app.crud.site import crud_site
from app.crud.system_config import crud_system_config
from app.crud.tenant import crud_tenant
from app.crud.user import crud_user
from app.models.collection import Collection
from app.models.document import Document
from app.models.user import UserRole, UserStatus
from app.schemas.collection import CollectionCreate
from app.schemas.document import DocumentCreate
from app.schemas.site import SiteCreate
from app.schemas.tenant import TenantCreate
from app.schemas.user import UserCreate
from scripts.seeders.base_seeder import BaseSeeder


class TenantSeeder(BaseSeeder):
    """通用租户数据播种器 (支持多个合集)"""

    def __init__(self, db, data_path: str):
        super().__init__(db)
        self.data_path = Path(data_path)
        if not self.data_path.exists():
            # Try finding it relative to project root/backend
            possible_path = Path.cwd() / data_path
            if possible_path.exists():
                self.data_path = possible_path
            else:
                # Try finding it relative to this file
                possible_path = Path(__file__).parent.parent / "data" / Path(data_path).name
                if possible_path.exists():
                    self.data_path = possible_path
                else:
                    raise FileNotFoundError(f"Data file not found: {data_path}")

        # 加载数据
        with open(self.data_path, encoding="utf-8") as f:
            self.data = json.load(f)

    async def run(self):
        """执行播种"""
        tenant_data = self.data["tenant"]
        tenant_slug = tenant_data["slug"]
        tenant_name = tenant_data["name"]

        # [✨ 优化] 整体幂等性检查：如果该租户（通过 slug 识别）已存在，则跳过整个播种逻辑
        # 这样可以从源头上防止项目重启时 init.py 重新执行导致用户在界面上修改的配置、文档等被覆盖
        existing_tenant = await crud_tenant.get_by_slug(self.db, slug=tenant_slug)
        if existing_tenant:
            await self.log(
                f"ℹ️ 组织空间 '{tenant_name}' ({tenant_slug}) 已存在，跳过播种流程以保护现有配置和数据。"
            )
            return

        await self.log(f"🚀 开始初始化 {tenant_name} 数据...")

        tenant = await self.create_tenant()
        await self.init_ai_configs(tenant.id)
        site = await self.create_site(tenant.id)
        await self.create_admin(tenant.id, [site.id])
        await self.init_documents(tenant.id, site.id)

        await self.log(f"✨ {tenant_name} 数据初始化完成！")

    async def create_tenant(self):
        """创建租户"""
        t_data = self.data["tenant"]
        tenant = await crud_tenant.get_by_slug(self.db, slug=t_data["slug"])

        if not tenant:
            tenant_in = TenantCreate(
                name=t_data["name"],
                slug=t_data["slug"],
                description=t_data["description"],
                plan=t_data["plan"],
                plan_expires_at=datetime.now(UTC) + timedelta(days=365),
                status=t_data["status"],
                platform_resources_allowed=t_data.get("platform_resources_allowed", []),
            )
            tenant = await crud_tenant.create(self.db, obj_in=tenant_in)
            await self.log(f"✅ 创建组织空间：{tenant.name}")
        else:
            await self.log(f"✅ 组织空间已存在：{tenant.name}")
        return tenant

    async def create_admin(self, tenant_id: int, managed_site_ids: list[int]):
        """创建管理员"""
        u_data = self.data["admin"]
        user = await crud_user.get_by_email(self.db, email=u_data["email"])

        if not user:
            user_in = UserCreate(
                name=u_data["name"],
                email=u_data["email"],
                password=u_data["password"],
                role=UserRole(u_data.get("role", "tenant_admin")),
                status=UserStatus(u_data.get("status", "active")),
                tenant_id=tenant_id,
                managed_site_ids=managed_site_ids,
            )
            user = await crud_user.create(self.db, obj_in=user_in)
            await self.log(f"✅ 创建管理员：{user.email}")
        else:
            await self.log(f"✅ 管理员已存在：{user.email}")
        return user

    async def create_site(self, tenant_id: int):
        """创建站点"""
        s_data = self.data["site"]
        site = await crud_site.get_by_slug(self.db, slug=s_data["slug"])

        if not site:
            site_create = SiteCreate(
                name=s_data["name"],
                tenant_id=tenant_id,
                slug=s_data["slug"],
                description=s_data["description"],
                icon=s_data.get("icon"),
                status=s_data["status"],
                theme_color=s_data["theme_color"],
                layout_mode=s_data["layout_mode"],
                quick_questions=s_data.get("quick_questions", []),
            )
            site = await crud_site.create(self.db, obj_in=site_create)
            await self.db.commit()
            await self.db.refresh(site)
            await self.log(f"✅ 创建站点：{site.name}")
        else:
            await self.log(f"✅ 站点已存在：{site.name}")
        return site

    async def init_ai_configs(self, tenant_id: int):
        """初始化 AI 配置 (模型配置)"""
        m_data = self.data.get("model_config")
        if not m_data:
            await self.log("ℹ️ 该播种数据中不含 model_config，跳过 AI 配置初始化")
            return

        ai_keys = {
            "chat": AI_CHAT_CONFIG_KEY,
            "embedding": AI_EMBEDDING_CONFIG_KEY,
            "rerank": AI_RERANK_CONFIG_KEY,
            "vl": AI_VL_CONFIG_KEY,
        }

        for section, key in ai_keys.items():
            if section in m_data:
                await crud_system_config.update_by_key(
                    self.db,
                    config_key=key,
                    config_value=m_data[section],
                    tenant_id=tenant_id,
                    auto_commit=False,
                )
                await self.log(f"  ✅ 初始化 AI 配置节: {section}")

        await self.db.commit()

    async def init_documents(self, tenant_id: int, site_id: int):
        """初始化文档 (支持多个合集)"""
        # 兼容旧格式：如果只有 collection 和 documents，转换为 list
        if "collections" in self.data:
            collections_data = self.data["collections"]
        elif "collection" in self.data and "documents" in self.data:
            # 临时兼容转换，或者假设数据已经转换。
            # 这里我将转换 JSON，所以可以强制要求 collections
            # 但为了稳健性，可以做个判断
            c_item = self.data["collection"]
            c_item["documents"] = self.data["documents"]
            collections_data = [c_item]
        else:
            await self.log("⚠️ 无文档数据需初始化")
            return

        total_collections = 0
        total_documents = 0

        for c_data in collections_data:
            # 1. 创建合集
            result = await self.db.execute(
                select(Collection).where(
                    Collection.title == c_data["title"],
                    Collection.site_id == site_id,
                    Collection.tenant_id == tenant_id,
                )
            )
            collection = result.scalar_one_or_none()

            if not collection:
                collection_create = CollectionCreate(
                    title=c_data["title"],
                    tenant_id=tenant_id,
                    site_id=site_id,
                    order=c_data["order"],
                    parent_id=None,
                )
                collection = await crud_collection.create(self.db, obj_in=collection_create)
                await self.db.commit()
                await self.db.refresh(collection)
                await self.log(f"✅ 创建合集：{collection.title}")
                total_collections += 1
            else:
                await self.log(f"  合集已存在：{collection.title}")

            # 2. 创建文档
            docs_data = c_data.get("documents", [])
            for doc_data in docs_data:
                doc_result = await self.db.execute(
                    select(Document).where(
                        Document.title == doc_data["title"],
                        Document.site_id == site_id,
                        Document.collection_id == collection.id,
                        Document.tenant_id == tenant_id,
                    )
                )
                if doc_result.scalar_one_or_none():
                    continue

                reading_time = calculate_reading_time(doc_data["content"])
                document_create = DocumentCreate(
                    title=doc_data["title"],
                    tenant_id=tenant_id,
                    content=doc_data["content"],
                    summary=doc_data["summary"],
                    site_id=site_id,
                    collection_id=collection.id,
                    category=doc_data.get("category"),
                    author=doc_data.get("author", "Admin"),
                    status="published",
                    tags=doc_data.get("tags", []),
                    reading_time=reading_time,
                )
                await crud_document.create(self.db, obj_in=document_create)
                await self.db.commit()
                await crud_site.increment_article_count(self.db, site_id=site_id)
                total_documents += 1
                await self.log(f"    ✅ 创建文档：{doc_data['title']}")

        await self.log(
            f"📚 文档处理完成，新增合集 {total_collections} 个，新增文档 {total_documents} 篇"
        )
