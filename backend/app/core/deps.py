"""
统一依赖管理（异步版本）
"""
import logging

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException, UnauthorizedException
from app.core.rustfs import RustFSService, get_rustfs_service
from app.core.utils import decode_access_token
from app.crud import crud_site
from app.crud.user import crud_user
from app.db.database import get_db
from app.models.site import Site
from app.models.user import User, UserStatus

logger = logging.getLogger(__name__)

# HTTP Bearer 安全方案
security = HTTPBearer()


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
        raise UnauthorizedException(detail="无效的 token")

    # 从 token 中获取用户ID
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise UnauthorizedException(detail="token 中缺少用户信息")

    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise UnauthorizedException(detail="无效的用户ID")

    # 从数据库获取用户
    user = await crud_user.get(db, id=user_id)
    if user is None:
        raise UnauthorizedException(detail="用户不存在")

    # 检查用户状态
    if user.status != UserStatus.ACTIVE:
        raise UnauthorizedException(detail="用户已被禁用")

    return user


# get_current_active_user 是 get_current_user 的别名，直接使用 get_current_user 即可
get_current_active_user = get_current_user


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
        raise NotFoundException(detail=f"站点 {site_id} 不存在")
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
