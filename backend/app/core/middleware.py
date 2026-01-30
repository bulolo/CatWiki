"""
中间件配置
"""
import logging
import time
import uuid

from fastapi import Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """请求日志中间件"""

    async def dispatch(self, request: Request, call_next):
        # 生成请求 ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        # 记录请求开始
        start_time = time.time()
        logger.info(
            f"[{request_id}] {request.method} {request.url.path} "
            f"- Client: {request.client.host if request.client else 'unknown'}"
        )

        # 处理请求
        response = await call_next(request)

        # 记录请求结束
        process_time = time.time() - start_time
        logger.info(
            f"[{request_id}] Completed in {process_time:.3f}s "
            f"- Status: {response.status_code}"
        )

        # 添加请求 ID 到响应头
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = str(process_time)

        return response


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """全局错误处理中间件"""

    async def dispatch(self, request: Request, call_next):
        try:
            return await call_next(request)
        except Exception as e:
            logger.error(f"未处理的异常: {e}", exc_info=True)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "code": 500,
                    "msg": "服务器内部错误",
                    "data": {"detail": str(e)} if settings.DEBUG else None,
                },
            )


def setup_middleware(app):
    """配置所有中间件"""

    # CORS 中间件
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 请求日志中间件
    app.add_middleware(RequestLoggingMiddleware)

    # 错误处理中间件
    app.add_middleware(ErrorHandlingMiddleware)

    logger.info("中间件配置完成")

