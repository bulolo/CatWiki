import asyncio
import json
import logging
import threading
import time
from collections import OrderedDict
from typing import Any, Optional

import httpx
import xml.etree.cElementTree as ET

from app.core.integration.robot.base import MessageDeduplicator, RobotInboundEvent, RobotSession
from app.core.integration.robot.wecom_common.utils import WeComTokenManager
from app.models.site import Site
from app.services.robot import RobotOrchestrator

logger = logging.getLogger(__name__)


class WeComKefuService:
    """企业微信客服业务逻辑。"""

    _token_manager = WeComTokenManager()
    _deduplicator = MessageDeduplicator()
    # 消息游标缓存，key: open_kfid
    _cursors: dict[str, str] = {}

    # 同步锁，防止同一个客服 ID 多个同步任务同时运行
    _sync_locks: dict[str, asyncio.Lock] = {}
    # 记录是否已发送欢迎语，避免同一会话重复发送 (可选)
    _welcome_sent: dict[str, float] = {}

    @classmethod
    def _get_lock(cls, open_kfid: str) -> asyncio.Lock:
        if open_kfid not in cls._sync_locks:
            cls._sync_locks[open_kfid] = asyncio.Lock()
        return cls._sync_locks[open_kfid]

    @classmethod
    async def sync_messages(
        cls,
        site: Site,
        bot_config: dict,
        open_kfid: str,
        background_tasks: Any,
        notification_token: str = "",
    ) -> None:
        """从微信侧拉取客服消息"""
        # 获取并发锁，确保同一个 kfid 同时只有一个同步任务
        lock = cls._get_lock(open_kfid)
        if lock.locked():
            logger.debug(f"⏳ [WeComKefu] Sync is already running for {open_kfid}, skipping...")
            return

        async with lock:
            corp_id = bot_config.get("corp_id")
            secret = bot_config.get("secret")
            if not corp_id or not secret:
                logger.error("WeComKefu: 缺少 corp_id 或 secret，无法完成消息同步")
                return

            try:
                token = await cls._token_manager.get_access_token(corp_id, secret)
                has_more = True
                current_token = notification_token

                # 最多同步 10 轮，防止死循环
                max_rounds = 10
                round_count = 0

                while has_more and round_count < max_rounds:
                    round_count += 1
                    cursor = cls._cursors.get(open_kfid, "")

                    async with httpx.AsyncClient() as client:
                        body = {"limit": 100, "open_kfid": open_kfid}
                        if cursor:
                            body["cursor"] = cursor
                        if current_token:
                            body["token"] = current_token
                        resp = await client.post(
                            "https://qyapi.weixin.qq.com/cgi-bin/kf/sync_msg",
                            params={"access_token": token},
                            json=body,
                            timeout=10,
                        )
                        data = resp.json()
                        if data.get("errcode") != 0:
                            logger.error(f"同步客服消息失败: {data}")
                            break

                        new_cursor = data.get("next_cursor")
                        if new_cursor:
                            cls._cursors[open_kfid] = new_cursor

                        msg_list = data.get("msg_list", [])
                        for msg in msg_list:
                            msg_id = msg.get("msgid")
                            if msg_id and cls._deduplicator.is_duplicate(msg_id):
                                continue

                            # origin: 3表示客户发送，1,2表示客服/机器人，4表示系统
                            origin = msg.get("origin", 3)
                            if origin != 3:
                                # 系统事件 (origin=4) 需要特殊处理，其他的跳过
                                if origin == 4 and msg.get("msgtype") == "event":
                                    event_data = msg.get("event", {})
                                    if event_data.get("event") == "enter_session":
                                        await cls.handle_welcome_event(
                                            site,
                                            msg.get("external_userid"),
                                            open_kfid,
                                            background_tasks,
                                        )
                                continue

                            msg_type = msg.get("msgtype")
                            from_user = msg.get("external_userid")

                            if msg_type == "text":
                                content = msg.get("text", {}).get("content", "")
                                if from_user and content:
                                    await cls.handle_text_message(
                                        site=site,
                                        from_user=from_user,
                                        open_kfid=open_kfid,
                                        content=content,
                                        background_tasks=background_tasks,
                                    )
                            else:
                                logger.info(
                                    f"ℹ️ [WeComKefu] Received unsupported msg_type in sync: {msg_type}"
                                )
                                if from_user:
                                    await cls.send_message(
                                        corp_id=corp_id,
                                        secret=secret,
                                        open_kfid=open_kfid,
                                        external_userid=from_user,
                                        content="[系统消息] 我目前只能理解文字信息，请使用文字与我沟通。",
                                    )

                        has_more = data.get("has_more") == 1
                        # 只有第一轮可以使用 notification_token
                        current_token = ""

                if round_count >= max_rounds:
                    logger.warning(
                        f"⚠️ [WeComKefu] Sync reached max rounds ({max_rounds}) for {open_kfid}"
                    )

            except Exception as e:
                logger.error(f"同步微信客服消息时发生异常: {e}")

    @classmethod
    async def send_message(
        cls, corp_id: str, secret: str, open_kfid: str, external_userid: str, content: str
    ) -> None:
        """调用微信客服 API 发送消息"""
        try:
            token = await cls._token_manager.get_access_token(corp_id, secret)
            async with httpx.AsyncClient() as client:
                body = {
                    "touser": external_userid,
                    "open_kfid": open_kfid,
                    "msgtype": "text",
                    "text": {"content": content},
                }
                resp = await client.post(
                    "https://qyapi.weixin.qq.com/cgi-bin/kf/send_msg",
                    params={"access_token": token},
                    json=body,
                    timeout=10,
                )
                data = resp.json()
                if data.get("errcode") != 0:
                    logger.error(f"发送微信客服消息失败: {data}")
        except Exception as e:
            logger.error(f"发送微信客服消息发生异常: {e}")

    @classmethod
    def verify_url(
        cls, crypt: Any, msg_signature: str, timestamp: str, nonce: str, echostr: str
    ) -> str:
        """验证企业微信客服回调 URL"""
        ret, decrypted_echostr = crypt.VerifyURL(msg_signature, timestamp, nonce, echostr)
        if ret != 0:
            logger.error(f"企业微信客服回调 URL 验证失败: 错误码={ret}")
            raise ValueError(f"验证失败: {ret}")
        return decrypted_echostr

    @classmethod
    async def process_webhook(
        cls,
        site: Site,
        crypt: Any,
        post_data: bytes,
        msg_signature: str,
        timestamp: str,
        nonce: str,
        background_tasks: Any,
    ) -> str:
        """处理企业微信客服 Webhook 消息"""
        ret, msg_body = crypt.DecryptMsg(post_data, msg_signature, timestamp, nonce)
        if ret != 0:
            logger.error(f"企业微信客服消息解密失败: 错误码={ret}")
            raise ValueError(f"解密失败: {ret}")

        logger.debug(f"📩 [WeComKefu] Decrypted message: {msg_body}")

        try:
            xml_tree = ET.fromstring(msg_body)
            msg_type = xml_tree.find("MsgType").text
            msg_id = xml_tree.find("MsgId").text if xml_tree.find("MsgId") is not None else None

            # 1. 去重逻辑
            if msg_id and cls._deduplicator.is_duplicate(msg_id):
                logger.info("微信客服忽略重复消息: msg_id=%s", msg_id)
                return "success"

            # 微信客服消息事件类型
            if msg_type == "event":
                event_node = xml_tree.find("Event")
                event = event_node.text if event_node is not None else ""
                logger.debug(f"📬 [WeComKefu] Received event: {event}")
                if event == "kf_msg_or_event":
                    open_kfid_node = xml_tree.find("OpenKfId")
                    if open_kfid_node is None:
                        open_kfid_node = xml_tree.find("OpenKFID")
                    open_kfid = open_kfid_node.text if open_kfid_node is not None else None
                    token_node = xml_tree.find("Token")
                    token = token_node.text if token_node is not None else ""
                    if open_kfid:
                        # 开启后台任务异步拉取
                        background_tasks.add_task(
                            cls.sync_messages,
                            site=site,
                            bot_config=site.bot_config.get("wecom_kefu", {}),
                            open_kfid=open_kfid,
                            background_tasks=background_tasks,
                            notification_token=token,
                        )
                    return "success"

            # 具体的客服消息内容
            # 这里处理最常见的文本消息
            from_user_node = xml_tree.find("ExternalUserID")
            from_user = from_user_node.text if from_user_node is not None else None

            open_kfid_node = xml_tree.find("OpenKfId")
            if open_kfid_node is None:
                open_kfid_node = xml_tree.find("OpenKFID")
            open_kfid = open_kfid_node.text if open_kfid_node is not None else None

            content_node = xml_tree.find("Text/Content")
            content = content_node.text if content_node is not None else ""

            if from_user and open_kfid and content:
                logger.info(
                    f"💬 [WeComKefu] Handling direct text message from {from_user} via {open_kfid}"
                )
                await cls.handle_text_message(
                    site=site,
                    from_user=from_user,
                    open_kfid=open_kfid,
                    content=content,
                    background_tasks=background_tasks,
                )

        except Exception as e:
            logger.error(f"解析企业微信客服 XML 消息失败: {e}")
            # 即使解析失败也返回 success 避免微信重试

        return "success"

    @classmethod
    async def handle_welcome_event(
        cls, site: Site, from_user: str, open_kfid: str, background_tasks: Any
    ) -> None:
        """处理用户进入会话事件（发送欢迎语）"""
        bot_config = site.bot_config.get("wecom_kefu", {})
        welcome_msg = bot_config.get("welcome_message")
        if not welcome_msg:
            return

        # 简单的频率限制，1分钟内只发一次欢迎语，避免刷屏
        last_sent = cls._welcome_sent.get(from_user, 0)
        if time.time() - last_sent < 60:
            return
        cls._welcome_sent[from_user] = time.time()

        await cls.send_message(
            corp_id=bot_config.get("corp_id"),
            secret=bot_config.get("secret"),
            open_kfid=open_kfid,
            external_userid=from_user,
            content=welcome_msg,
        )

    @classmethod
    async def handle_text_message(
        cls, site: Site, from_user: str, open_kfid: str, content: str, background_tasks: Any
    ) -> None:
        """处理文本消息：启动编排"""
        bot_config = site.bot_config.get("wecom_kefu", {})

        inbound_event = RobotInboundEvent(
            site_id=site.id,
            message_id=None,
            from_user=from_user,
            content=content,
            extra={"open_kfid": open_kfid},
        )

        from app.core.integration.robot.factory import RobotFactory

        adapter = RobotFactory.get_adapter("wecom_kefu")
        session = RobotSession(
            event=inbound_event,
            context_id=f"kf_{from_user}",
            config=bot_config,
        )

        background_tasks.add_task(
            RobotOrchestrator.orchestrate_reply,
            adapter=adapter,
            session=session,
            background_tasks=background_tasks,
        )
