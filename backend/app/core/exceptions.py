"""
异常处理器和自定义异常类
"""
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings

# ========== 自定义异常类 ==========

class CatWikiError(Exception):
    """CatWiki 基础异常类"""
    def __init__(self, detail: str = "服务异常", status_code: int = 500):
        self.detail = detail
        self.status_code = status_code
        super().__init__(self.detail)


class NotFoundException(CatWikiError):
    """资源未找到异常 (404)"""
    def __init__(self, detail: str = "资源不存在"):
        super().__init__(detail=detail, status_code=status.HTTP_404_NOT_FOUND)


class BadRequestException(CatWikiError):
    """错误请求异常 (400)"""
    def __init__(self, detail: str = "请求参数错误"):
        super().__init__(detail=detail, status_code=status.HTTP_400_BAD_REQUEST)


class UnauthorizedException(CatWikiError):
    """未授权异常 (401)"""
    def __init__(self, detail: str = "未授权访问"):
        super().__init__(detail=detail, status_code=status.HTTP_401_UNAUTHORIZED)


class ForbiddenException(CatWikiError):
    """禁止访问异常 (403)"""
    def __init__(self, detail: str = "禁止访问"):
        super().__init__(detail=detail, status_code=status.HTTP_403_FORBIDDEN)


class ConflictException(CatWikiError):
    """冲突异常 (409)"""
    def __init__(self, detail: str = "资源冲突"):
        super().__init__(detail=detail, status_code=status.HTTP_409_CONFLICT)


class DatabaseException(CatWikiError):
    """数据库异常 (500)"""
    def __init__(self, detail: str = "数据库错误"):
        super().__init__(detail=detail, status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ServiceUnavailableException(CatWikiError):
    """服务不可用异常 (503)"""
    def __init__(self, detail: str = "服务不可用"):
        super().__init__(detail=detail, status_code=status.HTTP_503_SERVICE_UNAVAILABLE)


# ========== 异常处理器 ==========

def setup_exception_handlers(app: FastAPI):
    """配置全局异常处理器"""

    @app.exception_handler(CatWikiError)
    async def catwiki_exception_handler(request: Request, exc: CatWikiError):
        """CatWiki 自定义异常处理器"""
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "code": exc.status_code,
                "msg": exc.detail,
                "data": None,
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        """HTTP 异常处理器"""
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "code": exc.status_code,
                "msg": exc.detail,
                "data": None,
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        """请求验证异常处理器"""
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "code": 422,
                "msg": "请求参数验证失败",
                "data": {"errors": exc.errors()} if settings.DEBUG else None,
            },
        )
