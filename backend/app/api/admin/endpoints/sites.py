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
站点管理 API 端点
"""

import logging

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import check_demo_mode, get_current_active_user
from app.core.exceptions import ConflictException, NotFoundException
from app.core.utils import Paginator, mask_bot_config_inplace
from app.crud import crud_site, crud_user
from app.crud.user import get_password_hash
from app.db.database import get_db
from app.models.user import User, UserRole
from app.schemas import ApiResponse, PaginatedResponse
from app.schemas.site import Site, SiteCreate, SiteUpdate
from app.schemas.user import UserCreate, UserUpdate

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=ApiResponse[PaginatedResponse[Site]], operation_id="listAdminSites")
async def list_sites(
    page: int = 1,
    size: int = 10,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
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
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[Site]:
    """获取站点详情"""
    site = await crud_site.get(db, id=site_id)
    if not site:
        raise NotFoundException(detail=f"站点 {site_id} 不存在")

    # 演示模式下脱敏 bot_config
    if settings.DEMO_MODE and site.bot_config:
        mask_bot_config_inplace(site.bot_config)

    return ApiResponse.ok(data=site, msg="获取成功")


@router.get(
    ":byDomain/{domain}", response_model=ApiResponse[Site], operation_id="getAdminSiteByDomain"
)
async def get_site_by_domain(
    domain: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[Site]:
    """通过 domain 获取站点详情（管理后台）"""
    site = await crud_site.get_by_domain(db, domain=domain)
    if not site:
        raise NotFoundException(detail=f"站点 {domain} 不存在")

    # 演示模式下脱敏 bot_config
    if settings.DEMO_MODE and site.bot_config:
        mask_bot_config_inplace(site.bot_config)

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
    current_user: User = Depends(get_current_active_user),
    _: None = Depends(check_demo_mode),
) -> ApiResponse[Site]:
    """创建站点"""
    # 检查名称是否已存在
    existing = await crud_site.get_by_name(db, name=site_in.name)
    if existing:
        raise ConflictException(detail=f"站点名称 '{site_in.name}' 已存在")

    # 检查域名是否已存在
    if site_in.domain:
        existing_domain = await crud_site.get_by_domain(db, domain=site_in.domain)
        if existing_domain:
            raise ConflictException(detail=f"域名 '{site_in.domain}' 已存在")

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

                # 如果用户只是 EDITOR，升级为 SITE_ADMIN
                new_role = existing_user.role
                if existing_user.role == UserRole.EDITOR:
                    new_role = UserRole.SITE_ADMIN

                await crud_user.update(
                    db,
                    db_obj=existing_user,
                    obj_in=UserUpdate(managed_site_ids=new_managed_sites, role=new_role),
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

    return ApiResponse.ok(data=site, msg="创建成功")


@router.put("/{site_id}", response_model=ApiResponse[Site], operation_id="updateAdminSite")
async def update_site(
    site_id: int,
    site_in: SiteUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _: None = Depends(check_demo_mode),
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

    # 检查域名冲突
    if site_in.domain:
        existing_domain = await crud_site.get_by_domain(db, domain=site_in.domain)
        if existing_domain and existing_domain.id != site_id:
            raise ConflictException(detail=f"域名 '{site_in.domain}' 已存在")

    site = await crud_site.update(db, db_obj=site, obj_in=site_in)
    return ApiResponse.ok(data=site, msg="更新成功")


@router.delete("/{site_id}", response_model=ApiResponse[None], operation_id="deleteAdminSite")
async def delete_site(
    site_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
    _: None = Depends(check_demo_mode),
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
            from app.core.vector_store import VectorStoreManager

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

    return ApiResponse.ok(msg="删除成功")
