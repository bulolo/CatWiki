import asyncio
import json
import logging
import uuid
from collections.abc import Callable
from typing import Any

import websockets

from app.core.integration.robot.types.wecom_smart import WeComSmartLongConnConfig

logger = logging.getLogger(__name__)


class WeComSmartLongConnRegistry:
    """企微智能机器人长连接全局注册表，用于 Adapter 发送回复。"""

    _active_websockets: dict[int, websockets.WebSocketClientProtocol] = {}
    _lock = asyncio.Lock()

    @classmethod
    async def register(cls, site_id: int, ws: websockets.WebSocketClientProtocol) -> None:
        async with cls._lock:
            cls._active_websockets[site_id] = ws

    @classmethod
    async def unregister(cls, site_id: int) -> None:
        async with cls._lock:
            cls._active_websockets.pop(site_id, None)

    @classmethod
    async def send(cls, site_id: int, data: dict[str, Any]) -> bool:
        ws = cls._active_websockets.get(site_id)
        if ws is None:
            return False
        try:
            await ws.send(json.dumps(data, ensure_ascii=False))
            return True
        except Exception as e:
            logger.error("企微智能机器人长连接发送失败: site_id=%s, error=%s", site_id, e)
        return False


async def start_longconn_client(
    *,
    config: WeComSmartLongConnConfig,
    on_event: Callable[[str, dict[str, Any]], None],
) -> None:
    """启动企业微信智能机器人单次长连接 (WebSocket)，断开后直接返回，由调用方负责重连。

    注：callback 签名与 DingTalk / Feishu 的 ``start_longconn_client`` 不同 ——
    本平台原生事件按 ``cmd`` 区分多种类型（aibot_msg_callback / aibot_event_callback
    等），所以回调签名是 ``(cmd, data)`` 而非 ``(data)``。
    """
    uri = "wss://openws.work.weixin.qq.com"
    bot_id = config.bot_id
    secret = config.secret
    site_id = config.site_id

    async with websockets.connect(uri, ping_interval=None, ping_timeout=None) as websocket:
        # 发送订阅请求
        req_id = str(uuid.uuid4())
        subscribe_req = {
            "cmd": "aibot_subscribe",
            "headers": {"req_id": req_id},
            "body": {"bot_id": bot_id, "secret": secret},
        }
        await websocket.send(json.dumps(subscribe_req))
        logger.info("企微智能机器人长连接已发起订阅: site_id=%s, bot_id=%s", site_id, bot_id)

        # 注册连接供 Adapter 使用
        await WeComSmartLongConnRegistry.register(site_id, websocket)

        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                except json.JSONDecodeError:
                    logger.error("企微智能机器人长连接收到无效 JSON: %s", message)
                    continue

                cmd = data.get("cmd") or data.get("headers", {}).get("cmd")

                if cmd == "aibot_subscribe":
                    if data.get("errcode") == 0:
                        logger.info("企微智能机器人长连接订阅成功: site_id=%s", site_id)
                    else:
                        logger.error(
                            "企微智能机器人长连接订阅失败: site_id=%s, error=%s",
                            site_id,
                            data,
                        )
                        break  # 订阅失败，返回让调用方重连

                elif cmd in ("aibot_msg_callback", "aibot_event_callback"):
                    on_event(cmd, data)

                elif cmd == "aibot_ping":
                    ping_headers = data.get("headers", {})
                    pong = {
                        "cmd": "aibot_pong",
                        "headers": {"req_id": ping_headers.get("req_id")},
                    }
                    await websocket.send(json.dumps(pong))

                elif "errcode" in data and data.get("errcode") != 0:
                    logger.warning(
                        "企微智能机器人长连接收到错误响应: site_id=%s, data=%s",
                        site_id,
                        data,
                    )

        finally:
            await WeComSmartLongConnRegistry.unregister(site_id)
