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
通用工具函数

子模块:
- auth: JWT 认证 (create_access_token, decode_access_token, verify_token)
- document_utils: 文档处理 (build_collection_map, enrich_document_dict)
- masking: 数据脱敏 (mask_bot_config_inplace, filter_client_site_data, mask_variable)
"""

import hashlib
import re
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any

from app.core.infra.config import settings  # noqa: F401 (部分调用方通过 utils 间接依赖)

NAMESPACE_CATWIKI = uuid.uuid5(uuid.NAMESPACE_DNS, "catwiki.com")


def get_vector_id(doc_id: int) -> str:
    """生成确定性的 UUID（基于文档 ID）"""
    return str(uuid.uuid5(NAMESPACE_CATWIKI, str(doc_id)))


def generate_token(length: int = 32) -> str:
    """生成随机令牌"""
    return secrets.token_urlsafe(length)


def hash_string(text: str) -> str:
    """生成字符串的 SHA256 哈希"""
    return hashlib.sha256(text.encode()).hexdigest()


def is_valid_email(email: str) -> bool:
    """验证邮箱格式"""
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, email))


def format_datetime(dt: datetime, fmt: str = "%Y-%m-%d %H:%M:%S") -> str:
    """格式化日期时间"""
    return dt.strftime(fmt)


def parse_datetime(dt_str: str, fmt: str = "%Y-%m-%d %H:%M:%S") -> datetime:
    """解析日期时间字符串"""
    return datetime.strptime(dt_str, fmt)


def get_future_datetime(days: int = 0, hours: int = 0, minutes: int = 0) -> datetime:
    """获取未来的日期时间"""
    return datetime.utcnow() + timedelta(days=days, hours=hours, minutes=minutes)


def truncate_string(text: str, max_length: int = 100, suffix: str = "...") -> str:
    """截断字符串"""
    if len(text) <= max_length:
        return text
    return text[: max_length - len(suffix)] + suffix


def remove_none_values(data: dict[str, Any]) -> dict[str, Any]:
    """移除字典中的 None 值"""
    return {k: v for k, v in data.items() if v is not None}


class Paginator:
    """分页器"""

    def __init__(self, page: int = 1, size: int = 10, total: int = 0):
        self.page = max(1, page)
        self.size = max(1, size)
        self.total = max(0, total)

    @property
    def skip(self) -> int:
        """跳过的记录数"""
        return (self.page - 1) * self.size

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

    def to_dict(self) -> dict[str, Any]:
        """转换为字典"""
        return {
            "page": self.page,
            "size": self.size,
            "total": self.total,
            "total_pages": self.total_pages,
            "has_next": self.has_next,
            "has_prev": self.has_prev,
        }

    def to_pagination_info(self):
        """转换为 PaginationInfo 模型"""
        from app.schemas.response import PaginationInfo

        return PaginationInfo(
            is_pager=1,
            page=self.page,
            size=self.size,
            total=self.total,
        )
