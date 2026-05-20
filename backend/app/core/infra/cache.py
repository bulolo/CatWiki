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
系统通用缓存管理模块 (General Purpose System Cache)

支持多种缓存后端：
1. 内存缓存 (InMemoryCache): 适用于单实例、小规模数据，零配置。
2. Redis 缓存 (RedisCache): 适用于分布式环境、大规模数据及持久化需求。

提供了统一的抽象接口 BaseCache，支持 CRUD 数据缓存、API 响应缓存以及业务逻辑缓存。
"""

import asyncio
import functools
import hashlib
import json
import logging
import pickle
import time
from abc import ABC, abstractmethod
from collections import OrderedDict
from collections.abc import Callable
from typing import Any, TypeVar

import redis.asyncio as redis

from app.core.infra.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T")

# 内部哨兵对象，用于准确区分“缓存缺失”与“缓存值为 None”
_UNDEFINED = object()


class BaseCache(ABC):
    """缓存后端抽象基类"""

    @abstractmethod
    async def get(self, key: str, default: Any = None) -> Any | None:
        """获取缓存值"""
        pass

    @abstractmethod
    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """设置缓存值"""
        pass

    async def get_or_set(self, key: str, func: Callable[..., Any], ttl: int | None = None) -> Any:
        """
        [封装逻辑] 先获取缓存，若缺失则执行函数并写入缓存。

        防惊群：冷启动 / TTL 过期瞬间，N 个并发请求会同时检测到 miss。
        通过 per-key 锁 + double-check 把 fetcher 调用收敛为 1 次。
        InMemoryCache 用 asyncio.Lock；RedisCache 用分布式锁（30s 自释放，
        防止 worker 崩溃造成永久阻塞）。
        """
        val = await self.get(key, default=_UNDEFINED)
        if val is not _UNDEFINED:
            return val

        lock = self.lock(f"cache_fill:{key}", timeout=30)
        async with lock:
            # Double-check after acquiring the lock — the previous holder may
            # have already filled the cache while we were waiting.
            val = await self.get(key, default=_UNDEFINED)
            if val is not _UNDEFINED:
                return val

            if asyncio.iscoroutinefunction(func):
                result = await func()
            else:
                result = func()

            await self.set(key, result, ttl=ttl)
            return result

    @abstractmethod
    async def delete(self, key: str) -> None:
        """删除缓存值"""
        pass

    @abstractmethod
    async def delete_by_prefix(self, prefix: str) -> None:
        """根据前缀批量删除缓存"""
        pass

    @abstractmethod
    async def clear(self) -> None:
        """清空缓存库"""
        pass

    @abstractmethod
    def stats(self) -> dict[str, Any]:
        """获取统计信息"""
        pass

    @abstractmethod
    async def close(self) -> None:
        """关闭缓存连接，释放资源"""
        pass

    @abstractmethod
    def lock(self, name: str, timeout: int = 10):
        """获取一个互斥锁（分布式锁）"""
        pass


class InMemoryCache(BaseCache):
    """
    基于 OrderedDict 实现的进程内 LRU 内存缓存。
    特点：极速、无外部依赖，但不支持多进程/多容器共享。
    """

    def __init__(self, max_size: int = 1000, default_ttl: int = 300):
        self._data: OrderedDict[str, tuple[Any, float]] = OrderedDict()
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._hits = 0
        self._misses = 0
        self._locks: dict[str, asyncio.Lock] = {}
        self._cleanup_counter = 0  # 写操作计数器，用于触发主动清理

    def _maybe_cleanup_expired(self) -> None:
        """每 100 次写操作主动清理过期条目，避免内存泄漏"""
        self._cleanup_counter += 1
        if self._cleanup_counter < 100:
            return
        self._cleanup_counter = 0
        now = time.time()
        expired = [k for k, (_, exp) in self._data.items() if now >= exp]
        for k in expired:
            del self._data[k]

    async def get(self, key: str, default: Any = None) -> Any | None:
        if key in self._data:
            value, expire_time = self._data[key]
            if time.time() < expire_time:
                self._data.move_to_end(key)
                self._hits += 1
                return value
            else:
                del self._data[key]
                logger.debug(f"Memory cache expired: {key}")

        self._misses += 1
        return default

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        ttl = ttl if ttl is not None else self.default_ttl
        expire_time = time.time() + ttl

        if key in self._data:
            del self._data[key]
        elif len(self._data) >= self.max_size:
            self._data.popitem(last=False)

        self._data[key] = (value, expire_time)
        self._maybe_cleanup_expired()

    async def delete(self, key: str) -> None:
        self._data.pop(key, None)

    async def delete_by_prefix(self, prefix: str) -> None:
        to_delete = [k for k in self._data.keys() if k.startswith(prefix)]
        for k in to_delete:
            self._data.pop(k, None)
        logger.debug(f"Memory cache keys with prefix '{prefix}' deleted.")

    async def clear(self) -> None:
        self._data.clear()
        self._locks.clear()
        logger.info("Memory cache totally cleared.")

    def stats(self) -> dict[str, Any]:
        total = self._hits + self._misses
        return {
            "backend": "memory",
            "size": len(self._data),
            "max_size": self.max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": f"{(self._hits / total * 100):.2f}%" if total > 0 else "0%",
        }

    async def close(self) -> None:
        await self.clear()

    def lock(self, name: str, timeout: int = 10):
        if name not in self._locks:
            self._locks[name] = asyncio.Lock()
        return self._locks[name]


class RedisCache(BaseCache):
    """
    基于 Redis 实现的分布式缓存。
    特点：多实例共享、持久化。默认使用 pickle 进行全序列化存储。
    """

    def __init__(self, redis_url: str, prefix: str = "catwiki:", default_ttl: int = 300):
        self.client = redis.from_url(redis_url, decode_responses=False)
        self.prefix = prefix
        self.default_ttl = default_ttl

    def _get_full_key(self, key: str) -> str:
        return f"{self.prefix}{key}"

    async def get(self, key: str, default: Any = None) -> Any | None:
        full_key = self._get_full_key(key)
        try:
            data = await self.client.get(full_key)
            return pickle.loads(data) if data is not None else default
        except Exception as e:
            logger.error(f"Redis get failed [{key}]: {e}")
            return default

    async def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        full_key = self._get_full_key(key)
        ttl = ttl if ttl is not None else self.default_ttl
        try:
            await self.client.set(full_key, pickle.dumps(value), ex=ttl)
        except Exception as e:
            logger.error(f"Redis set failed [{key}]: {e}")

    async def delete(self, key: str) -> None:
        try:
            await self.client.delete(self._get_full_key(key))
        except Exception as e:
            logger.error(f"Redis delete failed [{key}]: {e}")

    async def delete_by_prefix(self, prefix: str) -> None:
        full_prefix = self._get_full_key(prefix)
        try:
            cursor = 0
            count = 0
            while True:
                cursor, keys = await self.client.scan(cursor=cursor, match=f"{full_prefix}*")
                if keys:
                    await self.client.delete(*keys)
                    count += len(keys)
                if cursor == 0:
                    break
            logger.info(
                f"Redis cache keys with prefix '{prefix}' (full: '{full_prefix}') removed: {count} keys."
            )
        except Exception as e:
            logger.error(f"Redis delete_by_prefix failed [{prefix}]: {e}")

    async def clear(self) -> None:
        try:
            cursor = 0
            count = 0
            while True:
                cursor, keys = await self.client.scan(cursor=cursor, match=f"{self.prefix}*")
                if keys:
                    await self.client.delete(*keys)
                    count += len(keys)
                if cursor == 0:
                    break
            logger.info(f"Redis cache flushed: {count} keys removed.")
        except Exception as e:
            logger.error(f"Redis clear failed: {e}")

    def stats(self) -> dict[str, Any]:
        return {
            "backend": "redis",
            "prefix": self.prefix,
            "status": "connected" if self.client else "disconnected",
        }

    async def async_stats(self) -> dict[str, Any]:
        """异步获取 Redis 详细统计信息（含命中率）"""
        try:
            info = await self.client.info("stats")
            hits = info.get("keyspace_hits", 0)
            misses = info.get("keyspace_misses", 0)
            total = hits + misses
            return {
                "backend": "redis",
                "prefix": self.prefix,
                "status": "connected",
                "hits": hits,
                "misses": misses,
                "hit_rate": f"{(hits / total * 100):.2f}%" if total > 0 else "0%",
            }
        except Exception as e:
            logger.error(f"Redis async_stats failed: {e}")
            return self.stats()

    async def close(self) -> None:
        if self.client:
            await self.client.aclose()

    def lock(self, name: str, timeout: int = 10):
        return self.client.lock(f"{self.prefix}lock:{name}", timeout=timeout)


# ==================== 管理函数与单例 ====================

_cache_instance: BaseCache | None = None


def get_cache() -> BaseCache:
    """获取缓存驱动实例（单例）"""
    global _cache_instance
    if _cache_instance is None:
        if settings.REDIS_ENABLED and settings.REDIS_URL:
            _cache_instance = RedisCache(
                redis_url=settings.REDIS_URL,
                prefix=settings.REDIS_PREFIX,
                default_ttl=settings.CACHE_DEFAULT_TTL,
            )
            logger.info("🚀 Global cache initialized: REDIS")
        else:
            _cache_instance = InMemoryCache(max_size=1000, default_ttl=settings.CACHE_DEFAULT_TTL)
            logger.info("🏠 Global cache initialized: IN-MEMORY")
    return _cache_instance


def generate_cache_key(prefix: str, *args, **kwargs) -> str:
    """
    生成稳定的哈希缓存键。
    支持基础类型及简单的集合类型（list/dict）。
    同时自动注入当前租户 ID 以实现隔离。
    """
    from app.core.infra.tenant import get_current_tenant

    tenant_id = get_current_tenant()

    def normalize(v: Any) -> Any:
        if isinstance(v, str | int | float | bool) or v is None:
            return v
        if isinstance(v, list | tuple | set):
            return [normalize(i) for i in v]
        if isinstance(v, dict):
            # 对 Dictionary 进行 Key 排序，保证哈希一致性
            return {str(k): normalize(v[k]) for k in sorted(v.keys())}
        # 其他复杂对象（如 DB Session）在生成 Key 时会被忽略其内部状态
        return f"__skipped_{type(v).__name__}__"

    key_data = {
        "tenant_id": tenant_id,
        "prefix": prefix,
        "args": [normalize(a) for a in args],
        "kwargs": normalize(kwargs),
    }

    # 使用 JSON 序列化保证一致性后计算 MD5
    raw_str = json.dumps(key_data, sort_keys=True)
    return f"{prefix}:t{tenant_id or 'all'}:{hashlib.md5(raw_str.encode()).hexdigest()[:16]}"


def cached(ttl: int | None = None, key_prefix: str | None = None, cache_none: bool = False):
    """
    通用异步缓存装饰器。

    支持功能：
    - 并发降级保护（业务执行不因缓存报错而挂掉）。
    - 稳定哈希键生成。
    - cache_none: 是否缓存 None 结果，默认 False 避免缓存穿透反转。
    """
    cache_ttl = ttl if ttl is not None else settings.CACHE_DEFAULT_TTL

    def decorator(func: Callable) -> Callable:
        prefix = key_prefix or func.__name__

        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            cache_key = generate_cache_key(prefix, *args, **kwargs)
            cache = get_cache()

            # 1. 尝试读取
            try:
                cached_val = await cache.get(cache_key, default=_UNDEFINED)
                if cached_val is not _UNDEFINED:
                    logger.debug(f"Cache Hit: {cache_key}")
                    return cached_val
            except Exception as e:
                logger.warning(f"Cache access error (fell back to business logic): {e}")

            # 2. 执行业务逻辑
            result = await func(*args, **kwargs)

            # 3. 回写（默认不缓存 None，避免缓存穿透反转）
            if result is not None or cache_none:
                try:
                    await cache.set(cache_key, result, ttl=cache_ttl)
                except Exception as e:
                    logger.warning(f"Cache write error: {e}")

            return result

        return wrapper

    return decorator
