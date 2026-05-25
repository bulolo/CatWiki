"""Telegram Bot API 轻量客户端（异步）。

只覆盖 CatWiki 接入需要的端点：getMe / sendMessage / editMessageText /
sendChatAction。其余能力按需后续补充。
"""

import asyncio
import logging
from typing import Any

import httpx

from app.core.integration.robot.types.telegram_app import DEFAULT_TELEGRAM_API_BASE

logger = logging.getLogger(__name__)

# Telegram 单条消息上限 4096，留 16 字符余量给截断提示
TELEGRAM_MAX_MESSAGE_LEN = 4080


class TelegramApiError(RuntimeError):
    """Telegram API 调用失败的统一异常。"""

    def __init__(
        self,
        method: str,
        status_code: int,
        description: str,
        error_code: int | None = None,
        retry_after: int | None = None,
    ) -> None:
        super().__init__(f"Telegram API {method} 失败: status={status_code} desc={description}")
        self.method = method
        self.status_code = status_code
        self.description = description
        self.error_code = error_code
        self.retry_after = retry_after


class TelegramClient:
    """Telegram Bot API 的异步客户端封装。

    线程模型：长轮询 worker 在独立线程里跑同步 `getUpdates`（见
    `connections/telegram_longpoll.py`），出站请求（sendMessage /
    editMessageText 等）一律由本类在主事件循环里异步发起。
    """

    def __init__(self) -> None:
        # 复用连接池；多个 site 共用同一个底层 httpx client
        self._http_client = httpx.AsyncClient(
            timeout=30.0,
            limits=httpx.Limits(max_connections=50, max_keepalive_connections=20),
        )
        self._lock = asyncio.Lock()
        self._closed = False

    async def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        await self._http_client.aclose()

    @staticmethod
    def _build_url(api_base_url: str, bot_token: str, method: str) -> str:
        base = (api_base_url or DEFAULT_TELEGRAM_API_BASE).rstrip("/")
        return f"{base}/bot{bot_token}/{method}"

    async def _call(
        self,
        *,
        api_base_url: str,
        bot_token: str,
        method: str,
        payload: dict[str, Any] | None = None,
        timeout: float | None = None,
    ) -> dict[str, Any]:
        url = self._build_url(api_base_url, bot_token, method)
        try:
            resp = await self._http_client.post(url, json=payload or {}, timeout=timeout)
        except httpx.HTTPError as e:
            raise TelegramApiError(method, 0, f"network error: {e}") from e

        try:
            data = resp.json()
        except ValueError as e:
            raise TelegramApiError(
                method, resp.status_code, f"non-json response: {resp.text[:200]}"
            ) from e

        if resp.status_code >= 400 or not data.get("ok"):
            description = str(data.get("description") or "unknown")
            error_code = data.get("error_code")
            retry_after = (data.get("parameters") or {}).get("retry_after")
            raise TelegramApiError(
                method=method,
                status_code=resp.status_code,
                description=description,
                error_code=error_code,
                retry_after=retry_after,
            )

        return data.get("result") or {}

    async def get_me(self, *, bot_token: str, api_base_url: str) -> dict[str, Any]:
        """启动自检：验证 bot_token 是否有效，返回 bot 信息（含 username）。"""
        return await self._call(
            api_base_url=api_base_url, bot_token=bot_token, method="getMe", timeout=10.0
        )

    async def send_message(
        self,
        *,
        bot_token: str,
        api_base_url: str,
        chat_id: int,
        text: str,
        reply_to_message_id: int | None = None,
    ) -> dict[str, Any]:
        """发送文本消息，返回完整 message 对象（含 message_id）。"""
        payload: dict[str, Any] = {
            "chat_id": chat_id,
            "text": text,
            "disable_web_page_preview": True,
        }
        if reply_to_message_id:
            payload["reply_to_message_id"] = reply_to_message_id
            payload["allow_sending_without_reply"] = True
        return await self._call(
            api_base_url=api_base_url, bot_token=bot_token, method="sendMessage", payload=payload
        )

    async def edit_message_text(
        self,
        *,
        bot_token: str,
        api_base_url: str,
        chat_id: int,
        message_id: int,
        text: str,
    ) -> dict[str, Any] | None:
        """编辑已发送的消息。

        对 "message is not modified" 与 "message to edit not found" 两类幂等错误
        静默吞掉，避免污染日志；其余错误向上抛 TelegramApiError。
        """
        payload = {
            "chat_id": chat_id,
            "message_id": message_id,
            "text": text,
            "disable_web_page_preview": True,
        }
        try:
            return await self._call(
                api_base_url=api_base_url,
                bot_token=bot_token,
                method="editMessageText",
                payload=payload,
            )
        except TelegramApiError as e:
            desc = (e.description or "").lower()
            if "not modified" in desc:
                return None
            raise

    async def send_chat_action(
        self,
        *,
        bot_token: str,
        api_base_url: str,
        chat_id: int,
        action: str = "typing",
    ) -> None:
        """通知用户 bot "正在输入"。失败时静默，纯 UX 增强。"""
        try:
            await self._call(
                api_base_url=api_base_url,
                bot_token=bot_token,
                method="sendChatAction",
                payload={"chat_id": chat_id, "action": action},
                timeout=5.0,
            )
        except TelegramApiError:
            pass
