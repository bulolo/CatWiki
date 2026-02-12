# Copyright 2024 CatWiki Authors
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
初始化育儿百科 Demo 租户和站点数据
"""

import asyncio
import logging
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

from sqlalchemy import select

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

# 配置日志和导入应用组件
from app.core.common.logger import setup_logging
from app.core.common.reading_time import calculate_reading_time
from app.crud.collection import crud_collection
from app.crud.document import crud_document
from app.crud.site import crud_site
from app.crud.tenant import crud_tenant
from app.db.database import AsyncSessionLocal
from app.models.collection import Collection
from app.models.document import Document
from app.schemas.collection import CollectionCreate
from app.schemas.document import DocumentCreate
from app.schemas.site import SiteCreate
from app.schemas.tenant import TenantCreate
from app.crud.user import crud_user
from app.schemas.user import UserCreate
from app.models.user import UserRole, UserStatus

setup_logging()
logger = logging.getLogger(__name__)


async def create_baby_tenant():
    """创建或获取育儿专家租户"""
    async with AsyncSessionLocal() as db:
        try:
            tenant_slug = "baby-care"
            tenant = await crud_tenant.get_by_slug(db, slug=tenant_slug)
            if not tenant:
                tenant_in = TenantCreate(
                    name="Baby Team",
                    slug=tenant_slug,
                    description="专注 0-6 岁科学育儿知识平台",
                    plan="pro",
                    plan_expires_at=datetime.now(timezone.utc) + timedelta(days=365),
                    status="active",
                )
                tenant = await crud_tenant.create(db, obj_in=tenant_in)
                logger.info(f"✅ 创建育儿租户：{tenant.name} (Slug: {tenant.slug})")
            else:
                logger.info(f"✅ 育儿租户已存在：{tenant.name}")
            return tenant
        except Exception as e:
            logger.error(f"❌ 创建育儿租户失败: {e}", exc_info=True)
            raise


async def create_baby_tenant_admin(tenant_id: int, managed_site_ids: list[int] = None):
    """创建育儿租户管理员"""
    async with AsyncSessionLocal() as db:
        try:
            email = "baby_admin@example.com"
            user = await crud_user.get_by_email(db, email=email)
            if not user:
                user_in = UserCreate(
                    name="Baby Admin",
                    email=email,
                    password="admin123",
                    role=UserRole.TENANT_ADMIN,
                    status=UserStatus.ACTIVE,
                    tenant_id=tenant_id,
                    managed_site_ids=managed_site_ids or [],
                )
                user = await crud_user.create(db, obj_in=user_in)
                logger.info(f"✅ 创建育儿租户管理员用户：{user.email} / admin123")
            else:
                logger.info(f"✅ 育儿租户管理员用户已存在：{user.email}")
            return user
        except Exception as e:
            logger.error(f"❌ 创建育儿租户管理员用户失败: {e}", exc_info=True)
            raise


async def init_baby_model_config(tenant_id: int):
    """初始化育儿租户的 AI 模型配置 (Custom模式)"""
    async with AsyncSessionLocal() as db:
        try:
            from app.crud.system_config import crud_system_config
            config_key = "ai_config"
            model_config = {
                "chat": {"provider": "openai", "model": "", "apiKey": "", "baseUrl": "", "mode": "custom"},
                "embedding": {"provider": "openai", "model": "", "apiKey": "", "baseUrl": "", "dimension": None, "mode": "custom"},
                "rerank": {"provider": "openai", "model": "", "apiKey": "", "baseUrl": "", "mode": "custom"},
                "vl": {"provider": "openai", "model": "", "apiKey": "", "baseUrl": "", "mode": "custom"},
            }
            await crud_system_config.update_by_key(db, config_key=config_key, config_value=model_config, tenant_id=tenant_id)
            logger.info(f"✅ 初始化育儿租户 AI 模型配置完成 (Mode: Custom)")
        except Exception as e:
            logger.error(f"❌ 初始化育儿租户 AI 模型配置失败: {e}", exc_info=True)
            raise


async def create_baby_site(tenant_id: int):
    """创建或获取育儿百科站点"""
    async with AsyncSessionLocal() as db:
        try:
            site_slug = "baby-guide"
            demo_site = await crud_site.get_by_slug(db, slug=site_slug)
            if not demo_site:
                site_create = SiteCreate(
                    name="育儿百科",
                    tenant_id=tenant_id,
                    slug=site_slug,
                    description="一站式育儿知识普及平台，涵盖日常护理、营养补给、心理成长等内容",
                    icon="baby",
                    status="active",
                    theme_color="pink",
                    layout_mode="sidebar",
                    quick_questions=[
                        {"text": "新生儿黄疸怎么观察？", "category": "日常护理"},
                        {"text": "宝宝6个月了什么时候加辅食？", "category": "营养指导"},
                        {"text": "如何建立宝宝的睡眠规律？", "category": "成长发育"},
                    ],
                )
                demo_site = await crud_site.create(db, obj_in=site_create)
                await db.commit()
                await db.refresh(demo_site)
                logger.info(
                    f"✅ 创建育儿站点：{demo_site.name} (ID: {demo_site.id}, Slug: {demo_site.slug})"
                )
            else:
                logger.info(
                    f"✅ 育儿站点已存在：{demo_site.name} (ID: {demo_site.id}, Slug: {demo_site.slug})"
                )
            return demo_site
        except Exception as e:
            await db.rollback()
            logger.error(f"❌ 创建育儿站点失败: {e}", exc_info=True)
            raise


async def init_baby_documents(tenant_id: int, site_id: int):
    """初始化育儿知识文档"""
    async with AsyncSessionLocal() as db:
        try:
            baby_data = get_baby_data()

            # 创建或获取合集
            collection_name = "成长指南"
            result = await db.execute(
                select(Collection).where(
                    Collection.title == collection_name,
                    Collection.site_id == site_id,
                    Collection.tenant_id == tenant_id,
                )
            )
            collection = result.scalar_one_or_none()

            if not collection:
                collection_create = CollectionCreate(
                    title=collection_name,
                    tenant_id=tenant_id,
                    site_id=site_id,
                    parent_id=None,
                    order=1,
                )
                collection = await crud_collection.create(db, obj_in=collection_create)
                await db.commit()
                await db.refresh(collection)
                logger.info(f"✅ 创建合集：{collection.title}")
            else:
                logger.info(f"✅ 合集已存在：{collection.title}")

            total_docs = 0
            for doc_data in baby_data:
                # 检查文档是否存在
                doc_result = await db.execute(
                    select(Document).where(
                        Document.title == doc_data["title"],
                        Document.site_id == site_id,
                        Document.collection_id == collection.id,
                    )
                )
                if doc_result.scalar_one_or_none():
                    logger.debug(f"  文档已存在：{doc_data['title']}")
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
                    author="育儿专家团队",
                    status="published",
                    tags=doc_data.get("tags", []),
                    reading_time=reading_time,
                )
                await crud_document.create(db, obj_in=document_create)
                await db.commit()
                await crud_site.increment_article_count(db, site_id=site_id)
                total_docs += 1
                logger.info(f"  ✅ 创建文档：{doc_data['title']}")

            logger.info(f"🚀 初始化完成，共创建 {total_docs} 篇文档")

        except Exception as e:
            await db.rollback()
            logger.error(f"❌ 初始化文档失败: {e}", exc_info=True)
            raise


def get_baby_data():
    """育儿知识数据"""
    return [
        {
            "title": "新生儿护理基础",
            "summary": "为新手爸妈准备的新生儿日常护理核心要点。",
            "content": """# 新生儿护理基础

