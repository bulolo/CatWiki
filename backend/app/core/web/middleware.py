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
中间件配置
"""

import logging
import time
import uuid

from fastapi import status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.core.common.logger import request_id_var
from app.core.infra.config import settings

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware:
    """请求日志中间件 (避免使用 BaseHTTPMiddleware 以支持流式响应)"""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        # 生成并设置请求 ID
        request_id = str(uuid.uuid4())
        # 在 scope 中存储，方便后续获取
        scope["request_id"] = request_id

        token = request_id_var.set(request_id)
        start_time = time.time()

        # 记录请求开始
        path = scope.get("path", "")
        method = scope.get("method", "")
        # logger.info(f"🚀 {method} {path} [ID: {request_id}]")

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                # 添加响应头
                headers = list(message.get("headers", []))
                headers.append((b"X-Request-ID", request_id.encode()))
                process_time = time.time() - start_time
                headers.append((b"X-Process-Time", str(process_time).encode()))
                headers.append((b"X-Powered-By", b"CatWiki"))
                message["headers"] = headers

                # 记录请求结束日志
                status_code = message.get("status")
                logger.info(
                    f"{method} {path} - Completed in {process_time:.3f}s - Status: {status_code}"
                )

            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            request_id_var.reset(token)


class ErrorHandlingMiddleware:
    """全局错误处理中间件 (避免使用 BaseHTTPMiddleware)"""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        try:
            await self.app(scope, receive, send)
        except Exception as e:
            logger.error(f"未处理的异常: {e}", exc_info=True)
            response = JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "code": 500,
                    "msg": "服务器内部错误",
                    "data": {"detail": str(e)} if settings.DEBUG else None,
                },
            )
            await response(scope, receive, send)


def setup_middleware(app):
    """配置所有中间件"""

    # 代理头中间件（处理 Nginx 转发的 IP）
    # trusted_hosts=["*"] 表示信任所有上游代理（因为我们确实在 Nginx 后）
    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])

    # CORS 中间件
    cors_origins = settings.BACKEND_CORS_ORIGINS
    allow_credentials = True

    if settings.ENVIRONMENT != "prod":
        # 开发环境下，除了配置的源，还允许常见的本地开发地址
        # 别用 "*"，因为我们要开启 allow_credentials=True，必须指明具体源
        dev_origins = [
            "http://localhost:8001",
            "http://localhost:8002",
            "http://localhost:8003",
            "http://localhost:3000",
        ]
        cors_origins = list(set(cors_origins + dev_origins))
        allow_credentials = True

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=allow_credentials,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    # 请求日志中间件
    app.add_middleware(RequestLoggingMiddleware)

    # 错误处理中间件
    app.add_middleware(ErrorHandlingMiddleware)

    # 注册系统诊断模块 (moved to EE)
    # init_app_diagnostics(app)

    logger.info("中间件配置完成")
