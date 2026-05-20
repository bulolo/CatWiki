# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""企业微信共享 HTTP 客户端。

为 ``WeComAppService`` / ``WeComKefuService`` 提供：

1. 单一 ``httpx.AsyncClient`` 实例（跨 send/sync 调用复用 TCP 连接）
2. 「附 ``access_token`` 调 POST/GET → 解析 ``errcode``」统一骨架
3. 后续接 retry / 限流 / metric 的拦截点

调用方约定：传 ``corp_id`` + ``secret``，本类向 ``WeComTokenManager`` 取 token
后发请求并校验 ``errcode``；失败时打 error log 但仍返回 dict，由调用方决定是否
重试 / 中断。
"""

import logging
from typing import Any

import httpx

from app.core.integration.robot.wecom_internals.utils import WeComTokenManager

logger = logging.getLogger(__name__)

WECOM_API_BASE = "https://qyapi.weixin.qq.com"


class WeComClient:
    """企业微信共享 HTTP 客户端（classmethod 容器）。

    本类不持有 corp_id / secret 等租户态 —— 每次调用按参数传入，
    多租户场景下不会泄漏。
    """

    _http_client: httpx.AsyncClient | None = None

    @classmethod
    def _get_http_client(cls) -> httpx.AsyncClient:
        if cls._http_client is None or cls._http_client.is_closed:
            cls._http_client = httpx.AsyncClient(timeout=10.0)
        return cls._http_client

    @classmethod
    async def aclose(cls) -> None:
        """关闭共享 client（包括 token manager 的 client），应在 lifecycle.shutdown 调用。"""
        if cls._http_client is not None and not cls._http_client.is_closed:
            await cls._http_client.aclose()
        cls._http_client = None
        # 同步关闭 token manager 的 httpx client（gettoken 专用）
        await WeComTokenManager.aclose()

    # ──────────────────────────────────────────────────────────────────────
    # 通用 HTTP 调用骨架
    # ──────────────────────────────────────────────────────────────────────

    @classmethod
    async def post_with_token(
        cls,
        path: str,
        *,
        corp_id: str,
        secret: str,
        json: dict[str, Any] | None = None,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """POST 企微接口，附带 ``access_token`` query 参数。

        返回 parsed JSON dict；``errcode != 0`` 时打 error log 但仍返回（调用方
        按业务语义判断成功/失败 / 是否重试）。

        path：以 ``/`` 开头的相对路径，会和 ``WECOM_API_BASE`` 拼接。
        """
        token = await WeComTokenManager.get_access_token(corp_id, secret)
        url = f"{WECOM_API_BASE}{path}"
        merged_params = {"access_token": token, **(params or {})}

        client = cls._get_http_client()
        resp = await client.post(url, json=json, params=merged_params)
        data = resp.json()
        if data.get("errcode", 0) != 0:
            logger.error(
                "企微 API 失败: path=%s errcode=%s errmsg=%s",
                path,
                data.get("errcode"),
                data.get("errmsg"),
            )
        return data

    @classmethod
    async def get_with_token(
        cls,
        path: str,
        *,
        corp_id: str,
        secret: str,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """GET 企微接口，附带 ``access_token`` query 参数。"""
        token = await WeComTokenManager.get_access_token(corp_id, secret)
        url = f"{WECOM_API_BASE}{path}"
        merged_params = {"access_token": token, **(params or {})}

        client = cls._get_http_client()
        resp = await client.get(url, params=merged_params)
        data = resp.json()
        if data.get("errcode", 0) != 0:
            logger.error(
                "企微 API 失败: path=%s errcode=%s errmsg=%s",
                path,
                data.get("errcode"),
                data.get("errmsg"),
            )
        return data

    # ──────────────────────────────────────────────────────────────────────
    # WeCom App（应用消息）
    # ──────────────────────────────────────────────────────────────────────

    @classmethod
    async def send_app_message(
        cls,
        *,
        corp_id: str,
        secret: str,
        agent_id: str | int,
        to_user: str,
        content: str,
    ) -> dict[str, Any]:
        """企微应用 → 单个用户发送文本消息。"""
        body = {
            "touser": to_user,
            "msgtype": "text",
            "agentid": agent_id,
            "text": {"content": content},
            "safe": 0,
            "enable_id_trans": 0,
            "enable_duplicate_check": 0,
        }
        return await cls.post_with_token(
            "/cgi-bin/message/send", corp_id=corp_id, secret=secret, json=body
        )

    # ──────────────────────────────────────────────────────────────────────
    # WeCom Kefu（客服消息）
    # ──────────────────────────────────────────────────────────────────────

    @classmethod
    async def sync_kefu_messages(
        cls,
        *,
        corp_id: str,
        secret: str,
        open_kfid: str,
        cursor: str | None = None,
        token: str = "",
        limit: int = 1000,
        voice_format: int = 0,
    ) -> dict[str, Any]:
        """企微客服 → 拉取消息流（cursor 模式）。"""
        body: dict[str, Any] = {
            "open_kfid": open_kfid,
            "limit": limit,
            "voice_format": voice_format,
        }
        if cursor:
            body["cursor"] = cursor
        if token:
            body["token"] = token
        return await cls.post_with_token(
            "/cgi-bin/kf/sync_msg", corp_id=corp_id, secret=secret, json=body
        )

    @classmethod
    async def send_kefu_message(
        cls,
        *,
        corp_id: str,
        secret: str,
        to_user: str,
        open_kfid: str,
        content: str,
    ) -> dict[str, Any]:
        """企微客服 → 向指定外部用户发送文本消息。"""
        body = {
            "touser": to_user,
            "open_kfid": open_kfid,
            "msgtype": "text",
            "text": {"content": content},
        }
        return await cls.post_with_token(
            "/cgi-bin/kf/send_msg", corp_id=corp_id, secret=secret, json=body
        )
