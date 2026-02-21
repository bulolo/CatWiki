from typing import Any

from app.core.integration.robot.dingtalk.client import DingTalkClient
from app.core.integration.robot.base import BaseRobotAdapter, RobotInboundEvent, RobotSession


class DingTalkAdapter(BaseRobotAdapter):
    """钉钉机器人适配器。"""

    def __init__(self, client: DingTalkClient | None = None) -> None:
        self.client = client or DingTalkClient()

    def get_provider_name(self) -> str:
        return "钉钉"

    def get_sync_interval(self) -> float:
        """钉钉对流式更新限频较严且卡片渲染稍慢，建议 0.8s 同步一次。"""
        return 0.8

    def parse_inbound_text_event(self, data: Any, site_id: int) -> RobotInboundEvent | None:
        import logging

        logger = logging.getLogger(__name__)

        message_type = (
            str(getattr(data, "message_type", "") or getattr(data, "msgtype", "")).strip().lower()
        )
        if message_type and message_type not in {"text", "richtext"}:
            return None

        text_obj = getattr(data, "text", None)
        text = (getattr(text_obj, "content", None) or "").strip()
        if not text and hasattr(data, "get_text_list"):
            try:
                text_list = data.get_text_list() or []
                text = "\n".join(
                    [str(item).strip() for item in text_list if str(item).strip()]
                ).strip()
            except Exception:
                logger.warning("钉钉文本提取失败: site_id=%s", site_id, exc_info=True)
        if not text and isinstance(data, dict):
            text = (data.get("text", {}) or {}).get("content", "").strip()
        if not text:
            return None

        from_user = (
            getattr(data, "sender_staff_id", None)
            or getattr(data, "sender_id", None)
            or getattr(data, "sender_nick", None)
            or "anonymous"
        )
        message_id = (
            getattr(data, "message_id", None)
            or getattr(data, "msg_id", None)
            or getattr(data, "process_query_key", None)
        )
        conversation_type = getattr(data, "conversation_type", None)
        conversation_id = getattr(data, "conversation_id", None)
        session_webhook = getattr(data, "session_webhook", None)
        sender_staff_id = getattr(data, "sender_staff_id", None)
        sender_nick = getattr(data, "sender_nick", None)

        return RobotInboundEvent(
            site_id=site_id,
            message_id=str(message_id) if message_id else None,
            from_user=str(from_user),
            content=text,
            raw_data=data,
            extra={
                "sender_nick": str(sender_nick) if sender_nick else None,
                "conversation_type": str(conversation_type)
                if conversation_type is not None
                else None,
                "conversation_id": str(conversation_id) if conversation_id else None,
                "session_webhook": str(session_webhook) if session_webhook else None,
                "sender_staff_id": str(sender_staff_id) if sender_staff_id else None,
                "at_user_ids": [str(sender_staff_id)] if sender_staff_id else None,
            },
        )

    async def reply(
        self,
        session: RobotSession,
        content: str,
        is_finish: bool = False,
        is_error: bool = False,
    ) -> None:
        """更新/回复钉钉消息。"""
        from app.core.integration.robot.dingtalk.types import DingTalkAdapterConfig

        if not isinstance(session.config, DingTalkAdapterConfig):
            raise ValueError("DingTalkAdapter requires DingTalkAdapterConfig")

        config = session.config
        client_id = config.client_id
        client_secret = config.client_secret
        template_id = config.template_id

        # 1. 如果配置了互动卡片模板，则走互动卡片流式逻辑
        if template_id and client_id and client_secret:
            await self._reply_card(session, content, is_finish, is_error)
            return

        # 2. 否则走普通 Webhook Markdown 回复（暂不支持流式，仅在完成时发送一次）
        if is_finish or is_error:
            session_webhook = session.event.extra.get("session_webhook")
            if not session_webhook:
                return

            display_content = content or "抱歉，我暂时无法回答这个问题。"
            if is_error:
                display_content = (
                    (content + "\n\n服务繁忙，请稍后再试。")
                    if content
                    else "服务繁忙，请稍后再试。"
                )

            await self.client.send_markdown_with_fallback(
                session_webhook=session_webhook,
                at_user_ids=session.event.extra.get("at_user_ids"),
                title="CatWiki 回复",
                markdown=display_content,
            )

    async def _reply_card(
        self,
        session: RobotSession,
        content: str,
        is_finish: bool = False,
        is_error: bool = False,
    ) -> None:
        from app.core.integration.robot.dingtalk.types import DingTalkAdapterConfig

        if not isinstance(session.config, DingTalkAdapterConfig):
            raise ValueError("DingTalkAdapter requires DingTalkAdapterConfig")

        config = session.config
        client_id = config.client_id
        client_secret = config.client_secret
        template_id = config.template_id

        if not session.context_id:
            # 初始化卡片
            card_instance_id = await self.client.create_streaming_card(
                client_id=client_id,
                client_secret=client_secret,
                template_id=template_id,
                event=session.event.raw_data,
                title="CatWiki",
            )
            session.context_id = card_instance_id
            session.config.last_content_len = 0

        if is_error:
            # 推送错误状态
            error_msg = (
                (content + "\n\n服务繁忙，请稍后再试。") if content else "服务繁忙，请稍后再试。"
            )
            await self.client.update_streaming_card(
                client_id=client_id,
                client_secret=client_secret,
                card_instance_id=session.context_id,
                content=error_msg,
                is_finalize=True,
                is_error=True,
            )
        elif is_finish:
            # 补发剩余增量
            last_len = session.config.last_content_len
            if len(content) > last_len:
                delta = content[last_len:]
                if delta:
                    await self.client.update_streaming_card(
                        client_id=client_id,
                        client_secret=client_secret,
                        card_instance_id=session.context_id,
                        content=delta,
                        is_full=False,
                        is_finalize=False,
                    )

            # 结束流式并置为完成态
            await self.client.update_streaming_card(
                client_id=client_id,
                client_secret=client_secret,
                card_instance_id=session.context_id,
                content="",
                is_full=False,
                is_finalize=True,
            )
            # 最终状态更新 (flowStatus=3)
            await self.client.update_card_instance(
                client_id=client_id,
                client_secret=client_secret,
                card_instance_id=session.context_id,
                card_param_map={
                    "flowStatus": "3",
                    "content": content,
                    "msgContent": content,
                    "markdown": content,
                },
            )
        else:
            # 增量推送
            last_len = session.config.last_content_len
            if len(content) <= last_len:
                return

            delta = content[last_len:]
            session.config.last_content_len = len(content)

            await self.client.update_streaming_card(
                client_id=client_id,
                client_secret=client_secret,
                card_instance_id=session.context_id,
                content=delta,
                is_full=False,
                is_finalize=False,
            )

    async def close(self) -> None:
        await self.client.close()
