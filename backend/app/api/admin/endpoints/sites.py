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
站点管理 API 端点
"""

import logging

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.common.utils import Paginator, generate_token
from app.core.infra.config import settings
from app.core.web.deps import get_current_user_with_tenant
from app.core.web.exceptions import BadRequestException, ConflictException, NotFoundException
from app.crud import crud_site, crud_user
from app.db.database import get_db
from app.models.user import User, UserRole
from app.schemas.response import ApiResponse, PaginatedResponse
from app.schemas.site import Site, SiteCreate, SiteUpdate
from app.schemas.user import UserCreate, UserUpdate
from app.core.integration.robot.dingtalk.service import DingTalkRobotService
from app.core.integration.robot.feishu.service import FeishuRobotService

logger = logging.getLogger(__name__)

router = APIRouter()


async def _refresh_bot_stream_services() -> None:
    """站点机器人配置变更后，刷新飞书/钉钉长连接服务。"""
    try:
        await FeishuRobotService.get_instance().refresh()
    except Exception as e:
        logger.warning(f"刷新飞书长连接失败: {e}")
    try:
        await DingTalkRobotService.get_instance().refresh()
    except Exception as e:
        logger.warning(f"刷新钉钉 Stream 失败: {e}")


def _validate_site_bot_config(bot_config: dict | None) -> None:
    """校验站点机器人配置，避免启用后静默失效。"""
    if not bot_config:
        return

    feishu = bot_config.get("feishuBot") or {}
    if feishu.get("enabled"):
        app_id = (feishu.get("appId") or "").strip()
        app_secret = (feishu.get("appSecret") or "").strip()
        if not app_id or not app_secret:
            raise BadRequestException(detail="启用飞书机器人时，App ID 和 App Secret 均不能为空。")

    dingtalk = bot_config.get("dingtalkBot") or {}
    if not dingtalk.get("enabled"):
        return
    client_id = (dingtalk.get("clientId") or "").strip()
    client_secret = (dingtalk.get("clientSecret") or "").strip()
    template_id = (dingtalk.get("templateId") or "").strip()
    if not client_id or not client_secret or not template_id:
        raise BadRequestException(
            detail="启用钉钉机器人时，Client ID、Client Secret、模板 ID 均不能为空。"
        )


@router.get("", response_model=ApiResponse[PaginatedResponse[Site]], operation_id="listAdminSites")
async def list_sites(
    page: int = 1,
    size: int = 10,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[PaginatedResponse[Site]]:
    """获取站点列表（分页）"""
    total = await crud_site.count(db, status=status)
    paginator = Paginator(page=page, size=size, total=total)

    sites = await crud_site.list(db, skip=paginator.skip, limit=paginator.size, status=status)

    return ApiResponse.ok(
        data=PaginatedResponse(
            list=sites,
            pagination=paginator.to_pagination_info(),
        ),
        msg="获取成功",
    )


@router.get("/{site_id}", response_model=ApiResponse[Site], operation_id="getAdminSite")
async def get_site(
    site_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[Site]:
    """获取站点详情"""
    site = await crud_site.get(db, id=site_id)
    if not site:
        raise NotFoundException(detail=f"站点 {site_id} 不存在")

    return ApiResponse.ok(data=site, msg="获取成功")


@router.get(":bySlug/{slug}", response_model=ApiResponse[Site], operation_id="getAdminSiteBySlug")
async def get_site_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[Site]:
    """通过 slug 获取站点详情（管理后台）"""
    site = await crud_site.get_by_slug(db, slug=slug)
    if not site:
        raise NotFoundException(detail=f"站点 {slug} 不存在")

    return ApiResponse.ok(data=site, msg="获取成功")


@router.post(
    "",
    response_model=ApiResponse[Site],
    status_code=status.HTTP_201_CREATED,
    operation_id="createAdminSite",
)
async def create_site(
    site_in: SiteCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[Site]:
    """创建站点"""
    # 检查名称是否已存在
    existing = await crud_site.get_by_name(db, name=site_in.name)
    if existing:
        raise ConflictException(detail=f"站点名称 '{site_in.name}' 已存在")

    # 检查标识是否已存在
    if site_in.slug:
        existing_slug = await crud_site.get_by_slug(db, slug=site_in.slug)
        if existing_slug:
            raise ConflictException(detail=f"标识 '{site_in.slug}' 已存在")

    # 处理机器人配置：如果启用 API Bot 且没填 Key，自动生成一个
    if site_in.bot_config:
        _validate_site_bot_config(site_in.bot_config)
        api_bot = site_in.bot_config.get("apiBot")
        # CE 版本不支持 API Bot（企业版专属功能）
        if api_bot and settings.CATWIKI_EDITION == "community":
            api_bot["enabled"] = False
        elif api_bot and api_bot.get("enabled") and not api_bot.get("apiKey"):
            api_bot["apiKey"] = f"sk-{generate_token(24)}"

    site = await crud_site.create(db, obj_in=site_in)

    # 如果提供了管理员信息，初始化站点管理员
    if site_in.admin_email:
        admin_email = site_in.admin_email.lower().strip()
        existing_user = await crud_user.get_by_email(db, email=admin_email)

        if existing_user:
            # 用户已存在，追加站点管理权限
            current_managed_sites = existing_user.managed_sites
            if site.id not in current_managed_sites:
                new_managed_sites = current_managed_sites + [site.id]

                # 用户已存在，追加站点管理权限

                await crud_user.update(
                    db,
                    db_obj=existing_user,
                    obj_in=UserUpdate(managed_site_ids=new_managed_sites, role=existing_user.role),
                )
        else:
            # 用户不存在，创建新用户
            # 如果没有提供密码，生成默认密码（这里选择生成一个随机密码，但为了体验最好前端必填或生成）
            # 不过 SiteCreate schema 里没强制 admin_password，如果没填就用默认 "123456" 或这里生成
            password = site_in.admin_password or "123456"

            await crud_user.create(
                db,
                obj_in=UserCreate(
                    email=admin_email,
                    password=password,
                    name=site_in.admin_name or admin_email.split("@")[0],
                    role=UserRole.SITE_ADMIN,
                    managed_site_ids=[site.id],
                ),
            )

    await _refresh_bot_stream_services()
    return ApiResponse.ok(data=site, msg="创建成功")


@router.put("/{site_id}", response_model=ApiResponse[Site], operation_id="updateAdminSite")
async def update_site(
    site_id: int,
    site_in: SiteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[Site]:
    """更新站点"""
    site = await crud_site.get(db, id=site_id)
    if not site:
        raise NotFoundException(detail=f"站点 {site_id} 不存在")

    # 检查名称冲突
    if site_in.name:
        existing = await crud_site.get_by_name(db, name=site_in.name)
        if existing and existing.id != site_id:
            raise ConflictException(detail=f"站点名称 '{site_in.name}' 已存在")

    # 检查标识冲突
    if site_in.slug:
        existing_slug = await crud_site.get_by_slug(db, slug=site_in.slug)
        if existing_slug and existing_slug.id != site_id:
            raise ConflictException(detail=f"标识 '{site_in.slug}' 已存在")

    # 处理机器人配置：如果启用 API Bot 且没填 Key，尝试沿用旧的或生成新的
    if site_in.bot_config:
        _validate_site_bot_config(site_in.bot_config)
        api_bot = site_in.bot_config.get("apiBot")
        # CE 版本不支持 API Bot（企业版专属功能）
        if api_bot and settings.CATWIKI_EDITION == "community":
            api_bot["enabled"] = False
        elif api_bot and api_bot.get("enabled") and not api_bot.get("apiKey"):
            # 尝试从原有配置中获取
            old_bot_config = site.bot_config or {}
            old_api_bot = old_bot_config.get("apiBot")
            if old_api_bot and old_api_bot.get("apiKey"):
                api_bot["apiKey"] = old_api_bot["apiKey"]
            else:
                # 原来也没有，生成一个新的
                api_bot["apiKey"] = f"sk-{generate_token(24)}"

    site = await crud_site.update(db, db_obj=site, obj_in=site_in)
    await _refresh_bot_stream_services()
    return ApiResponse.ok(data=site, msg="更新成功")


@router.delete("/{site_id}", response_model=ApiResponse[None], operation_id="deleteAdminSite")
async def delete_site(
    site_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[None]:
    """删除站点（级联删除关联数据）"""
    # 1. 清理向量数据库中的数据
    # 为了保证数据完整性，必须先查询出该站点下的所有文档ID
    from sqlalchemy import select

    from app.models.document import Document

    # 查找站点下所有已向量化的文档或者所有文档（为了安全起见，查所有可能存在的文档）
    # 这里我们只关心 ID
    result = await db.execute(select(Document.id).where(Document.site_id == site_id))
    document_ids = list(result.scalars())

    if document_ids:
        try:
            from app.core.vector.vector_store import VectorStoreManager

            vector_store = await VectorStoreManager.get_instance()

            # 逐个文档清理向量（因为每个文档可能有多个 chunk）
            for doc_id in document_ids:
                await vector_store.delete_by_metadata(key="id", value=str(doc_id))

            logger.info(f"✅ 已清理站点 {site_id} 下 {len(document_ids)} 个文档的向量数据")
        except Exception as e:
            # 记录错误但不中断删除流程（或者根据需求决定是否中断）
            # 这里选择不中断，因为站点删除是主要意图，向量残留是次要问题（虽然我们要修复它，但不能阻止用户删除）
            # 也可以选择 log error
            logger.warning(f"清理站点 {site_id} 的向量数据失败: {e}")

    # 2. 删除数据库数据
    success = await crud_site.remove_with_relationships(db, id=site_id)
    if not success:
        raise NotFoundException(detail=f"站点 {site_id} 不存在")

    await _refresh_bot_stream_services()
    return ApiResponse.ok(msg="删除成功")
