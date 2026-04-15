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
统一依赖管理（异步版本）
"""

import logging

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.common.auth import decode_access_token
from app.core.common.i18n import _
from app.core.infra.config import settings
from app.core.infra.rustfs import RustFSService, get_rustfs_service
from app.core.web.exceptions import NotFoundException, UnauthorizedException
from app.crud import crud_site
from app.crud.user import crud_user
from app.db.database import get_db
from app.models.site import Site
from app.models.user import User, UserStatus

logger = logging.getLogger(__name__)

# HTTP Bearer 安全方案
security = HTTPBearer()

# 演示模式下允许通过的写接口（仅限无状态探测类请求）
DEMO_WRITE_EXEMPT_ENDPOINTS = {
    ("POST", f"{settings.ADMIN_API_V1_STR}/system-configs/ai-config/test-connection"),
    ("POST", f"{settings.ADMIN_API_V1_STR}/system-configs/doc-processor/test-connection"),
    ("POST", f"{settings.ADMIN_API_V1_STR}/documents/retrieve"),
}


def _is_demo_write_exempt(method: str, path: str) -> bool:
    return (method.upper(), path) in DEMO_WRITE_EXEMPT_ENDPOINTS


def get_request_id(request: Request) -> str:
    """
    获取请求 ID
    用于日志追踪
    """
    return request.headers.get("X-Request-ID", "unknown")


class CommonDependencies:
    """
    通用依赖类
    可以在路由中使用 Depends(CommonDependencies) 来注入
    """

    def __init__(
        self,
        request: Request,
        db: AsyncSession = Depends(get_db),
    ):
        self.request = request
        self.db = db
        self.request_id = get_request_id(request)

    def log_info(self, message: str):
        """记录信息日志"""
        logger.info(f"[{self.request_id}] {message}")

    def log_error(self, message: str):
        """记录错误日志"""
        logger.error(f"[{self.request_id}] {message}")


# ==================== 认证相关依赖 ====================


# ==================== 认证相关依赖 ====================


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    获取当前登录用户

    从请求头中提取并验证 JWT token，然后返回对应的用户对象

    Args:
        credentials: HTTP Bearer token 凭证
        db: 数据库会话

    Returns:
        当前登录的用户对象

    Raises:
        UnauthorizedException: 如果 token 无效或用户不存在
    """
    token = credentials.credentials

    # 解码 token
    payload = decode_access_token(token)
    if payload is None:
        raise UnauthorizedException(detail=_("auth.invalid_token"))

    # 从 token 中获取用户ID
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise UnauthorizedException(detail=_("auth.missing_user_info"))

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise UnauthorizedException(detail=_("auth.invalid_user_id"))

    # 从数据库获取用户
    user = await crud_user.get(db, id=user_id)
    if user is None:
        raise UnauthorizedException(detail=_("auth.user_not_found"))

    # 检查用户状态
    if user.status != UserStatus.ACTIVE:
        raise UnauthorizedException(detail=_("auth.user_disabled"))

    return user


# get_current_active_user 是 get_current_user 的别名，直接使用 get_current_user 即可
get_current_active_user = get_current_user


async def get_effective_tenant_id(
    request: Request,
    current_user: User = Depends(get_current_active_user),
) -> int | None:
    """
    获取当前请求的有效租户ID
    """
    # 尝试加载 EE 版逻辑
    try:
        from app.ee.loader import get_ee_tenant_id

        return get_ee_tenant_id(current_user, request)
    except (ImportError, AttributeError):
        # 社区版逻辑：始终返回用户关联的租户 ID
        return current_user.tenant_id


async def set_tenant_context(
    tenant_id: int | None = Depends(get_effective_tenant_id),
) -> int | None:
    """
    依赖项：在认证后设置当前请求的租户上下文
    """
    from app.core.infra.tenant import set_current_tenant

    set_current_tenant(tenant_id)
    return tenant_id


