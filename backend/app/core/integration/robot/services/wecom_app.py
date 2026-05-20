# Copyright 2026 CatWiki Authors

import asyncio
import logging
import xml.etree.ElementTree as ET
from typing import Any

from app.core.integration.robot.base import MessageDeduplicator, RobotInboundEvent, RobotSession
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


class WeComAppService:
    """企业微信应用(机器人)业务逻辑。"""

    _deduplicator = MessageDeduplicator()

    @classmethod
    async def send_message(
        cls, corp_id: str, secret: str, agent_id: str | int, to_user: str, content: str
    ) -> None:
        """调用企业微信 API 发送应用消息 (支持多租户配置)。

        HTTP / token / errcode 由 ``WeComClient.send_app_message`` 统一处理；
        本方法仅在异常时打日志，不重新抛（webhook 回调路径不希望因为发送失败
        导致整体回包失败）。
        """
        from app.core.integration.robot.clients.wecom import WeComClient

        try:
            await WeComClient.send_app_message(
                corp_id=corp_id,
                secret=secret,
                agent_id=agent_id,
                to_user=to_user,
                content=content,
            )
        except Exception as e:
            logger.error("发送企业微信应用消息发生异常: %s", e)

    @classmethod
    def verify_url(
        cls, crypt: Any, msg_signature: str, timestamp: str, nonce: str, echostr: str
    ) -> str:
        """验证企业微信应用回调 URL"""
        ret, decrypted_echostr = crypt.VerifyURL(msg_signature, timestamp, nonce, echostr)
        if ret != 0:
            logger.error("企业微信应用回调 URL 验证失败: 错误码=%s", ret)
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
        """处理企业微信应用 Webhook 消息 (XML 协议)"""
        ret, msg_body = crypt.DecryptMsg(post_data, msg_signature, timestamp, nonce)
        if ret != 0:
            logger.error("企业微信应用消息解密失败: 错误码=%s", ret)
            raise ValueError(f"解密失败: {ret}")

        try:
            xml_tree = ET.fromstring(msg_body)
            msg_type = xml_tree.find("MsgType").text
            msg_id = xml_tree.find("MsgId").text if xml_tree.find("MsgId") is not None else None
            from_user = (
                xml_tree.find("FromUserName").text
                if xml_tree.find("FromUserName") is not None
                else None
            )
            agent_id = (
                xml_tree.find("AgentID").text if xml_tree.find("AgentID") is not None else None
            )

            if cls._deduplicator.check_and_log_duplicate(site.id, msg_id, "企业微信应用"):
                return "success"

            if msg_type == "text":
                content_node = xml_tree.find("Content")
                content = content_node.text if content_node is not None else ""

                if from_user and content:
                    _safe_create_task(
                        cls.handle_text_message(
                            site=site,
                            from_user=from_user,
                            agent_id=agent_id,
                            content=content,
                        ),
                        name=f"wecom_app_msg_{from_user}",
                    )

        except Exception as e:
            logger.error("解析企业微信应用 XML 消息失败: %s", e)

        return "success"

    @classmethod
    async def handle_text_message(
        cls, site: Site, from_user: str, agent_id: str, content: str
    ) -> None:
        """启动统一编排逻辑"""
        bot_config = site.bot_config.get("wecom_app", {})

        inbound_event = RobotInboundEvent(
            site_id=site.id,
            message_id=None,
            from_user=from_user,
            content=content,
            extra={"agent_id": agent_id},
        )

        from app.core.integration.robot.factory import RobotFactory

        adapter = RobotFactory.get_adapter("wecom_app")
        session = RobotSession(
            event=inbound_event,
            context_id=f"app_{from_user}",
            config=bot_config,
        )

        await RobotOrchestrator.orchestrate_as_task(
            adapter=adapter,
            session=session,
        )
