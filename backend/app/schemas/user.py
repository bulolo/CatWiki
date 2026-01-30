from __future__ import annotations

import builtins
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.user import UserRole, UserStatus

# ============ 基础 Schema ============

class UserBase(BaseModel):
    """用户基础 Schema"""
    name: str = Field(..., min_length=1, max_length=100, description="用户名")
    email: EmailStr = Field(..., description="邮箱")
    role: UserRole = Field(default=UserRole.EDITOR, description="用户角色")
    managed_site_ids: list[int] = Field(default=[], description="管理的站点ID列表")
    status: UserStatus = Field(default=UserStatus.ACTIVE, description="用户状态")
    avatar_url: str | None = Field(None, description="头像URL")


# ============ 创建相关 Schema ============

class UserCreate(BaseModel):
    """创建用户请求"""
    name: str = Field(..., min_length=1, max_length=100, description="用户名")
    email: EmailStr = Field(..., description="邮箱")
    password: str = Field(..., min_length=6, max_length=100, description="密码")
    role: UserRole = Field(default=UserRole.EDITOR, description="用户角色")
    managed_site_ids: list[int] = Field(default=[], description="管理的站点ID列表")
    avatar_url: str | None = Field(None, description="头像URL")


class UserInvite(BaseModel):
    """邀请用户请求"""
    email: EmailStr = Field(..., description="邮箱")
    role: UserRole = Field(default=UserRole.EDITOR, description="用户角色")
    managed_site_ids: list[int] = Field(default=[], description="管理的站点ID列表")


# ============ 更新相关 Schema ============

class UserUpdate(BaseModel):
    """更新用户请求"""
    name: str | None = Field(None, min_length=1, max_length=100, description="用户名")
    email: EmailStr | None = Field(None, description="邮箱")
    role: UserRole | None = Field(None, description="用户角色")
    managed_site_ids: list[int] | None = Field(None, description="管理的站点ID列表")
    status: UserStatus | None = Field(None, description="用户状态")
    avatar_url: str | None = Field(None, description="头像URL")


class UserUpdatePassword(BaseModel):
    """更新用户密码请求"""
    old_password: str = Field(..., description="旧密码")
    new_password: str = Field(..., min_length=6, max_length=100, description="新密码")


class UserUpdateRole(BaseModel):
    """更新用户角色请求"""
    role: UserRole = Field(..., description="用户角色")


class UserUpdateSites(BaseModel):
    """更新用户管理的站点请求"""
    managed_site_ids: list[int] = Field(..., description="管理的站点ID列表")


class UserUpdateStatus(BaseModel):
    """更新用户状态请求"""
    status: UserStatus = Field(..., description="用户状态")


# ============ 响应相关 Schema ============

class UserResponse(BaseModel):
    """用户响应"""
    id: int
    name: str
    email: str
    role: UserRole
    managed_site_ids: list[int]
    status: UserStatus
    avatar_url: str | None = None
    last_login_at: datetime | None = None
    last_login_ip: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @field_validator('managed_site_ids', mode='before')
    @classmethod
    def parse_managed_sites(cls, v):
        """解析管理的站点ID"""
        if isinstance(v, str):
            if not v:
                return []
            return [int(sid) for sid in v.split(",") if sid.strip()]
        return v


class UserListItem(BaseModel):
    """用户列表项"""
    id: int
    name: str
    email: str
    role: UserRole
    managed_site_ids: list[int]
    status: UserStatus
    last_login_at: datetime | None = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator('managed_site_ids', mode='before')
    @classmethod
    def parse_managed_sites(cls, v):
        """解析管理的站点ID"""
        if isinstance(v, str):
            if not v:
                return []
            return [int(sid) for sid in v.split(",") if sid.strip()]
        return v


class UserListResponse(BaseModel):
    """用户列表响应"""
    total: int = Field(..., description="总数")
    list: builtins.list[UserListItem] = Field(..., description="用户列表")
    page: int = Field(..., description="当前页码")
    size: int = Field(..., description="每页数量")


# ============ 登录相关 Schema ============

class UserLogin(BaseModel):
    """用户登录请求"""
    email: EmailStr = Field(..., description="邮箱")
    password: str = Field(..., description="密码")


class UserLoginResponse(BaseModel):
    """用户登录响应"""
    token: str = Field(..., description="访问令牌")
    user: UserResponse = Field(..., description="用户信息")

