import logging
from datetime import datetime

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.common.auth import create_access_token
from app.core.common.utils import Paginator
from app.core.infra.config import settings
from app.core.web.exceptions import (
    BadRequestException,
    ConflictException,
    ForbiddenException,
    NotFoundException,
)
from app.crud.user import crud_user
from app.db.database import get_db
from app.db.transaction import transactional
from app.models.user import User, UserRole, UserStatus
from app.schemas.user import (
    UserCreate,
    UserInvite,
    UserLogin,
    UserUpdate,
    UserUpdatePassword,
)

logger = logging.getLogger(__name__)


class UserService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def ensure_user_access(
        self, current_user: User, target_user: User, action: str = "view"
    ) -> None:
        """
        检查当前用户是否有权操作目标用户（无权则抛出异常）
        """
        if current_user.id == target_user.id:
            return

        if current_user.role == UserRole.ADMIN:
            return

        if current_user.role == UserRole.TENANT_ADMIN:
            if target_user.role == UserRole.ADMIN:
                raise ForbiddenException(detail=f"无权{action}系统管理员")
            return

        if current_user.role == UserRole.SITE_ADMIN:
            if target_user.role in [UserRole.ADMIN, UserRole.TENANT_ADMIN]:
                raise ForbiddenException(detail=f"无权{action}该级别管理员")

            # 检查是否有共同管理的站点
            admin_sites = set(current_user.managed_sites)
            user_sites = set(target_user.managed_sites)

            # 如果目标用户没有任何关联站点，且当前是 SITE_ADMIN，可能也无权查看（除非是同一个租户下的无站点用户？）
            # 根据原代码逻辑：如果用户有管理站点但没有交集，则禁止
            if user_sites and not admin_sites.intersection(user_sites):
                raise ForbiddenException(detail=f"无权{action}该用户")

            # 如果目标用户没有关联任何站点，SITE_ADMIN 通常也无权管理（除非是自己，但上面已经判断了）
            if not user_sites and current_user.id != target_user.id:
                # 这里根据业务逻辑决定，原代码在 list_users 中通过 filter_site_ids 过滤
                # 在 get_user 中则主要看交集。如果没有交集则禁止。
                # 如果 target_user.managed_sites 为空，intersection 也是空。
                raise ForbiddenException(detail=f"无权{action}该用户")

    @transactional()
    async def get_user(self, user_id: int) -> User:
        """
        获取用户详情
        """
        user = await crud_user.get(self.db, id=user_id)
        if not user:
            raise NotFoundException(detail=f"用户 {user_id} 不存在")
        return user

    @transactional()
    async def list_users(
        self,
        current_user: User,
        page: int = 1,
        size: int = 10,
        role: UserRole | None = None,
        status: UserStatus | None = None,
        search: str | None = None,
        site_id: int | None = None,
        order_by: str = "created_at",
        order_dir: str = "desc",
    ) -> tuple[list[User], Paginator]:
        """
        获取用户列表（带权限过滤）
        """
        exclude_roles = None
        filter_site_ids = None

        if current_user.role == UserRole.TENANT_ADMIN:
            exclude_roles = [UserRole.ADMIN]
            if site_id:
                filter_site_ids = [site_id]
        elif current_user.role == UserRole.SITE_ADMIN:
            exclude_roles = [UserRole.ADMIN, UserRole.TENANT_ADMIN]
            if site_id:
                if site_id not in current_user.managed_sites:
                    raise ForbiddenException(detail="无权查看该站点用户")
                filter_site_ids = [site_id]
            else:
                filter_site_ids = current_user.managed_sites
                if not filter_site_ids:
                    filter_site_ids = [-1]
        else:  # ADMIN
            if site_id:
                filter_site_ids = [site_id]

        total = await crud_user.count(
            self.db,
            role=role,
            status=status,
            search=search,
            exclude_roles=exclude_roles,
            site_ids=filter_site_ids,
        )
        paginator = Paginator(page=page, size=size, total=total)

        users = await crud_user.list(
            self.db,
            skip=paginator.skip,
            limit=paginator.size,
            role=role,
            status=status,
            search=search,
            order_by=order_by,
            order_dir=order_dir,
            exclude_roles=exclude_roles,
            site_ids=filter_site_ids,
        )
        return users, paginator

    @transactional()
    async def create_user(self, current_user: User, user_in: UserCreate) -> User:
        """
        创建用户（带权限校验）
        """
        if current_user.role == UserRole.TENANT_ADMIN:
            if user_in.role == UserRole.ADMIN:
                raise ForbiddenException(detail="租户管理员无法创建系统管理员")

        if settings.CATWIKI_EDITION == "community" and user_in.role == UserRole.ADMIN:
            raise ForbiddenException(detail="社区版无法创建系统管理员角色")

        if current_user.role == UserRole.SITE_ADMIN:
            if user_in.managed_site_ids:
                admin_sites = set(current_user.managed_sites)
                req_sites = set(user_in.managed_site_ids)
                if not req_sites.issubset(admin_sites):
                    raise ForbiddenException(detail="无法分配您未管理的站点")

        # 检查邮箱是否已存在
        existing_user = await crud_user.get_by_email(self.db, email=user_in.email)
        if existing_user:
            raise ConflictException(detail=f"邮箱 {user_in.email} 已被使用")

        return await crud_user.create(self.db, obj_in=user_in)

    @transactional()
    async def invite_user(self, current_user: User, user_in: UserInvite) -> tuple[User, str]:
        """
        邀请用户（带权限校验）
        """
        if current_user.role == UserRole.TENANT_ADMIN:
            if user_in.role == UserRole.ADMIN:
                raise ForbiddenException(detail="无法邀请系统管理员")

        if settings.CATWIKI_EDITION == "community" and user_in.role == UserRole.ADMIN:
            raise ForbiddenException(detail="社区版无法邀请系统管理员角色")

        if current_user.role == UserRole.SITE_ADMIN:
            if user_in.role != UserRole.SITE_ADMIN:
                # 站点管理员只能邀请站点管理员
                pass
            if user_in.managed_site_ids:
                admin_sites = set(current_user.managed_sites)
                req_sites = set(user_in.managed_site_ids)
                if not req_sites.issubset(admin_sites):
                    raise ForbiddenException(detail="无法分配您未管理的站点")

        # 检查邮箱是否已存在
        existing_user = await crud_user.get_by_email(self.db, email=user_in.email)
        if existing_user:
            raise ConflictException(detail=f"邮箱 {user_in.email} 已被使用")

        user, password = await crud_user.invite(self.db, obj_in=user_in)
        return user, password

    @transactional()
    async def update_user(self, current_user: User, user_id: int, user_in: UserUpdate) -> User:
        """
        更新用户（带权限校验）
        """
        db_user = await crud_user.get(self.db, id=user_id)
        if not db_user:
            raise NotFoundException(detail=f"用户 {user_id} 不存在")

        self.ensure_user_access(current_user, db_user, action="修改")

        if current_user.role == UserRole.TENANT_ADMIN:
            if user_in.role == UserRole.ADMIN:
                raise ForbiddenException(detail="无法提权为系统管理员")

        if settings.CATWIKI_EDITION == "community" and user_in.role == UserRole.ADMIN:
            raise ForbiddenException(detail="社区版无法设置为系统管理员角色")

        if current_user.role == UserRole.SITE_ADMIN:
            if user_in.role and user_in.role == UserRole.ADMIN:
                raise ForbiddenException(detail="无法提权为系统管理员")
            if user_in.managed_site_ids is not None:
                admin_sites = set(current_user.managed_sites)
                req_sites = set(user_in.managed_site_ids)
                if not req_sites.issubset(admin_sites):
                    raise ForbiddenException(detail="无法分配您未管理的站点")

        # 如果更新邮箱，检查是否已被其他用户使用
        if user_in.email and user_in.email != db_user.email:
            existing_user = await crud_user.get_by_email(self.db, email=user_in.email)
            if existing_user:
                raise ConflictException(detail=f"邮箱 {user_in.email} 已被使用")

        return await crud_user.update(self.db, db_obj=db_user, obj_in=user_in)

    @transactional()
    async def authenticate(self, login_in: UserLogin) -> tuple[User, str]:
        """
        用户登录验证并生成 Token
        """
        user = await crud_user.authenticate(
            self.db, email=login_in.email, password=login_in.password
        )
        if not user:
            raise BadRequestException(detail="邮箱或密码错误")

        token_data = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role.value if hasattr(user.role, "value") else user.role,
        }
        token = create_access_token(data=token_data)

        # 更新最后登录时间
        user.last_login_at = datetime.utcnow()
        self.db.add(user)

        return user, token

    @transactional()
    async def reset_password(self, current_user: User, user_id: int) -> tuple[User, str]:
        """
        重置用户密码（带权限校验）
        """
        db_user = await crud_user.get(self.db, id=user_id)
        if not db_user:
            raise NotFoundException(detail=f"用户 {user_id} 不存在")

        self.ensure_user_access(current_user, db_user, action="重置密码")

        user, new_password = await crud_user.reset_password(self.db, db_obj=db_user)
        return user, new_password

    @transactional()
    async def delete_user(self, current_user: User, user_id: int) -> None:
        """
        删除用户（带权限校验）
        """
        db_user = await crud_user.get(self.db, id=user_id)
        if not db_user:
            raise NotFoundException(detail=f"用户 {user_id} 不存在")

        self.ensure_user_access(current_user, db_user, action="删除")

        success = await crud_user.delete(self.db, id=user_id)
        if not success:
            raise NotFoundException(detail=f"用户 {user_id} 不存在")

    @transactional()
    async def update_password(
        self,
        current_user: User,
        user_id: int,
        password_in: UserUpdatePassword,
    ) -> None:
        """
        更新用户密码（带权限校验）
        """
        db_user = await crud_user.get(self.db, id=user_id)
        if not db_user:
            raise NotFoundException(detail=f"用户 {user_id} 不存在")

        self.ensure_user_access(current_user, db_user, action="修改密码")

        from app.crud.user import verify_password

        if not verify_password(password_in.old_password, db_user.password_hash):
            raise BadRequestException(detail="旧密码错误")

        await crud_user.update_password(
            self.db, db_obj=db_user, new_password=password_in.new_password
        )


def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    """获取 UserService 实例的依赖注入函数"""
    return UserService(db)
