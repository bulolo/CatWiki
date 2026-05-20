# Copyright 2026 CatWiki Authors
import asyncio
import logging
import time
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class WeComTokenManager:
    """企业微信 Access Token 管理器 (带缓存)。"""

    _cache: dict[str, dict[str, Any]] = {}
    _MAX_CACHE_SIZE = 200
    _lock: asyncio.Lock | None = None
    _http_client: httpx.AsyncClient | None = None

    @classmethod
    def _get_lock(cls) -> asyncio.Lock:
        if cls._lock is None:
            cls._lock = asyncio.Lock()
        return cls._lock

    @classmethod
    def _get_http_client(cls) -> httpx.AsyncClient:
        if cls._http_client is None or cls._http_client.is_closed:
            cls._http_client = httpx.AsyncClient(timeout=10.0)
        return cls._http_client

    @classmethod
    async def aclose(cls) -> None:
        """关闭 gettoken 用的 httpx client，应在 lifecycle.shutdown 调用。"""
        if cls._http_client is not None and not cls._http_client.is_closed:
            await cls._http_client.aclose()
        cls._http_client = None

    @classmethod
    async def get_access_token(cls, corp_id: str, secret: str) -> str:
        """获取微信 access_token (带缓存)"""
        cache_key = f"{corp_id}:{secret}"
        now = time.time()

        # 快速路径：无锁检查缓存
        if cache_key in cls._cache:
            cache = cls._cache[cache_key]
            if now < cache["expires_at"]:
                return cache["token"]

        async with cls._get_lock():
            # 双重检查：获取锁后再次验证
            now = time.time()
            if cache_key in cls._cache:
                cache = cls._cache[cache_key]
                if now < cache["expires_at"]:
                    return cache["token"]

            client = cls._get_http_client()
            resp = await client.get(
                "https://qyapi.weixin.qq.com/cgi-bin/gettoken",
                params={"corpid": corp_id, "corpsecret": secret},
            )
            data = resp.json()
            if data.get("errcode") != 0:
                logger.error("获取企业微信 Access Token 失败: %s", data)
                raise ValueError(f"获取 Access Token 失败: {data.get('errmsg')}")

            token = data["access_token"]
            # 提前 5 分钟过期
            expires_at = now + data["expires_in"] - 300
            # 淘汰过期条目，防止缓存无限增长
            if len(cls._cache) >= cls._MAX_CACHE_SIZE:
                expired = [k for k, v in cls._cache.items() if now >= v["expires_at"]]
                for k in expired:
                    del cls._cache[k]
            cls._cache[cache_key] = {"token": token, "expires_at": expires_at}
            return token
