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
统一日志配置模块
"""

import logging
import sys
from contextvars import ContextVar

from app.core.infra.config import settings

# 用于全链路追踪的 Request ID
request_id_var: ContextVar[str] = ContextVar("request_id", default="system")


class ColorFormatter(logging.Formatter):
    """
    带颜色的日志格式化器
    """

    grey = "\x1b[38;20m"
    green = "\x1b[32;20m"
    yellow = "\x1b[33;20m"
    red = "\x1b[31;20m"
    bold_red = "\x1b[31;1m"
    reset = "\x1b[0m"

    # 格式: 时间 | 级别 | [RequestID] | 模块:函数:行号 - 消息
    format_str = "%(asctime)s | %(levelname)-8s | [%(request_id)s] | %(name)s:%(funcName)s:%(lineno)d - %(message)s"

    FORMATS = {
        logging.DEBUG: grey + format_str + reset,
        logging.INFO: green + format_str + reset,
        logging.WARNING: yellow + format_str + reset,
        logging.ERROR: red + format_str + reset,
        logging.CRITICAL: bold_red + format_str + reset,
    }

    def format(self, record: logging.LogRecord) -> str:
        # 强制注入 request_id 字段
        record.request_id = request_id_var.get()
        log_fmt = self.FORMATS.get(record.levelno, self.format_str)
        formatter = logging.Formatter(log_fmt, datefmt="%Y-%m-%d %H:%M:%S")
        return formatter.format(record)


def setup_logging() -> None:
    """配置日志"""

    # 获取根日志记录器
    root_logger = logging.getLogger()
    root_logger.setLevel(settings.LOG_LEVEL)

    # 清除现有的 handlers
    root_logger.handlers = []

    # 创建控制台 handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(ColorFormatter())

    # 添加 handler
    root_logger.addHandler(console_handler)

    # 设置第三方库的日志级别和传播
    # 强制清除所有 logger 的 handlers（包括第三方库如 SQLAlchemy, Uvicorn 等）
    # 这样可以确保所有日志都由我们的 root logger 处理，格式统一
    loggers = [logging.getLogger(name) for name in logging.root.manager.loggerDict]
    for logger in loggers:
        logger.handlers = []
        logger.propagate = True

    # 抑制一些嘈杂的日志
    logging.getLogger("multipart").setLevel(logging.WARNING)

    # 抑制第三方 HTTP 库的 DEBUG 日志（httpcore, httpx, openai 等）
    # 这些库在 DEBUG 模式下会输出大量连接细节，通常不需要
    noisy_loggers = [
        "httpcore",
        "httpx",
        "openai",
        "openai._base_client",
        "httpcore.connection",
        "httpcore.http11",
        "hpack",
        "urllib3",
    ]
    for logger_name in noisy_loggers:
        logging.getLogger(logger_name).setLevel(logging.WARNING)

    # uvicorn 自带的 access log 会把每次健康检查/轮询接口都打一行；
    # 自家 middleware 已经覆盖了业务接口，这里只过滤高频轮询路径。
    _attach_uvicorn_access_filter()


class _SkipNoisyAccessPaths(logging.Filter):
    """uvicorn.access 行过滤器：丢掉指定路径的 access 记录。

    uvicorn.access 的 format 是 '%(client_addr)s - "%(request_line)s" %(status_code)s'。
    request_line 形如 'GET /v1/health HTTP/1.1'，直接对 message 字符串子串匹配即可。
    """

    SKIP_TOKENS: tuple[str, ...] = (" /v1/health ",)

    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        return not any(token in msg for token in self.SKIP_TOKENS)


def _attach_uvicorn_access_filter() -> None:
    """给 uvicorn.access logger 挂上 path 黑名单过滤器（幂等）。"""
    access_logger = logging.getLogger("uvicorn.access")
    # 避免重复添加（开发热重载场景 setup_logging 可能跑多次）
    if not any(isinstance(f, _SkipNoisyAccessPaths) for f in access_logger.filters):
        access_logger.addFilter(_SkipNoisyAccessPaths())
