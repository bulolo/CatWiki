from typing import Any

from app.core.integration.robot.base import BaseRobotAdapter, RobotInboundEvent, RobotSession
from app.core.integration.robot.feishu.client import FeishuClient


class FeishuAdapter(BaseRobotAdapter):
    """飞书机器人适配器。"""

    def __init__(self, client: FeishuClient | None = None) -> None:
        self.client = client or FeishuClient()

    def get_provider_name(self) -> str:
        return "飞书"

    def get_sync_interval(self) -> float:
        """飞书接口响应较快，建议 0.5s 同步一次以保证流畅度。"""
        return 0.5

    def parse_inbound_text_event(self, data: Any, site_id: int) -> RobotInboundEvent | None:
        import json
        import logging

        logger = logging.getLogger(__name__)

        message = getattr(getattr(data, "event", None), "message", None)
        sender = getattr(getattr(data, "event", None), "sender", None)
        if message is None or message.message_type != "text":
            return None

        content_raw = message.content or ""
        try:
            text = (json.loads(content_raw).get("text") or "").strip()
        except Exception:
            logger.warning("飞书消息内容解析失败，忽略: content=%s", str(content_raw)[:200])
            return None
        if not text:
            return None

        sender_id = getattr(sender, "sender_id", None)
        from_user = (
            getattr(sender_id, "open_id", None)
            or getattr(sender_id, "user_id", None)
            or getattr(sender_id, "union_id", None)
            or "anonymous"
        )
        chat_type = (message.chat_type or "").lower()
        chat_id = message.chat_id
        if not chat_id:
            return None

        sender_open_id = getattr(sender_id, "open_id", None)
        if chat_type == "p2p" and sender_open_id:
            receive_id_type = "open_id"
            receive_id = sender_open_id
        else:
            receive_id_type = "chat_id"
            receive_id = chat_id

        message_id = (
            getattr(message, "message_id", None)
            or getattr(message, "id", None)
            or getattr(getattr(data, "header", None), "event_id", None)
        )
        sender_type = getattr(sender, "sender_type", None)

        return RobotInboundEvent(
            site_id=site_id,
            message_id=str(message_id) if message_id else None,
            from_user=from_user,
            content=text,
            raw_data=data,
            extra={
                "receive_id_type": receive_id_type,
                "receive_id": receive_id,
                "sender_type": sender_type,
            },
        )

    async def reply(
        self,
        session: RobotSession,
        content: str,
        is_finish: bool = False,
        is_error: bool = False,
    ) -> None:
        """更新飞书消息卡片。"""
        from app.core.integration.robot.feishu.types import FeishuAdapterConfig

        if not isinstance(session.config, FeishuAdapterConfig):
            raise ValueError("FeishuAdapter requires FeishuAdapterConfig")

        # 从会话配置中获取鉴权信息
        app_id = session.config.app_id
        app_secret = session.config.app_secret

        token = await self.client.get_tenant_access_token(app_id, app_secret)

        # 构造卡片内容
        status = "done" if is_finish else "typing"
        if is_error:
            # 错误时，如果有部分内容则追加错误提示，否则直接提示错误
            display_content = (
                (content + "\n\n服务暂时繁忙，请稍后再试。")
                if content
                else "服务暂时繁忙，请稍后再试。"
            )
            status = "done"
        else:
            display_content = content or "..."
            if not is_finish:
                display_content += " ▌"

        # 飞书 Markdown 长度限制约为 30,000 字符
        if len(display_content) > 30000:
            display_content = display_content[:30000] + "\n\n（内容过长，已截断）"

        card = self._build_interactive_card(display_content, status)

        if session.context_id:
            # 更新已有卡片
            await self.client.update_card_message(token, session.context_id, card)
        else:
            # 发送初始卡片并更新 context_id
            message_id = await self.client.send_card_message(
                token,
                session.event.extra.get("receive_id_type", "open_id"),
                session.event.extra.get("receive_id"),
                card,
            )
            session.context_id = message_id

    async def close(self) -> None:
        await self.client.close()

    @staticmethod
    def _build_interactive_card(text: str, status: str = "typing") -> dict:
        """构建飞书卡片 2.0 协议结构。"""
        header_title = "AI 助手正在思考..." if status == "typing" else "AI 助手已完成内容生成"
        header_template = "blue" if status == "typing" else "green"

        return {
            "schema": "2.0",
            "config": {"wide_screen_mode": True, "update_multi": True},
            "header": {
                "template": header_template,
                "title": {"content": header_title, "tag": "plain_text"},
            },
            "body": {
                "elements": [
                    {
                        "tag": "markdown",
                        "content": (text or "").strip() or "...",
                    }
                ]
            },
        }
