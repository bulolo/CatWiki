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

from app.core.common.i18n import DEFAULT_LOCALE, SUPPORTED_LOCALES, _, set_locale
from app.core.common.logger import request_id_var
from app.core.infra.config import settings

logger = logging.getLogger(__name__)

# 高频轮询接口，access 日志会刷屏，跳过即可（uvicorn.access 的过滤器在 main.py 配）
_ACCESS_LOG_SKIP_PATHS: frozenset[str] = frozenset({"/v1/health"})


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
        skip_access_log = path in _ACCESS_LOG_SKIP_PATHS

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                # 添加响应头
                headers = list(message.get("headers", []))
                headers.append((b"X-Request-ID", request_id.encode()))
                process_time = time.time() - start_time
                headers.append((b"X-Process-Time", str(process_time).encode()))
                headers.append((b"X-Powered-By", b"CatWiki"))
                message["headers"] = headers

                # 记录请求结束日志（高频轮询接口跳过）
                if not skip_access_log:
                    status_code = message.get("status")
                    logger.info(
                        f"{method} {path} - Completed in {process_time:.3f}s - Status: {status_code}"
                    )

            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            request_id_var.reset(token)


def _parse_accept_language(header: str) -> str:
    """Parse Accept-Language header (e.g. 'en-US,zh;q=0.9,ja;q=0.8') and return best matching locale."""
    candidates = []
    for part in header.split(","):
        part = part.strip()
        if ";q=" in part:
            lang, q = part.split(";q=", 1)
            try:
                quality = float(q.strip())
            except ValueError:
                quality = 0.0
        else:
            lang, quality = part, 1.0
        lang = lang.strip().lower()
        candidates.append((lang, quality))
    candidates.sort(key=lambda x: x[1], reverse=True)
    for lang, _q in candidates:
        prefix = lang.split("-")[0]
        if prefix in SUPPORTED_LOCALES:
            return prefix
    return DEFAULT_LOCALE


class LocaleMiddleware:
    """语言国际化中间件"""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        # 从 Header 或 Cookie 中获取语言
        locale = DEFAULT_LOCALE
        accept_lang_header = None
        for name, value in scope.get("headers", []):
            if name == b"cookie":
                cookie_header = value.decode()
                if "NEXT_LOCALE=" in cookie_header:
                    parts = cookie_header.split("NEXT_LOCALE=")
                    if len(parts) > 1:
                        candidate = parts[1].split(";")[0].strip()
                        if candidate in SUPPORTED_LOCALES:
                            locale = candidate
                            break
            elif name == b"accept-language":
                accept_lang_header = value.decode()

        else:
            # Cookie 中未找到有效 locale，尝试从 Accept-Language 解析
            if accept_lang_header:
                locale = _parse_accept_language(accept_lang_header)

        set_locale(locale)
        await self.app(scope, receive, send)


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
                    "msg": _("error.internal"),
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

    # 注册中间件 (注意顺序)
    app.add_middleware(LocaleMiddleware)
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(ErrorHandlingMiddleware)

    # 注册系统诊断模块 (moved to EE)
    # init_app_diagnostics(app)

    logger.info("中间件配置完成")
