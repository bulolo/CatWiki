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
用户管理 API 端点
"""

from typing import Literal

from fastapi import APIRouter, Depends, Query, status

from app.core.common.i18n import _
from app.core.web.deps import get_current_user_with_tenant
from app.models.user import User, UserRole, UserStatus
from app.schemas.response import ApiResponse, PaginatedResponse
from app.schemas.user import (
    UserCreate,
    UserInvite,
    UserListItem,
    UserLogin,
    UserLoginResponse,
    UserResponse,
    UserUpdate,
    UserUpdatePassword,
)
from app.services.user_service import UserService, get_user_service

router = APIRouter()


@router.get(
    "", response_model=ApiResponse[PaginatedResponse[UserListItem]], operation_id="listAdminUsers"
)
async def list_users(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(10, ge=1, le=100, description="每页数量"),
    is_pager: int = Query(1, description="是否分页，0=返回全部，1=分页"),
    role: UserRole | None = Query(None, description="角色筛选"),
    status: UserStatus | None = Query(None, description="状态筛选"),
    search: str | None = Query(None, description="搜索关键词"),
    site_id: int | None = Query(None, description="站点ID筛选"),
    order_by: str = Query("created_at", description="排序字段"),
    order_dir: Literal["asc", "desc"] = Query("desc", description="排序方向"),
    service: UserService = Depends(get_user_service),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[PaginatedResponse[UserListItem]]:
    """
    获取用户列表

    - **page**: 页码
    - **size**: 每页数量
    - **role**: 角色筛选 (admin/tenant_admin/site_admin)
    - **status**: 状态筛选 (active/inactive/pending)
    - **search**: 搜索关键词（匹配用户名或邮箱）
    - **site_id**: 站点ID筛选
    - **order_by**: 排序字段
    - **order_dir**: 排序方向 (asc/desc)
    """
    users, paginator = await service.list_users(
        current_user,
        page=page,
        size=size,
        role=role,
        status=status,
        search=search,
        site_id=site_id,
        order_by=order_by,
        order_dir=order_dir,
        is_pager=is_pager,
    )

    return ApiResponse.ok(
        data=PaginatedResponse(list=users, pagination=paginator.to_pagination_info()),
        msg=_("api.success.get"),
    )


@router.get("/{user_id}", response_model=ApiResponse[UserResponse], operation_id="getAdminUser")
async def get_user(
    user_id: int,
    service: UserService = Depends(get_user_service),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[UserResponse]:
    """获取用户详情"""
    # get_current_user_with_tenant 已确保基本访问权

    user = await service.get_user(user_id)
    service.ensure_user_access(current_user, user, action="查看")

    return ApiResponse.ok(data=user, msg=_("api.success.get"))


@router.post(
    "",
    response_model=ApiResponse[UserResponse],
    status_code=status.HTTP_201_CREATED,
    operation_id="createAdminUser",
)
async def create_user(
    user_in: UserCreate,
    service: UserService = Depends(get_user_service),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[UserResponse]:
    """
    创建用户

    - **name**: 用户名
    - **email**: 邮箱
    - **password**: 密码（至少6位）
    - **role**: 角色（默认为 site_admin）
    - **managed_site_ids**: 管理的站点ID列表
    - **avatar_url**: 头像URL（可选）
    """
    # get_current_user_with_tenant 已确保基本访问权

    user = await service.create_user(current_user, user_in)
    return ApiResponse.ok(data=user, msg=_("api.success.create"))


@router.post(":invite", status_code=status.HTTP_201_CREATED, operation_id="inviteAdminUser")
async def invite_user(
    user_in: UserInvite,
    service: UserService = Depends(get_user_service),
    current_user: User = Depends(get_current_user_with_tenant),
):
    """
    邀请用户（直接创建用户并返回临时密码）

    - **email**: 邮箱
    - **role**: 角色（默认为 site_admin）
    - **managed_site_ids**: 管理的站点ID列表

    返回创建的用户信息和临时密码
    """
    # get_current_user_with_tenant 已确保基本访问权

    user, password = await service.invite_user(current_user, user_in)
    user_response = UserResponse.model_validate(user)
    return ApiResponse.ok(data={"user": user_response, "password": password}, msg=_("user.created"))


@router.put("/{user_id}", response_model=ApiResponse[UserResponse], operation_id="updateAdminUser")
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    service: UserService = Depends(get_user_service),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[UserResponse]:
    """
    更新用户信息

    - **name**: 用户名
    - **email**: 邮箱
    - **role**: 角色
    - **managed_site_ids**: 管理的站点ID列表
    - **status**: 状态
    - **avatar_url**: 头像URL
    """
    # get_current_user_with_tenant 已确保基本访问权

    user = await service.update_user(current_user, user_id, user_in)
    return ApiResponse.ok(data=user, msg=_("api.success.update"))


@router.put(
    "/{user_id}/password", response_model=ApiResponse[dict], operation_id="updateAdminUserPassword"
)
async def update_user_password(
    user_id: int,
    password_in: UserUpdatePassword,
    service: UserService = Depends(get_user_service),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[dict]:
    """更新用户密码"""
    # get_current_user_with_tenant 已允许普通用户修改自己
    await service.update_password(current_user, user_id, password_in)

    return ApiResponse.ok(
        data={"message": _("user.password_updated")}, msg=_("user.password_updated")
    )


@router.post("/{user_id}:resetPassword", operation_id="resetAdminUserPassword")
async def reset_user_password(
    user_id: int,
    service: UserService = Depends(get_user_service),
    current_user: User = Depends(get_current_user_with_tenant),
):
    """
    Reset user password (generate random temporary password)

    - Admin can reset password for any user
    - Returns randomly generated temporary password
    """
    user, new_password = await service.reset_password(current_user, user_id)

    return ApiResponse.ok(
        data={"user": UserResponse.model_validate(user), "password": new_password},
        msg=_("user.password_reset"),
    )


@router.delete("/{user_id}", response_model=ApiResponse[dict], operation_id="deleteAdminUser")
async def delete_user(
    user_id: int,
    service: UserService = Depends(get_user_service),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[dict]:
    """删除用户"""
    # get_current_user_with_tenant 已确保基本访问权

    await service.delete_user(current_user, user_id)

    return ApiResponse.ok(data={"message": _("api.success.delete")}, msg=_("api.success.delete"))


@router.post(":login", response_model=ApiResponse[UserLoginResponse], operation_id="loginAdmin")
async def login(
    login_in: UserLogin,
    service: UserService = Depends(get_user_service),
) -> ApiResponse[UserLoginResponse]:
    """
    用户登录

    - **email**: 邮箱
    - **password**: 密码
    """
    user, token = await service.authenticate(login_in)

    return ApiResponse.ok(
        data=UserLoginResponse(token=token, user=user), msg=_("api.success.login")
    )
