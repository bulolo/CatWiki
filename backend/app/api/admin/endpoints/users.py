"""
用户管理 API 端点
"""
from typing import Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user
from app.core.exceptions import (
    BadRequestException, 
    ConflictException, 
    ForbiddenException, 
    NotFoundException
)
from app.core.utils import Paginator
from app.crud.user import crud_user
from app.db.database import get_db
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

router = APIRouter()


@router.get("", response_model=ApiResponse[PaginatedResponse[UserListItem]], operation_id="listAdminUsers")
async def list_users(
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(10, ge=1, le=100, description="每页数量"),
    role: UserRole | None = Query(None, description="角色筛选"),
    status: UserStatus | None = Query(None, description="状态筛选"),
    search: str | None = Query(None, description="搜索关键词"),
    site_id: int | None = Query(None, description="站点ID筛选"),
    order_by: str = Query("created_at", description="排序字段"),
    order_dir: Literal["asc", "desc"] = Query("desc", description="排序方向"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[PaginatedResponse[UserListItem]]:
    """
    获取用户列表

    - **page**: 页码
    - **size**: 每页数量
    - **role**: 角色筛选 (admin/site_admin/editor)
    - **status**: 状态筛选 (active/inactive/pending)
    - **search**: 搜索关键词（匹配用户名或邮箱）
    - **site_id**: 站点ID筛选
    - **order_by**: 排序字段
    - **order_dir**: 排序方向 (asc/desc)
    """
    skip = (page - 1) * size

    # 权限控制
    exclude_roles = None
    filter_site_ids = None

    if current_user.role == UserRole.EDITOR:
        raise ForbiddenException(detail="无权访问用户列表")
    
    if current_user.role == UserRole.SITE_ADMIN:
        # 站点管理员不能看系统管理员，且只能看管理相同站点的用户
        exclude_roles = [UserRole.ADMIN]
        # 只能查询自己管理的站点
        if site_id:
            if site_id not in current_user.managed_sites:
                raise ForbiddenException(detail="无权查看该站点用户")
            filter_site_ids = [site_id]
        else:
            filter_site_ids = current_user.managed_sites
            if not filter_site_ids:
                 # 没有任何管理站点，但也可能有，这里为了严谨返回空
                 filter_site_ids = [-1] 
    else:
        # 系统管理员
        if site_id:
            filter_site_ids = [site_id]

    users = await crud_user.list(
        db,
        skip=skip,
        limit=size,
        role=role,
        status=status,
        search=search,
        order_by=order_by,
        order_dir=order_dir,
        exclude_roles=exclude_roles,
        site_ids=filter_site_ids
    )
    total = await crud_user.count(
        db, 
        role=role, 
        status=status, 
        search=search,
        exclude_roles=exclude_roles,
        site_ids=filter_site_ids
    )

    paginator = Paginator(page=page, size=size, total=total)

    return ApiResponse.ok(
        data=PaginatedResponse(
            list=users,
            pagination=paginator.to_pagination_info()
        ),
        msg="获取成功"
    )


@router.get("/{user_id}", response_model=ApiResponse[UserResponse], operation_id="getAdminUser")
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[UserResponse]:
    """获取用户详情"""
    if current_user.role == UserRole.EDITOR:
        raise ForbiddenException(detail="权限不足")

    user = await crud_user.get(db, id=user_id)
    if not user:
        raise NotFoundException(detail=f"用户 {user_id} 不存在")
    
    # 权限检查
    if current_user.role == UserRole.SITE_ADMIN:
        if user.role == UserRole.ADMIN:
            raise ForbiddenException(detail="无权查看该用户")
        
        # 检查是否有共同管理的站点
        admin_sites = set(current_user.managed_sites)
        user_sites = set(user.managed_sites)
        
        # 如果用户有管理站点但没有交集，则禁止查看
        if user_sites and not admin_sites.intersection(user_sites):
             raise ForbiddenException(detail="无权查看该用户")

    return ApiResponse.ok(data=user, msg="获取成功")


@router.post("", response_model=ApiResponse[UserResponse], status_code=status.HTTP_201_CREATED, operation_id="createAdminUser")
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[UserResponse]:
    """
    创建用户

    - **name**: 用户名
    - **email**: 邮箱
    - **password**: 密码（至少6位）
    - **role**: 角色（默认为 editor）
    - **managed_site_ids**: 管理的站点ID列表
    - **avatar_url**: 头像URL（可选）
    """
    if current_user.role == UserRole.EDITOR:
        raise ForbiddenException(detail="权限不足")

    if current_user.role == UserRole.SITE_ADMIN:
        if user_in.role != UserRole.EDITOR:
             raise ForbiddenException(detail="站点管理员只能创建编辑角色的用户")
        
        # 验证站点权限
        if user_in.managed_site_ids:
            admin_sites = set(current_user.managed_sites)
            req_sites = set(user_in.managed_site_ids)
            if not req_sites.issubset(admin_sites):
                raise ForbiddenException(detail="无法分配您未管理的站点")

    # 检查邮箱是否已存在
    existing_user = await crud_user.get_by_email(db, email=user_in.email)
    if existing_user:
        raise ConflictException(detail=f"邮箱 {user_in.email} 已被使用")

    user = await crud_user.create(db, obj_in=user_in)

    return ApiResponse.ok(data=user, msg="创建成功")


@router.post(":invite", status_code=status.HTTP_201_CREATED, operation_id="inviteAdminUser")
async def invite_user(
    user_in: UserInvite,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    邀请用户（直接创建用户并返回临时密码）

    - **email**: 邮箱
    - **role**: 角色（默认为 editor）
    - **managed_site_ids**: 管理的站点ID列表

    返回创建的用户信息和临时密码
    """
    if current_user.role == UserRole.EDITOR:
        raise ForbiddenException(detail="权限不足")

    if current_user.role == UserRole.SITE_ADMIN:
        if user_in.role != UserRole.EDITOR:
             raise ForbiddenException(detail="站点管理员只能邀请编辑角色的用户")
        
        # 验证站点权限
        if user_in.managed_site_ids:
            admin_sites = set(current_user.managed_sites)
            req_sites = set(user_in.managed_site_ids)
            if not req_sites.issubset(admin_sites):
                raise ForbiddenException(detail="无法分配您未管理的站点")

    # 检查邮箱是否已存在
    existing_user = await crud_user.get_by_email(db, email=user_in.email)
    if existing_user:
        raise ConflictException(detail=f"邮箱 {user_in.email} 已被使用")

    user, password = await crud_user.invite(db, obj_in=user_in)

    # 将 User 模型转换为 UserResponse schema
    user_response = UserResponse.model_validate(user)

    return ApiResponse.ok(
        data={
            "user": user_response,
            "password": password
        },
        msg="用户创建成功"
    )


@router.put("/{user_id}", response_model=ApiResponse[UserResponse], operation_id="updateAdminUser")
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
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
    if current_user.role == UserRole.EDITOR:
        raise ForbiddenException(detail="权限不足")

    db_user = await crud_user.get(db, id=user_id)
    if not db_user:
        raise NotFoundException(detail=f"用户 {user_id} 不存在")

    # 权限检查
    if current_user.role == UserRole.SITE_ADMIN:
        # 不能修改管理员
        if db_user.role == UserRole.ADMIN:
            raise ForbiddenException(detail="无权修改系统管理员")
        
        # 不能修改为管理员/站点管理员
        if user_in.role and user_in.role != UserRole.EDITOR and user_in.role != db_user.role:
            raise ForbiddenException(detail="站点管理员只能分配编辑角色")

        # 验证站点权限
        if user_in.managed_site_ids is not None:
            admin_sites = set(current_user.managed_sites)
            req_sites = set(user_in.managed_site_ids)
            if not req_sites.issubset(admin_sites):
                raise ForbiddenException(detail="无法分配您未管理的站点")

    # 如果更新邮箱，检查是否已被其他用户使用
    if user_in.email and user_in.email != db_user.email:
        existing_user = await crud_user.get_by_email(db, email=user_in.email)
        if existing_user:
            raise ConflictException(detail=f"邮箱 {user_in.email} 已被使用")

    user = await crud_user.update(db, db_obj=db_user, obj_in=user_in)

    return ApiResponse.ok(data=user, msg="更新成功")


@router.put("/{user_id}/password", response_model=ApiResponse[dict], operation_id="updateAdminUserPassword")
async def update_user_password(
    user_id: int,
    password_in: UserUpdatePassword,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[dict]:
    """更新用户密码"""
    # 允许用户修改自己的密码，或者管理员修改他人密码
    # 但这里是 admin 接口，通常用于管理
    # 只有 ADMIN 和 SITE_ADMIN 可访问此接口 (EDITOR 已被 forbid?)
    # 实际上，修改自己密码应该走 profile 接口，这里是管理接口
    
    if current_user.role == UserRole.EDITOR:
         # 除非是修改自己？
         if current_user.id != user_id:
             raise ForbiddenException(detail="权限不足")
    
    db_user = await crud_user.get(db, id=user_id)
    if not db_user:
        raise NotFoundException(detail=f"用户 {user_id} 不存在")

    if current_user.role == UserRole.SITE_ADMIN and current_user.id != user_id:
        if db_user.role == UserRole.ADMIN:
            raise ForbiddenException(detail="无权修改系统管理员密码")
        
        # 也可以检查站点交集
        if not set(current_user.managed_sites).intersection(set(db_user.managed_sites)) and db_user.managed_sites:
             # 如果用户有站点但无交集，禁止
             if current_user.id != db_user.id:
                 raise ForbiddenException(detail="无权管理该用户")

    # 验证旧密码 (管理员修改他人密码时是否需要验证旧密码？通常不需要，但这个接口要 old_password，说明是修改密码而非重置)
    # 如果是重置密码，应该用 reset 接口
    from app.crud.user import verify_password
    if not verify_password(password_in.old_password, db_user.password_hash):
        raise BadRequestException(detail="旧密码错误")

    await crud_user.update_password(
        db,
        db_obj=db_user,
        new_password=password_in.new_password
    )

    return ApiResponse.ok(data={"message": "密码更新成功"}, msg="密码更新成功")


@router.post("/{user_id}:resetPassword", operation_id="resetAdminUserPassword")
async def reset_user_password(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Reset user password (generate random temporary password)

    - Admin can reset password for any user
    - Returns randomly generated temporary password
    """
    if current_user.role == UserRole.EDITOR:
        raise ForbiddenException(detail="权限不足")
        
    db_user = await crud_user.get(db, id=user_id)
    if not db_user:
        raise NotFoundException(detail=f"用户 {user_id} 不存在")

    if current_user.role == UserRole.SITE_ADMIN:
        if db_user.role == UserRole.ADMIN:
            raise ForbiddenException(detail="无权重置系统管理员密码")
            
        admin_sites = set(current_user.managed_sites)
        user_sites = set(db_user.managed_sites)
        # 如果用户有站点但无交集
        if user_sites and not admin_sites.intersection(user_sites):
             raise ForbiddenException(detail="无权管理该用户")

    user, new_password = await crud_user.reset_password(db, db_obj=db_user)

    return ApiResponse.ok(
        data={
            "user": UserResponse.model_validate(user),
            "password": new_password
        },
        msg="密码重置成功"
    )


@router.delete("/{user_id}", response_model=ApiResponse[dict], operation_id="deleteAdminUser")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[dict]:
    """删除用户"""
    if current_user.role == UserRole.EDITOR:
        raise ForbiddenException(detail="权限不足")
    
    # 获取用户以检查权限
    db_user = await crud_user.get(db, id=user_id)
    if not db_user:
         raise NotFoundException(detail=f"用户 {user_id} 不存在")

    if current_user.role == UserRole.SITE_ADMIN:
        if db_user.role == UserRole.ADMIN:
            raise ForbiddenException(detail="无权删除系统管理员")
            
        # 必须是自己管理站点的用户
        admin_sites = set(current_user.managed_sites)
        user_sites = set(db_user.managed_sites)
        if user_sites and not admin_sites.intersection(user_sites):
             raise ForbiddenException(detail="无权删除该用户")

    success = await crud_user.delete(db, id=user_id)
    if not success:
        # Should be covered by get above, but just in case
        raise NotFoundException(detail=f"用户 {user_id} 不存在")

    return ApiResponse.ok(data={"message": "删除成功"}, msg="删除成功")


@router.post(":login", response_model=ApiResponse[UserLoginResponse], operation_id="loginAdmin")
async def login(
    login_in: UserLogin,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[UserLoginResponse]:
    """
    用户登录

    - **email**: 邮箱
    - **password**: 密码
    """
    user = await crud_user.authenticate(
        db,
        email=login_in.email,
        password=login_in.password
    )

    if not user:
        raise BadRequestException(detail="邮箱或密码错误")

    # 生成真实的 JWT token
    from app.core.utils import create_access_token
    token_data = {
        "sub": str(user.id),  # subject (用户ID)
        "email": user.email,
        "role": user.role.value if hasattr(user.role, 'value') else user.role,
    }
    token = create_access_token(data=token_data)

    # 更新最后登录时间
    from datetime import datetime
    user.last_login_at = datetime.utcnow()
    db.add(user)
    await db.commit()

    return ApiResponse.ok(
        data=UserLoginResponse(
            token=token,
            user=user
        ),
        msg="登录成功"
    )

