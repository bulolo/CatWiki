import asyncio
import json
import time

import httpx


class FeishuClient:
    """飞书 OpenAPI 轻量客户端（含 token 缓存）。"""

    FEISHU_BASE_URL = "https://open.feishu.cn/open-apis"

    def __init__(self) -> None:
        self._token_cache: dict[str, dict[str, float | str]] = {}
        self._token_lock = asyncio.Lock()
        self._http_client = httpx.AsyncClient(
            timeout=30.0, limits=httpx.Limits(max_connections=50, max_keepalive_connections=20)
        )

    async def close(self) -> None:
        """关闭客户端，释放连接池资源。"""
        await self._http_client.aclose()

    async def get_tenant_access_token(self, app_id: str, app_secret: str) -> str:
        now = time.time()
        cache_key = f"{app_id}:{app_secret}"
        cached = self._token_cache.get(cache_key)
        if cached:
            token = cached.get("token")
            expires_at = float(cached.get("expires_at", 0))
            if isinstance(token, str) and token and expires_at - now > 60:
                return token

        url = f"{self.FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal"
        payload = {"app_id": app_id, "app_secret": app_secret}

        async with self._token_lock:
            now = time.time()
            cached = self._token_cache.get(cache_key)
            if cached:
                token = cached.get("token")
                expires_at = float(cached.get("expires_at", 0))
                if isinstance(token, str) and token and expires_at - now > 60:
                    return token

            resp = await self._http_client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()

        if data.get("code") != 0 or not data.get("tenant_access_token"):
            msg = data.get("msg", "failed to fetch tenant_access_token")
            raise RuntimeError(f"飞书鉴权失败: {msg}")

        token = data["tenant_access_token"]
        expire_seconds = int(data.get("expire", 7200) or 7200)
        self._token_cache[cache_key] = {
            "token": token,
            "expires_at": now + max(expire_seconds, 120),
        }
        return token

    async def send_card_message(
        self, tenant_access_token: str, receive_id_type: str, receive_id: str, card_content: dict
    ) -> str:
        """发送消息卡片，返回 message_id。"""
        url = f"{self.FEISHU_BASE_URL}/im/v1/messages?receive_id_type={receive_id_type}"
        headers = {"Authorization": f"Bearer {tenant_access_token}"}
        payload = {
            "receive_id": receive_id,
            "msg_type": "interactive",
            "content": json.dumps(card_content, ensure_ascii=False),
        }

        resp = await self._http_client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()

        if data.get("code") != 0:
            msg = data.get("msg", "send card failed")
            raise RuntimeError(f"飞书发送卡片失败: code={data.get('code')} msg={msg}")

        return data["data"]["message_id"]

    async def update_card_message(
        self, tenant_access_token: str, message_id: str, card_content: dict
    ) -> None:
        """更新消息卡片内容。"""
        url = f"{self.FEISHU_BASE_URL}/im/v1/messages/{message_id}"
        headers = {"Authorization": f"Bearer {tenant_access_token}"}
        payload = {
            "content": json.dumps(card_content, ensure_ascii=False),
        }

        resp = await self._http_client.patch(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()

        if data.get("code") != 0:
            msg = data.get("msg", "update card failed")
            raise RuntimeError(f"飞书更新卡片失败: code={data.get('code')} msg={msg}")