async def set_client_tenant_context(
    request: Request,
    x_tenant_slug: str | None = Header(None, alias="X-Tenant-Slug"),
    db: AsyncSession = Depends(get_db),
) -> int | None:
    """
    依赖项：在客户端未认证请求中，通过 X-Tenant-Slug 头设置当前请求的租户上下文
    """
    from app.core.infra.tenant import set_current_tenant

    tenant_id = None
    request.state.site = None

    if x_tenant_slug:
        from app.crud.tenant import crud_tenant

        tenant = await crud_tenant.get_by_slug(db, slug=x_tenant_slug)
        if tenant:
            tenant_id = tenant.id
            logger.debug(
                f"🔑 [TenantResolve] Resolved tenant_id={tenant_id} from slug='{x_tenant_slug}'"
            )
        else:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")

    # [Compatibility] 如果 header 缺失，尝试从查询参数 site_id 中自动探知租户
    if tenant_id is None:
        site_id_str = request.query_params.get("site_id")
        if site_id_str and site_id_str.isdigit():
            from app.crud.site import crud_site

            site = await crud_site.get(db, id=int(site_id_str))
            if site:
                tenant_id = site.tenant_id
                request.state.site = site  # 缓存此站点对象供后续依赖复用
                logger.debug(
                    f"🔍 [TenantResolve] Resolved tenant_id={tenant_id} from site_id={site_id_str}"
                )

    # 如果找到了特定的 tenant_id，则设置
    if tenant_id is not None:
        set_current_tenant(tenant_id)

    # 企业版强制校验：防止在多租户环境下出现未指定租户的“空挂”请求
    if settings.CATWIKI_EDITION == "enterprise":
        try:
            from app.ee.loader import enforce_tenant_context

            enforce_tenant_context(tenant_id, request.url.path)
        except (ImportError, AttributeError):
            pass

    return tenant_id


async def get_current_user_with_tenant(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    tenant_id: int | None = Depends(get_effective_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    复合依赖项：获取当前用户并同时注入租户上下文。
    同时自动处理演示模式拦截：如果是写操作且为演示租户，则抛出异常。
    """
    from app.core.infra.tenant import set_current_tenant
    from app.core.web.exceptions import BadRequestException
    from app.crud.tenant import crud_tenant

    # 1. 设置租户上下文
    set_current_tenant(tenant_id)

    # 2. 自动检测并拦截演示模式写操作
    request.state.is_demo = False

    if tenant_id:
        tenant = await crud_tenant.get(db, id=tenant_id)
        if tenant:
            is_demo = False
            try:
                from app.ee.loader import get_ee_tenant_is_demo

                is_demo = await get_ee_tenant_is_demo(db, tenant_id)
            except ImportError:
                pass

            request.state.is_demo = is_demo

            # 仅针对写方法且有租户目标的情况
            if request.method in ["POST", "PUT", "PATCH", "DELETE"] and is_demo:
                path = request.url.path
                if not _is_demo_write_exempt(request.method, path):
                    logger.warning(
                        f"🚫 [DemoMode] Auto-blocked {request.method} {path} for tenant_id={tenant_id}"
                    )
                    raise BadRequestException(detail=_("auth.demo_mode"))

    return current_user


async def is_demo_tenant(
    request: Request,
    tenant_id: int | None = Depends(get_effective_tenant_id),
    db: AsyncSession = Depends(get_db),
) -> bool:
    """
    检查当前请求对应的租户是否为演示租户。
    优先使用 request.state 缓存；若缓存缺失则自动回查租户，避免依赖执行顺序。
    """
    cached = getattr(request.state, "is_demo", None)
    if cached is not None:
        return bool(cached)

    if tenant_id is None:
        request.state.is_demo = False
        return False

    from app.crud.tenant import crud_tenant

    tenant = await crud_tenant.get(db, id=tenant_id)
    is_demo = False
    if tenant:
        try:
            from app.ee.loader import get_ee_tenant_is_demo

            is_demo = await get_ee_tenant_is_demo(db, tenant_id)
        except ImportError:
            pass

    request.state.is_demo = is_demo
    return is_demo


# ==================== 资源验证依赖 ====================


async def get_valid_site(
    site_id: int,
    db: AsyncSession = Depends(get_db),
) -> Site:
    """
    验证站点存在并返回

    Args:
        site_id: 站点 ID
        db: 数据库会话

    Returns:
        站点对象

    Raises:
        NotFoundException: 站点不存在
    """
    site = await crud_site.get(db, id=site_id)
    if not site:
        raise NotFoundException(detail=_("site.not_found", id=site_id))
    return site


# ==================== RustFS 服务依赖 ====================


def get_rustfs() -> RustFSService:
    """
    获取 RustFS 服务实例

    用于在路由中注入 RustFS 服务

    Returns:
        RustFS 服务实例
    """
    return get_rustfs_service()
