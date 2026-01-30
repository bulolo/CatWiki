"""
用户 CRUD 操作（异步版本）
"""
from __future__ import annotations

import hashlib
import secrets
import string

from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.user import User, UserRole, UserStatus
from app.schemas.user import UserCreate, UserInvite, UserUpdate


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    验证密码
    使用 SHA256 + salt 的简单加密方案
    格式: salt$hash
    """
    try:
        if '$' not in hashed_password:
            # 旧格式密码无法验证
            return False

        salt, hash_value = hashed_password.split('$', 1)
        computed_hash = hashlib.sha256((salt + plain_password).encode()).hexdigest()
        return computed_hash == hash_value
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """
    获取密码哈希
    使用 SHA256 + salt
    """
    salt = secrets.token_hex(16)
    hash_value = hashlib.sha256((salt + password).encode()).hexdigest()
    return f"{salt}${hash_value}"


def generate_random_password(length: int = 8) -> str:
    """生成随机密码（字母数字组合）"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    """用户 CRUD 操作（异步版本）"""

    def _apply_filters(
        self,
        query,
        role: UserRole | None = None,
        status: UserStatus | None = None,
        search: str | None = None,
        exclude_roles: list[UserRole] | None = None,
        site_ids: list[int] | None = None,
        **kwargs
    ):
        """应用用户特有的过滤逻辑"""
        query = super()._apply_filters(query, **kwargs)

        if role is not None:
            query = query.where(self.model.role == role)
        
        if exclude_roles:
            query = query.where(self.model.role.notin_(exclude_roles))

        if status is not None:
            query = query.where(self.model.status == status)

        if site_ids:
            # 筛选管理特定站点的用户
            # 只要用户管理的站点中包含传入的 site_ids 中的任意一个，就符合条件
            site_conditions = []
            for sid in site_ids:
                s_str = str(sid)
                site_conditions.append(or_(
                    self.model.managed_site_ids == s_str,
                    self.model.managed_site_ids.like(f"{s_str},%"),
                    self.model.managed_site_ids.like(f"%,{s_str}"),
                    self.model.managed_site_ids.like(f"%,{s_str},%")
                ))
            if site_conditions:
                query = query.where(or_(*site_conditions))
        
        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    self.model.name.ilike(search_pattern),
                    self.model.email.ilike(search_pattern)
                )
            )

        return query

    async def get_by_email(self, db: AsyncSession, *, email: str) -> User | None:
        """根据邮箱获取用户"""
        result = await db.execute(
            select(self.model).where(self.model.email == email)
        )
        return result.scalar_one_or_none()

    async def list(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
        role: UserRole | None = None,
        status: UserStatus | None = None,
        search: str | None = None,
        exclude_roles: list[UserRole] | None = None,
        site_ids: list[int] | None = None,
        order_by: str = "created_at",
        order_dir: str = "desc"
    ) -> list[User]:
        """获取用户列表"""
        query = select(self.model)
        query = self._apply_filters(
            query, 
            role=role, 
            status=status, 
            search=search, 
            exclude_roles=exclude_roles,
            site_ids=site_ids
        )

        # 排序
        order_column = getattr(self.model, order_by, self.model.created_at)
        if order_dir.lower() == "desc":
            query = query.order_by(desc(order_column))
        else:
            query = query.order_by(asc(order_column))

        # 分页
        query = query.offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars())

    async def count(
        self,
        db: AsyncSession,
        *,
        role: UserRole | None = None,
        status: UserStatus | None = None,
        search: str | None = None,
        exclude_roles: list[UserRole] | None = None,
        site_ids: list[int] | None = None
    ) -> int:
        """统计用户数量"""
        query = select(func.count()).select_from(self.model)
        query = self._apply_filters(
            query, 
            role=role, 
            status=status, 
            search=search,
            exclude_roles=exclude_roles,
            site_ids=site_ids
        )
        result = await db.execute(query)
        return result.scalar_one()

    async def create(self, db: AsyncSession, *, obj_in: UserCreate) -> User:
        """创建用户（自动处理密码哈希）"""
        db_user = User(
            name=obj_in.name,
            email=obj_in.email,
            password_hash=get_password_hash(obj_in.password),
            role=obj_in.role,
            status=UserStatus.ACTIVE,
            avatar_url=obj_in.avatar_url
        )

        # 设置管理的站点
        if obj_in.managed_site_ids:
            db_user.set_managed_sites(obj_in.managed_site_ids)

        db.add(db_user)
        await db.commit()
        await db.refresh(db_user)

        return db_user

    async def invite(self, db: AsyncSession, *, obj_in: UserInvite) -> tuple[User, str]:
        """邀请用户（直接创建用户并生成随机密码）"""
        generated_password = generate_random_password()
        password_hash = get_password_hash(generated_password)

        db_user = User(
            name=obj_in.email.split("@")[0],  # 从邮箱提取用户名
            email=obj_in.email,
            password_hash=password_hash,
            role=obj_in.role,
            status=UserStatus.ACTIVE
        )

        # 设置管理的站点
        if obj_in.managed_site_ids:
            db_user.set_managed_sites(obj_in.managed_site_ids)

        db.add(db_user)
        await db.commit()
        await db.refresh(db_user)

        return db_user, generated_password

    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: User,
        obj_in: UserUpdate
    ) -> User:
        """更新用户信息"""
        update_data = obj_in.model_dump(exclude_unset=True)

        # 处理管理的站点
        if "managed_site_ids" in update_data:
            managed_site_ids = update_data.pop("managed_site_ids")
            if managed_site_ids is not None:
                db_obj.set_managed_sites(managed_site_ids)

        # 更新其他字段
        for field, value in update_data.items():
            setattr(db_obj, field, value)

        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)

        return db_obj

    async def update_password(
        self,
        db: AsyncSession,
        *,
        db_obj: User,
        new_password: str
    ) -> User:
        """更新用户密码"""
        db_obj.password_hash = get_password_hash(new_password)

        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)

        return db_obj

    async def reset_password(self, db: AsyncSession, *, db_obj: User) -> tuple[User, str]:
        """重置用户密码（生成随机临时密码）"""
        generated_password = generate_random_password()
        db_obj.password_hash = get_password_hash(generated_password)

        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)

        return db_obj, generated_password

    async def authenticate(
        self,
        db: AsyncSession,
        *,
        email: str,
        password: str
    ) -> User | None:
        """验证用户登录"""
        user = await self.get_by_email(db, email=email)
        if not user:
            return None

        # 验证密码
        if not verify_password(password, user.password_hash):
            return None

        if user.status != UserStatus.ACTIVE:
            return None

        return user


crud_user = CRUDUser(User)
