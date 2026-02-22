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

from fastapi import Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.core.common.logger import request_id_var
from app.core.infra.config import settings

logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """请求日志中间件"""

    async def dispatch(self, request: Request, call_next):
        # 生成并设置请求 ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        token = request_id_var.set(request_id)

        # 记录请求开始
        start_time = time.time()
        logger.info(
            f"{request.method} {request.url.path} "
            f"- Client: {request.client.host if request.client else 'unknown'}"
        )

        # 处理请求
        response = await call_next(request)

        # 记录请求结束
        process_time = time.time() - start_time
        logger.info(f"Completed in {process_time:.3f}s - Status: {response.status_code}")

        # 添加请求 ID 到响应头
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = str(process_time)
        response.headers["X-Powered-By"] = "CatWiki"

        # 重置 ContextVar
        request_id_var.reset(token)

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

    # 代理头中间件（处理 Nginx 转发的 IP）
    # trusted_hosts=["*"] 表示信任所有上游代理（因为我们确实在 Nginx 后）
    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])

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

    # 注册系统诊断模块 (moved to EE)
    # init_app_diagnostics(app)

    logger.info("中间件配置完成")
