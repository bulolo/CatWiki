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
用户 CRUD 操作（异步版本）
"""

from __future__ import annotations

import secrets
import string
from typing import Any

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.user import User, UserRole, UserStatus
from app.schemas.user import UserCreate, UserInvite, UserUpdate

_password_hasher = PasswordHasher()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    验证密码
    仅使用 Argon2
    """
    try:
        _password_hasher.verify(hashed_password, plain_password)
        return True
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """
    获取密码哈希
    使用 Argon2
    """
    return _password_hasher.hash(password)


def needs_password_rehash(hashed_password: str) -> bool:
    """判断 Argon2 哈希参数是否需要升级。"""
    try:
        return _password_hasher.check_needs_rehash(hashed_password)
    except Exception:
        return False


def generate_random_password(length: int = 12) -> str:
    """生成随机密码（字母数字组合）"""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


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
        **kwargs,
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
            site_conditions = []
            for sid in site_ids:
                s_str = str(sid)
                site_conditions.append(
                    or_(
                        self.model.managed_site_ids == s_str,
                        self.model.managed_site_ids.like(f"{s_str},%"),
                        self.model.managed_site_ids.like(f"%,{s_str}"),
                        self.model.managed_site_ids.like(f"%,{s_str},%"),
                    )
                )
            if site_conditions:
                query = query.where(or_(*site_conditions))

        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(self.model.name.ilike(search_pattern), self.model.email.ilike(search_pattern))
            )

        return query

    async def get(self, db: AsyncSession, id: Any) -> User | None:
        """获取用户 (带缓存)"""
        from app.core.infra.cache import get_cache

        cache = get_cache()
        cache_key = f"user:id:{id}"

        async def _fetch():
            return await super(CRUDUser, self).get(db, id)

        user = await cache.get_or_set(cache_key, _fetch, ttl=600)
        if user and db:
            user = await db.merge(user, load=False)
        return user

    async def get_by_email(self, db: AsyncSession, *, email: str) -> User | None:
        """根据邮箱获取用户 (带缓存)"""
        from app.core.infra.cache import get_cache

        cache = get_cache()
        cache_key = f"user:email:{email}"

        async def _fetch():
            result = await db.execute(select(self.model).where(self.model.email == email))
            return result.scalar_one_or_none()

        user = await cache.get_or_set(cache_key, _fetch, ttl=600)
        if user and db:
            user = await db.merge(user, load=False)
        return user

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
        order_dir: str = "desc",
    ) -> list[User]:
        """获取用户列表"""
        query = select(self.model)
        query = self._apply_filters(
            query,
            role=role,
            status=status,
            search=search,
            exclude_roles=exclude_roles,
            site_ids=site_ids,
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
        site_ids: list[int] | None = None,
    ) -> int:
        """统计用户数量"""
        query = select(func.count()).select_from(self.model)
        query = self._apply_filters(
            query,
            role=role,
            status=status,
            search=search,
            exclude_roles=exclude_roles,
            site_ids=site_ids,
        )
        result = await db.execute(query)
        return result.scalar_one()

    async def create(
        self, db: AsyncSession, *, obj_in: UserCreate, auto_commit: bool = False
    ) -> User:
        """创建用户（自动处理密码哈希与租户 ID）"""
        from app.core.infra.tenant import get_current_tenant

        tenant_id = obj_in.tenant_id
        if tenant_id is None:
            tenant_id = get_current_tenant()

        db_user = User(
            name=obj_in.name,
            email=obj_in.email,
            password_hash=get_password_hash(obj_in.password),
            tenant_id=tenant_id,
            role=obj_in.role,
            status=UserStatus.ACTIVE,
            avatar_url=obj_in.avatar_url,
        )

        # 设置管理的站点
        if obj_in.managed_site_ids:
            db_user.set_managed_sites(obj_in.managed_site_ids)

        db.add(db_user)
        if auto_commit:
            await db.commit()
        else:
            await db.flush()
        await db.refresh(db_user)

        # 清理可能存在的空缓存 (防止初始化前尝试登录导致的缓存击穿)
        from app.core.infra.cache import get_cache

        cache = get_cache()
        await cache.delete(f"user:email:{db_user.email}")

        return db_user

    async def invite(
        self, db: AsyncSession, *, obj_in: UserInvite, auto_commit: bool = False
    ) -> tuple[User, str]:
        """邀请用户（支持租户 ID 自动填充）"""
        from app.core.infra.tenant import get_current_tenant

        tenant_id = obj_in.tenant_id
        if tenant_id is None:
            tenant_id = get_current_tenant()

        generated_password = generate_random_password()
        password_hash = get_password_hash(generated_password)

        db_user = User(
            name=obj_in.email.split("@")[0],  # 从邮箱提取用户名
            email=obj_in.email,
            password_hash=password_hash,
            tenant_id=tenant_id,
            role=obj_in.role,
            status=UserStatus.ACTIVE,
        )

        # 设置管理的站点
        if obj_in.managed_site_ids:
            db_user.set_managed_sites(obj_in.managed_site_ids)

        db.add(db_user)
        if auto_commit:
            await db.commit()
            await db.refresh(db_user)
        else:
            await db.flush()

        # 清理可能存在的空缓存
        from app.core.infra.cache import get_cache

        cache = get_cache()
        await cache.delete(f"user:email:{db_user.email}")

        return db_user, generated_password

    async def update(
        self, db: AsyncSession, *, db_obj: User, obj_in: UserUpdate, auto_commit: bool = False
    ) -> User:
        """更新用户信息"""
        update_data = obj_in.model_dump(exclude_unset=True)

        # 处理管理的站点 (由于模型层是字符串，Schema 层是列表，需要特殊转换)
        if "managed_site_ids" in update_data:
            managed_site_ids = update_data.pop("managed_site_ids")
            if managed_site_ids is not None:
                db_obj.set_managed_sites(managed_site_ids)

        # 更新并清理缓存
        user = await super().update(db, db_obj=db_obj, obj_in=update_data, auto_commit=auto_commit)

        from app.core.infra.cache import get_cache

        cache = get_cache()
        await cache.delete(f"user:id:{user.id}")
        await cache.delete(f"user:email:{user.email}")
        return user

    async def update_password(
        self, db: AsyncSession, *, db_obj: User, new_password: str, auto_commit: bool = False
    ) -> User:
        """更新用户密码"""
        db_obj.password_hash = get_password_hash(new_password)
        db.add(db_obj)
        if auto_commit:
            await db.commit()
            await db.refresh(db_obj)
        else:
            await db.flush()

        # 清理缓存
        from app.core.infra.cache import get_cache

        cache = get_cache()
        await cache.delete(f"user:id:{db_obj.id}")
        await cache.delete(f"user:email:{db_obj.email}")

        return db_obj

    async def reset_password(
        self, db: AsyncSession, *, db_obj: User, auto_commit: bool = False
    ) -> tuple[User, str]:
        """重置用户密码（并清理缓存）"""
        generated_password = generate_random_password()
        db_obj.password_hash = get_password_hash(generated_password)

        db.add(db_obj)
        if auto_commit:
            await db.commit()
            await db.refresh(db_obj)
        else:
            await db.flush()

        # 清理缓存
        from app.core.infra.cache import get_cache

        cache = get_cache()
        await cache.delete(f"user:id:{db_obj.id}")
        await cache.delete(f"user:email:{db_obj.email}")

        return db_obj, generated_password

    async def authenticate(self, db: AsyncSession, *, email: str, password: str) -> User | None:
        """验证用户登录"""
        user = await self.get_by_email(db, email=email)
        if not user:
            return None

        # 验证密码
        if not verify_password(password, user.password_hash):
            return None

        if user.status != UserStatus.ACTIVE:
            return None

        # 登录成功后，如果 Argon2 参数过期则自动重哈希
        if needs_password_rehash(user.password_hash):
            user.password_hash = get_password_hash(password)
            db.add(user)
            # 自动重哈希，由装饰器或调用方决定是否提交

            # 清理缓存以保证一致性
            from app.core.infra.cache import get_cache

            cache = get_cache()
            await cache.delete(f"user:id:{user.id}")
            await cache.delete(f"user:email:{user.email}")

        return user

    async def delete(self, db: AsyncSession, *, id: Any, auto_commit: bool = False) -> User | None:
        """删除用户并清理缓存"""
        user = await self.get(db, id=id)
        if user:
            email = user.email
            res = await super().delete(db, id=id, auto_commit=auto_commit)
            if res:
                from app.core.infra.cache import get_cache

                cache = get_cache()
                await cache.delete(f"user:id:{id}")
                await cache.delete(f"user:email:{email}")
            return res
        return None


crud_user = CRUDUser(User)
