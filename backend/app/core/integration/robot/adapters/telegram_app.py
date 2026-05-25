"""Telegram 机器人适配器：解析入站 update + 流式编辑回复。

为最大化稳健性，本适配器**不启用 parse_mode**（按纯文本发送）：
1. Telegram MarkdownV2 转义字符多达 16 个，LLM 输出极易触发 400
2. HTML 模式需要把 markdown 转 HTML，引入额外解析层
3. 纯文本下 Telegram 仍会自动识别 URL 并渲染为可点击链接
未来若需要富文本，可在 Client 层加 parse_mode + 转换器，对调用方透明。
"""

import logging
from typing import Any

from app.core.integration.robot.base import (
    BaseRobotAdapter,
    RobotInboundEvent,
    RobotSession,
)
from app.core.integration.robot.clients.telegram_app import (
    TELEGRAM_MAX_MESSAGE_LEN,
    TelegramApiError,
    TelegramClient,
)

logger = logging.getLogger(__name__)


class TelegramAdapter(BaseRobotAdapter):
    """Telegram 机器人平台适配器。"""

    def __init__(self, client: TelegramClient | None = None) -> None:
        self.client = client or TelegramClient()

    def get_provider_name(self) -> str:
        return "Telegram"

    def get_provider_id(self) -> str:
        return "telegram_app"

    def get_sync_interval(self) -> float:
        """Telegram editMessageText 限频较严（同聊天 ~1 msg/s），略放宽到 1.5s。"""
        return 1.5

    def is_streaming_supported(self, session: RobotSession | None = None) -> bool:
        return True

    # ---------------- inbound parsing ----------------

    def parse_inbound_text_event(self, data: Any, site_id: int) -> RobotInboundEvent | None:
        """解析 Telegram Bot API 的 update 字典为标准事件。

        约定 data 形如 `{"update_id": ..., "message": {...}}`；非文本类消息（图片、
        贴纸、入群事件等）一律返回 None。
        """
        if not isinstance(data, dict):
            return None

        message = data.get("message") or data.get("edited_message")
        if not isinstance(message, dict):
            return None

        text = (message.get("text") or "").strip()
        if not text:
            return None

        chat = message.get("chat") or {}
        chat_id = chat.get("id")
        if chat_id is None:
            return None
        chat_type = (chat.get("type") or "").lower()
        is_group = chat_type in {"group", "supergroup", "channel"}

        from_obj = message.get("from") or {}
        from_user_id = from_obj.get("id")
        from_username = from_obj.get("username")

        # 群聊里剥离开头的 @bot_username 提及，避免污染 LLM 输入
        bot_username = (data.get("_bot_username") or "").lstrip("@")
        if bot_username:
            stripped = self._strip_leading_mention(text, message.get("entities"), bot_username)
            text = stripped.strip()
            if not text:
                return None

        message_id = message.get("message_id")
        # 兜底用 update_id 防 None，确保 deduper 能拿到稳定 key
        dedupe_key = str(message_id) if message_id else f"u{data.get('update_id')}"

        return RobotInboundEvent(
            site_id=site_id,
            message_id=dedupe_key,
            from_user=str(from_user_id or from_username or "anonymous"),
            content=text,
            chat_id=str(chat_id) if is_group else None,
            raw_data=data,
            extra={
                "chat_id": chat_id,
                "chat_type": chat_type,
                "from_user_id": from_user_id,
                "from_username": from_username,
                "reply_to_message_id": message_id,
            },
        )

    @staticmethod
    def _strip_leading_mention(text: str, entities: Any, bot_username: str) -> str:
        """如果 entities 里第一段是 @bot 提及，按 offset/length 切除。"""
        if not isinstance(entities, list):
            return text
        target = f"@{bot_username}".lower()
        for ent in entities:
            if not isinstance(ent, dict):
                continue
            if ent.get("type") != "mention":
                continue
            offset = ent.get("offset", -1)
            length = ent.get("length", 0)
            if offset != 0 or length <= 0:
                # 只处理"开头第一个" mention，群里 @多人时不剥
                return text
            mention_text = text[offset : offset + length].lower()
            if mention_text == target:
                return text[length:]
            return text
        return text

    # ---------------- outbound reply ----------------

    async def reply(
        self,
        session: RobotSession,
        content: str,
        is_finish: bool = False,
        is_error: bool = False,
    ) -> None:
        from app.core.integration.robot.types.telegram_app import TelegramAdapterConfig

        if not isinstance(session.config, TelegramAdapterConfig):
            raise ValueError("TelegramAdapter requires TelegramAdapterConfig")

        config = session.config
        chat_id = config.chat_id
        bot_token = config.bot_token
        api_base = config.api_base_url

        display_text = self._build_display_text(content, is_finish=is_finish, is_error=is_error)

        # 短路：内容相对上次成功推送没有变化，避免触发 400 not-modified
        if display_text == config.last_pushed_text and session.context_id:
            return

        try:
            if session.context_id is None:
                # 初始发送
                result = await self.client.send_message(
                    bot_token=bot_token,
                    api_base_url=api_base,
                    chat_id=chat_id,
                    text=display_text,
                    reply_to_message_id=session.event.extra.get("reply_to_message_id"),
                )
                msg_id = result.get("message_id")
                if msg_id is not None:
                    session.context_id = str(msg_id)
                    config.last_pushed_text = display_text
            else:
                await self.client.edit_message_text(
                    bot_token=bot_token,
                    api_base_url=api_base,
                    chat_id=chat_id,
                    message_id=int(session.context_id),
                    text=display_text,
                )
                config.last_pushed_text = display_text
        except TelegramApiError as e:
            # 403: 用户已 block bot；41x: chat 被删 / kick — 静默
            if e.error_code in (403, 400) and any(
                kw in (e.description or "").lower()
                for kw in (
                    "blocked",
                    "bot was kicked",
                    "chat not found",
                    "user is deactivated",
                    "have no rights",
                )
            ):
                logger.info(
                    "Telegram 回复被忽略（用户/群已不可达）: chat_id=%s desc=%s",
                    chat_id,
                    e.description,
                )
                return
            # 429: 让上层 orchestrator 的"流式更新失败 (待下次重试)" 路径接管
            raise

    @staticmethod
    def _build_display_text(content: str, *, is_finish: bool, is_error: bool) -> str:
        """统一渲染面向用户的文本，承接错误兜底与截断逻辑。"""
        text = (content or "").strip()
        if is_error:
            tail = "\n\n服务暂时繁忙，请稍后再试。"
            text = (text + tail) if text else "服务暂时繁忙，请稍后再试。"
        elif not text:
            # 占位：初始 send 时 LLM 还没产出内容
            text = "正在思考..."
        elif not is_finish:
            # 流式进行中加 ▌ 让用户感受到"还在打字"
            text = text + " ▌"

        if len(text) > TELEGRAM_MAX_MESSAGE_LEN:
            text = text[:TELEGRAM_MAX_MESSAGE_LEN] + "\n\n（内容过长，已截断）"
        return text

    async def close(self) -> None:
        await self.client.close()
