# Copyright 2024 CatWiki Authors
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
"""

import hashlib
import re
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any

from jose import jwt
from jose.exceptions import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

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


# ==================== JWT Token 相关函数 ====================


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    创建 JWT access token

    Args:
        data: 要编码到 token 中的数据（通常是用户信息）
        expires_delta: token 过期时间增量，如果为 None 则使用配置的默认值

    Returns:
        JWT token 字符串
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict | None:
    """
    解码并验证 JWT access token

    Args:
        token: JWT token 字符串

    Returns:
        解码后的 token 数据，如果 token 无效或过期则返回 None
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def verify_token(token: str) -> bool:
    """
    验证 token 是否有效

    Args:
        token: JWT token 字符串

    Returns:
        如果 token 有效返回 True，否则返回 False
    """
    payload = decode_access_token(token)
    return payload is not None


# ==================== 文档处理工具函数 ====================


async def build_collection_map(
    db: AsyncSession, crud_collection, collection_ids: list[int]
) -> dict[int, dict]:
    """
    批量构建 collection 映射（包含祖先和路径信息），用于优化 N+1 查询

    Args:
        db: 数据库会话
        crud_collection: 合集 CRUD 实例
        collection_ids: 合集ID列表

    Returns:
        collection_id -> collection_info 的映射字典
    """
    if not collection_ids:
        return {}

    from sqlalchemy import select

    # 批量查询所有collection
    result = await db.execute(
        select(crud_collection.model).where(crud_collection.model.id.in_(collection_ids))
    )
    collections = list(result.scalars())

    # 构建collection映射，包含祖先和路径信息
    collections_map = {}
    for coll in collections:
        collections_map[coll.id] = {
            "id": coll.id,
            "title": coll.title,
            "parent_id": coll.parent_id,
            "ancestors": await crud_collection.get_ancestors(db, collection_id=coll.id),
            "path": await crud_collection.get_path(db, collection_id=coll.id),
        }

    return collections_map


async def enrich_document_dict(
    document,
    db: AsyncSession,
    crud_collection,
    include_site_name: bool = False,
    collection_map: dict[int, dict] | None = None,
) -> dict:
    """
    丰富文档字典，添加关联的合集信息和站点名称

    Args:
        document: 文档模型实例
        db: 数据库会话
        crud_collection: 合集 CRUD 实例
        include_site_name: 是否包含站点名称
        collection_map: 预加载的合集映射（用于优化性能）

    Returns:
        包含合集信息的文档字典
    """
    # 使用 __dict__.copy() 或手动构建字典
    if hasattr(document, "__dict__"):
        doc_dict = document.__dict__.copy()
    else:
        # 手动构建字典（适用于已序列化的对象）
        doc_dict = {
            "id": document.id,
            "title": document.title,
            "summary": getattr(document, "summary", None),
            "cover_image": getattr(document, "cover_image", None),
            "site_id": document.site_id,
            "collection_id": getattr(document, "collection_id", None),
            "category": getattr(document, "category", None),
            "author": getattr(document, "author", None),
            "status": getattr(document, "status", None),
            "tags": getattr(document, "tags", None),
            "views": getattr(document, "views", 0),
            "reading_time": getattr(document, "reading_time", None),
            "created_at": getattr(document, "created_at", None),
            "updated_at": getattr(document, "updated_at", None),
            "content": getattr(document, "content", None),
        }

    # 添加站点名称
    if include_site_name and hasattr(document, "site") and document.site:
        doc_dict["site_name"] = document.site.name

    # 添加合集对象
    collection_id = doc_dict.get("collection_id")
    if collection_id:
        # 优先使用预加载的 collection_map（性能优化）
        if collection_map and collection_id in collection_map:
            doc_dict["collection"] = collection_map[collection_id]
        else:
            # 回退到单独查询
            collection = await crud_collection.get(db, id=collection_id)
            if collection:
                doc_dict["collection"] = {
                    "id": collection.id,
                    "title": collection.title,
                    "parent_id": collection.parent_id,
                    "ancestors": await crud_collection.get_ancestors(
                        db, collection_id=collection_id
                    ),
                    "path": await crud_collection.get_path(db, collection_id=collection_id),
                }
            else:
                doc_dict["collection"] = None
    else:
        doc_dict["collection"] = None

    return doc_dict


# ==================== 脱敏工具函数 ====================

MASKED_VARIABLE = "********"


def mask_variable(value: str) -> str:
    """如果值存在且不为空，则返回掩码，否则返回原值"""
    if value and len(str(value)) > 0:
        return MASKED_VARIABLE
    return value


def mask_bot_config_inplace(config_value: dict) -> None:
    """对机器人配置进行原地脱敏处理"""
    if not config_value:
        return

    # 1. API Bot
    api_bot = config_value.get("apiBot", {})
    if api_bot:
        if "apiEndpoint" in api_bot:
            api_bot["apiEndpoint"] = mask_variable(api_bot["apiEndpoint"])
        if "apiKey" in api_bot:
            api_bot["apiKey"] = mask_variable(api_bot["apiKey"])

    # 2. WeCom Smart Robot
    wecom = config_value.get("wecomSmartRobot", {})
    if wecom:
        if "token" in wecom:
            wecom["token"] = mask_variable(wecom["token"])
        if "encodingAesKey" in wecom:
            wecom["encodingAesKey"] = mask_variable(wecom["encodingAesKey"])


def filter_client_site_data(site: Any) -> Any:
    """过滤客户端站点数据中的敏感信息"""
    if not site:
        return site

    # 处理机器人配置
    bot_config = getattr(site, "bot_config", None)
    if bot_config is None and isinstance(site, dict):
        bot_config = site.get("bot_config")

    if bot_config:
        # 仅保留 webWidget 配置，彻底移除 apiBot, wechat 和 wecomSmartRobot 等包含密钥的配置
        filtered_config = {}
        if "webWidget" in bot_config:
            filtered_config["webWidget"] = bot_config["webWidget"]

        if hasattr(site, "bot_config"):
            site.bot_config = filtered_config
        elif isinstance(site, dict):
            site["bot_config"] = filtered_config

    return site
