from __future__ import annotations

import builtins
from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """通用 API 响应模型"""

    code: int = Field(default=0, description="响应码，0 表示成功")
    msg: str = Field(default="success", description="响应消息")
    data: T | None = Field(default=None, description="响应数据")

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def ok(cls, data: T | None = None, msg: str = "success", code: int = 0) -> ApiResponse[T]:
        """成功响应"""
        return cls(code=code, msg=msg, data=data)

    @classmethod
    def error(cls, msg: str = "error", code: int = 1, data: T | None = None) -> ApiResponse[T]:
        """错误响应"""
        return cls(code=code, msg=msg, data=data)


class ApiResponseModel(BaseModel):
    """非泛型版本的 API 响应模型，用于不需要指定具体数据类型的场景"""

    code: int = Field(default=0, description="响应码，0 表示成功")
    msg: str = Field(default="success", description="响应消息")
    data: Any | None = Field(default=None, description="响应数据")

    model_config = ConfigDict(from_attributes=True)


class PaginationInfo(BaseModel):
    """分页信息模型"""

    is_pager: int = Field(default=1, description="是否分页，1 表示是")
    page: int = Field(description="当前页码")
    size: int = Field(description="每页大小")
    total: int = Field(description="总记录数")

    model_config = ConfigDict(from_attributes=True)

    @property
    def total_pages(self) -> int:
        """总页数"""
        return (self.total + self.size - 1) // self.size if self.total > 0 else 0

    @property
    def has_next(self) -> bool:
        """是否有下一页"""
        return self.page < self.total_pages

    @property
    def has_prev(self) -> bool:
        """是否有上一页"""
        return self.page > 1


class PaginatedResponse(BaseModel, Generic[T]):
    """通用分页响应数据模型"""

    # 使用 typing.List 而不是 list，避免与 Pydantic 字段名 'list' 冲突
    list: builtins.list[T] = Field(description="数据列表")
    pagination: PaginationInfo = Field(description="分页信息")

    model_config = ConfigDict(from_attributes=True)


class HealthResponse(BaseModel):
    """健康检查响应"""

    status: str = Field(description="服务总体状态: healthy, degraded, unhealthy")
    version: str = Field(description="API 版本")
    environment: str = Field(description="运行环境")
    timestamp: str = Field(description="检查时间戳")
    checks: dict[str, str] = Field(description="各组件检查状态")

    model_config = ConfigDict(from_attributes=True)



# 向后兼容的别名
Response = ApiResponse

