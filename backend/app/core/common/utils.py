# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""通用工具函数（datetime / hash / token / 文本处理）。

本模块只承载真正"项目无关"的小工具。专题相关的 helper 已经拆到同包内的独立
文件：

- ``pagination``      —— ``Paginator`` 分页器
- ``chat_timing``     —— Chat 请求 timing 埋点（``start/mark/emit_chat_timing``）
- ``ai_logging``      —— AI provider 观测日志（``log_ai_usage_signal`` 等）+
                         ``rag_stats_var``
- ``auth``            —— JWT (``create_access_token`` / ``decode_access_token`` /
                         ``verify_token``)
- ``document_utils``  —— 文档增强 (``build_collection_map`` / ``enrich_document_dict``)
- ``masking``         —— 数据脱敏
"""

import hashlib
import re
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any

# UUID namespace for deterministic ID generation across the project
NAMESPACE_CATWIKI = uuid.uuid5(uuid.NAMESPACE_DNS, "catwiki.com")


def get_vector_id(doc_id: int) -> str:
    """生成确定性的 UUID（基于文档 ID）。"""
    return str(uuid.uuid5(NAMESPACE_CATWIKI, str(doc_id)))


def generate_token(length: int = 32) -> str:
    """生成随机令牌。"""
    return secrets.token_urlsafe(length)


def hash_string(text: str) -> str:
    """生成字符串的 SHA256 哈希。"""
    return hashlib.sha256(text.encode()).hexdigest()


def is_valid_email(email: str) -> bool:
    """验证邮箱格式。"""
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, email))


def format_datetime(dt: datetime, fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
    """格式化日期时间。"""
    return dt.strftime(fmt)


def parse_datetime(dt_str: str, fmt: str = "%Y-%m-%d %H:%M:%S") -> datetime:
    """解析日期时间字符串。"""
    return datetime.strptime(dt_str, fmt)


def get_future_datetime(days: int = 0, hours: int = 0, minutes: int = 0) -> datetime:
    """获取未来的日期时间。"""
    return datetime.utcnow() + timedelta(days=days, hours=hours, minutes=minutes)


def truncate_string(text: str, max_length: int = 100, suffix: str = "...") -> str:
    """截断字符串。"""
    if len(text) <= max_length:
        return text
    return text[: max_length - len(suffix)] + suffix


def strip_markdown(text: str) -> str:
    r"""去除 Markdown 格式，降级为纯文本。

    用于不支持 Markdown 渲染的推送通道（微信客服 / 短信 / 飞书非 Markdown 模式等）。

    规则：
    1. 链接 ``[desc](url)`` → ``desc (url)``
    2. 图片 ``![desc](url)`` → ``[图片: desc]``
    3. 标题 ``#`` 去除
    4. 加粗 / 斜体 ``**/*`` 去除
    5. 行内代码 (单反引号) 去除
    6. 代码块 (三反引号) 去除（保留缩进，移除语言标识）
    7. 清理多余的连续空白行
    """
    if not text:
        return ""

    text = re.sub(r"\[([^\]]+)\]\((https?://[^\)]+)\)", r"\1 (\2)", text)
    text = re.sub(r"!\[([^\]]*)\]\((https?://[^\)]+)\)", r"[图片: \1]", text)
    text = re.sub(r"^#+\s*(.*)$", r"\1", text, flags=re.MULTILINE)
    text = re.sub(r"[*_]{1,3}(.*?)[*_]{1,3}", r"\1", text)
    text = re.sub(r"`(.*?)`", r"\1", text)
    text = re.sub(r"```(?:\w+\n)?([\s\S]*?)```", r"\1", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def remove_none_values(data: dict[str, Any]) -> dict[str, Any]:
    """移除字典中的 None 值。"""
    return {k: v for k, v in data.items() if v is not None}
