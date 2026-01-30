"""
API 响应缓存工具

提供轻量级的内存缓存功能，适用于不经常变动的数据
"""
import functools
import hashlib
import logging
import time
from collections import OrderedDict
from collections.abc import Callable
from typing import Any

logger = logging.getLogger(__name__)


class SimpleCache:
    """简单的 LRU 内存缓存"""

    def __init__(self, max_size: int = 1000, default_ttl: int = 300):
        """
        初始化缓存

        Args:
            max_size: 最大缓存条目数
            default_ttl: 默认过期时间（秒）
        """
        self.cache: OrderedDict[str, tuple[Any, float]] = OrderedDict()
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._hits = 0
        self._misses = 0

    def get(self, key: str) -> Any | None:
        """获取缓存值"""
        if key in self.cache:
            value, expire_time = self.cache[key]
            if time.time() < expire_time:
                # 将访问的项移到末尾（LRU）
                self.cache.move_to_end(key)
                self._hits += 1
                logger.debug(f"缓存命中: {key}")
                return value
            else:
                # 过期，删除
                del self.cache[key]
                logger.debug(f"缓存过期: {key}")

        self._misses += 1
        logger.debug(f"缓存未命中: {key}")
        return None

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """设置缓存值"""
        if ttl is None:
            ttl = self.default_ttl

        expire_time = time.time() + ttl

        # 如果已存在，先删除（稍后会重新添加到末尾）
        if key in self.cache:
            del self.cache[key]

        # 如果超过最大大小，删除最老的条目（头部）
        elif len(self.cache) >= self.max_size:
            oldest_key = next(iter(self.cache))
            del self.cache[oldest_key]
            logger.debug(f"缓存已满，删除最老条目: {oldest_key}")

        self.cache[key] = (value, expire_time)
        logger.debug(f"缓存设置: {key}, TTL: {ttl}s")

    def delete(self, key: str) -> None:
        """删除缓存值"""
        if key in self.cache:
            del self.cache[key]
            logger.debug(f"缓存删除: {key}")

    def clear(self) -> None:
        """清空所有缓存"""
        self.cache.clear()
        logger.info("缓存已清空")

    def stats(self) -> dict[str, int]:
        """获取缓存统计信息"""
        return {
            "size": len(self.cache),
            "max_size": self.max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": self._hits / (self._hits + self._misses) if (self._hits + self._misses) > 0 else 0,
        }


# 全局缓存实例
_cache = SimpleCache(max_size=1000, default_ttl=300)


def get_cache() -> SimpleCache:
    """获取全局缓存实例"""
    return _cache


def generate_cache_key(prefix: str, *args, **kwargs) -> str:
    """
    生成缓存键

    Args:
        prefix: 键前缀（通常是函数名或端点路径）
        *args, **kwargs: 函数参数

    Returns:
        缓存键字符串
    """
    # 将参数转换为可哈希的字符串
    key_parts = [prefix]

    # 添加位置参数
    for arg in args:
        if hasattr(arg, '__dict__'):
            # 跳过复杂对象（如数据库会话）
            continue
        key_parts.append(str(arg))

    # 添加关键字参数（排序以保证一致性）
    for k, v in sorted(kwargs.items()):
        if hasattr(v, '__dict__'):
            # 跳过复杂对象
            continue
        key_parts.append(f"{k}:{v}")

    # 生成简短的哈希键
    key_str = "|".join(key_parts)
    return f"{prefix}:{hashlib.md5(key_str.encode()).hexdigest()[:16]}"


def cached_response(ttl: int = 300, key_prefix: str | None = None):
    """
    API 响应缓存装饰器

    Args:
        ttl: 缓存过期时间（秒），默认 5 分钟
        key_prefix: 缓存键前缀，默认使用函数名

    Example:
        @cached_response(ttl=600)
        async def get_site(...):
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # 生成缓存键
            prefix = key_prefix or func.__name__
            cache_key = generate_cache_key(prefix, *args, **kwargs)

            # 尝试从缓存获取
            cache = get_cache()
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                logger.info(f"API 缓存命中: {prefix}")
                return cached_value

            # 执行原函数
            result = await func(*args, **kwargs)

            # 存入缓存
            cache.set(cache_key, result, ttl=ttl)
            logger.info(f"API 结果已缓存: {prefix}, TTL: {ttl}s")

            return result

        return wrapper
    return decorator