## 1. 脐带护理
保持干燥是核心，每日用75%酒精轻拭。正常会在1-2周脱落。

## 2. 洗澡技巧
室温控制在26-28度，水温37-40度。坚持“头-身-脚”的顺序。

## 3. 母乳喂养
按需喂养，注意观察衔乳姿势，排气后再放下。""",
            "category": "日常护理",
            "tags": ["新生儿", "护理", "母乳"],
        },
        {
            "title": "婴儿营养与辅食添加",
            "summary": "指导宝宝从6个月开始科学添加辅食。",
            "content": """# 婴儿营养与辅食添加

## 1. 最佳时机
满6个月（180天）是开始添加的最佳时间。

## 2. 第一口辅食
推荐强化铁的婴儿米粉，稀糊状开始。

## 3. 添加原则
一种到多种，从稀到稠，从细到粗。""",
            "category": "营养指导",
            "tags": ["辅食", "营养", "喂养"],
        },
        {
            "title": "婴幼儿疫苗接种指南",
            "summary": "详细列出宝宝出生后需要接种的关键疫苗及时间表。",
            "content": """# 婴幼儿疫苗接种指南

## 1. 必种疫苗（一类）
出生即接种：乙肝疫苗第一针、卡介苗。

## 2. 接种注意事项
接种后留观30分钟，观察是否有发热、过敏反应。

## 3. 常见二类疫苗建议
如五联疫苗、肺炎13价疫苗、流感疫苗等。""",
            "category": "成长发育",
            "tags": ["疫苗", "健康", "防疫"],
        },
        {
            "title": "宝宝睡眠训练",
            "summary": "如何通过建立睡眠仪式，让宝宝和家长都睡得更好。",
            "content": """# 宝宝睡眠训练

## 1. 建立昼夜节奏
白天保持明亮和正常噪音，晚上保持安静黑暗。

## 2. 睡眠仪式
洗澡、换衣、讲故事/听音乐，固定流程暗示进入睡眠。

## 3. 安全睡眠环境
平卧、硬床垫、不放置毛绒玩具，防止窒息。""",
            "category": "成长发育",
            "tags": ["睡眠", "节奏", "安全"],
        },
        {
            "title": "亲子启蒙与互动",
            "summary": "寓教于乐，在日常互动中促进宝宝大脑发育。",
            "content": """# 亲子启蒙与互动

## 1. 触觉游戏
抚触大脑发育，使用不同材质的玩具刺激感官。

## 2. 语言启蒙
多跟宝宝“聊天”，即便他还不会写字，指读绘本非常重要。

## 3. 大运动发展
Tummy Time（俯卧抬头）是增强颈椎力量的关键。""",
            "category": "亲子教育",
            "tags": ["早教", "互动", "发育"],
        },
    ]


async def main():
    logger.info("🚀 开始初始化育儿数据...")
    tenant = await create_baby_tenant()
    site = await create_baby_site(tenant.id)
    await create_baby_tenant_admin(tenant.id, managed_site_ids=[site.id])
    await init_baby_model_config(tenant.id)
    await init_baby_documents(tenant.id, site.id)
    logger.info("✨ 全部初始化工作已完成！")


if __name__ == "__main__":
    asyncio.run(main())
