import asyncio
import logging
import time
import xml.etree.ElementTree as ET
from typing import Any

from app.core.integration.robot.base import MessageDeduplicator, RobotInboundEvent, RobotSession
from app.core.integration.robot.clients.wecom import WeComClient
from app.models.site import Site
from app.services.robot import RobotOrchestrator

logger = logging.getLogger(__name__)


def _safe_create_task(coro, *, name: str | None = None) -> asyncio.Task:
    """创建后台任务并自动记录未捕获的异常。"""
    task = asyncio.create_task(coro, name=name)
    task.add_done_callback(
        lambda t: logger.error("后台任务异常 [%s]: %s", t.get_name(), t.exception())
        if not t.cancelled() and t.exception()
        else None
    )
    return task


class WeComKefuService:
    """企业微信客服业务逻辑。"""

    _deduplicator = MessageDeduplicator()
    # 消息游标缓存，key 形如 ``{site_id}:{open_kfid}``
    _cursors: dict[str, str] = {}
    _MAX_CURSORS = 500

    # 同步锁，确保同一 (site, kfid) 同时只有一个 sync_messages 任务
    _sync_locks: dict[str, asyncio.Lock] = {}
    _MAX_SYNC_LOCKS = 500
    # 欢迎语去重：1 分钟窗口内同一会话只发一次
    _welcome_sent: dict[str, float] = {}
    _MAX_WELCOME_CACHE = 5000

    @classmethod
    def _get_lock(cls, site_id: int, open_kfid: str) -> asyncio.Lock:
        lock_key = f"{site_id}:{open_kfid}"
        if lock_key not in cls._sync_locks:
            # 防止锁字典无限增长：淘汰未被持有的旧锁
            if len(cls._sync_locks) >= cls._MAX_SYNC_LOCKS:
                stale = [k for k, v in cls._sync_locks.items() if not v.locked()]
                for k in stale[: len(stale) // 2]:
                    del cls._sync_locks[k]
            cls._sync_locks[lock_key] = asyncio.Lock()
        return cls._sync_locks[lock_key]

    @classmethod
    def _cleanup_welcome_cache(cls) -> None:
        """清理过期的欢迎语缓存条目（保留最近的一半）。"""
        if len(cls._welcome_sent) <= cls._MAX_WELCOME_CACHE:
            return
        sorted_keys = sorted(cls._welcome_sent, key=cls._welcome_sent.get)
        for k in sorted_keys[: len(sorted_keys) // 2]:
            del cls._welcome_sent[k]

    @classmethod
    async def sync_messages(
        cls,
        site: Site,
        bot_config: dict,
        open_kfid: str,
        notification_token: str = "",
    ) -> None:
        """从微信侧拉取客服消息"""
        # 获取并发锁，确保同一个 kfid 同时只有一个同步任务
        lock = cls._get_lock(site.id, open_kfid)
        if lock.locked():
            logger.debug(
                "⏳ [WeComKefu] Sync is already running for site_id=%s kfid=%s, skipping...",
                site.id,
                open_kfid,
            )
            return

        async with lock:
            corp_id = bot_config.get("corp_id")
            secret = bot_config.get("secret")
            if not corp_id or not secret:
                logger.error("WeComKefu: 缺少 corp_id 或 secret，无法完成消息同步")
                return

            try:
                has_more = True
                current_token = notification_token

                # 最多同步 10 轮，防止死循环
                max_rounds = 10
                round_count = 0

                while has_more and round_count < max_rounds:
                    round_count += 1
                    cursor_key = f"{site.id}:{open_kfid}"
                    cursor = cls._cursors.get(cursor_key, "")

                    data = await WeComClient.sync_kefu_messages(
                        corp_id=corp_id,
                        secret=secret,
                        open_kfid=open_kfid,
                        cursor=cursor or None,
                        token=current_token,
                        limit=100,
                    )
                    if data.get("errcode") != 0:
                        # errcode 已由 WeComClient 打 error log，这里只需中断轮次
                        break

                    new_cursor = data.get("next_cursor")
                    if new_cursor:
                        if len(cls._cursors) >= cls._MAX_CURSORS:
                            # 淘汰最早的一半
                            keys = list(cls._cursors.keys())
                            for k in keys[: len(keys) // 2]:
                                del cls._cursors[k]
                        cls._cursors[cursor_key] = new_cursor

                    msg_list = data.get("msg_list", [])
                    for msg in msg_list:
                        msg_id = msg.get("msgid")
                        if msg_id:
                            dedupe_key = f"{site.id}:{msg_id}"
                            if cls._deduplicator.is_duplicate(dedupe_key):
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
                                )
                        else:
                            logger.info(
                                "ℹ️ [WeComKefu] Received unsupported msg_type in sync: %s", msg_type
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
                        "⚠️ [WeComKefu] Sync reached max rounds (%d) for %s", max_rounds, open_kfid
                    )

            except Exception as e:
                logger.error("同步微信客服消息时发生异常: %s", e)

    @classmethod
    async def send_message(
        cls, corp_id: str, secret: str, open_kfid: str, external_userid: str, content: str
    ) -> None:
        """调用微信客服 API 发送消息。

        HTTP / token / errcode 由 ``WeComClient.send_kefu_message`` 统一处理。
        """
        try:
            from app.core.common.utils import strip_markdown

            # 微信客服接口原生不支持 Markdown，发送前需剥离格式
            clean_content = strip_markdown(content)

            await WeComClient.send_kefu_message(
                corp_id=corp_id,
                secret=secret,
                to_user=external_userid,
                open_kfid=open_kfid,
                content=clean_content,
            )
        except Exception as e:
            logger.error("发送微信客服消息发生异常: %s", e)

    @classmethod
    def verify_url(
        cls, crypt: Any, msg_signature: str, timestamp: str, nonce: str, echostr: str
    ) -> str:
        """验证企业微信客服回调 URL"""
        ret, decrypted_echostr = crypt.VerifyURL(msg_signature, timestamp, nonce, echostr)
        if ret != 0:
            logger.error("企业微信客服回调 URL 验证失败: 错误码=%s", ret)
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
    ) -> str:
        """处理企业微信客服 Webhook 消息"""
        ret, msg_body = crypt.DecryptMsg(post_data, msg_signature, timestamp, nonce)
        if ret != 0:
            logger.error("企业微信客服消息解密失败: 错误码=%s", ret)
            raise ValueError(f"解密失败: {ret}")

        logger.debug("📩 [WeComKefu] Decrypted message: %s", msg_body)

        try:
            xml_tree = ET.fromstring(msg_body)
            msg_type = xml_tree.find("MsgType").text
            msg_id = xml_tree.find("MsgId").text if xml_tree.find("MsgId") is not None else None

            if cls._deduplicator.check_and_log_duplicate(site.id, msg_id, "微信客服"):
                return "success"

            if msg_type == "event":
                event_node = xml_tree.find("Event")
                event = event_node.text if event_node is not None else ""
                logger.debug("📬 [WeComKefu] Received event: %s", event)
                if event == "kf_msg_or_event":
                    open_kfid_node = xml_tree.find("OpenKfId")
                    if open_kfid_node is None:
                        open_kfid_node = xml_tree.find("OpenKFID")
                    open_kfid = open_kfid_node.text if open_kfid_node is not None else None
                    token_node = xml_tree.find("Token")
                    token = token_node.text if token_node is not None else ""
                    if open_kfid:
                        _safe_create_task(
                            cls.sync_messages(
                                site=site,
                                bot_config=site.bot_config.get("wecom_kefu", {}),
                                open_kfid=open_kfid,
                                notification_token=token,
                            ),
                            name=f"wecom_kefu_sync_{open_kfid}",
                        )
                    return "success"

            # 直接客服文本消息（非 kf_msg_or_event 事件）
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
                    "💬 [WeComKefu] Handling direct text message from %s via %s",
                    from_user,
                    open_kfid,
                )
                _safe_create_task(
                    cls.handle_text_message(
                        site=site,
                        from_user=from_user,
                        open_kfid=open_kfid,
                        content=content,
                    ),
                    name=f"wecom_kefu_msg_{from_user}",
                )

        except Exception as e:
            logger.error("解析企业微信客服 XML 消息失败: %s", e)
            # 即使解析失败也返回 success 避免微信重试

        return "success"

    @classmethod
    async def handle_welcome_event(cls, site: Site, from_user: str, open_kfid: str) -> None:
        """处理用户进入会话事件（发送欢迎语）"""
        bot_config = site.bot_config.get("wecom_kefu", {})
        welcome_msg = bot_config.get("welcome_message")
        if not welcome_msg:
            return

        # 简单的频率限制，1分钟内只发一次欢迎语，避免刷屏
        welcome_key = f"{site.id}:{from_user}"
        last_sent = cls._welcome_sent.get(welcome_key, 0)
        if time.time() - last_sent < 60:
            return
        cls._welcome_sent[welcome_key] = time.time()
        cls._cleanup_welcome_cache()

        await cls.send_message(
            corp_id=bot_config.get("corp_id"),
            secret=bot_config.get("secret"),
            open_kfid=open_kfid,
            external_userid=from_user,
            content=welcome_msg,
        )

    @classmethod
    async def handle_text_message(
        cls, site: Site, from_user: str, open_kfid: str, content: str
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

        await RobotOrchestrator.orchestrate_as_task(
            adapter=adapter,
            session=session,
        )
