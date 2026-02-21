import logging
from collections.abc import Callable
from typing import Any

from app.core.integration.robot.dingtalk.types import DingTalkStreamConfig

logger = logging.getLogger(__name__)


def start_stream_client(
    *,
    config: DingTalkStreamConfig,
    on_text_event: Callable[[Any], None],
) -> None:
    """启动钉钉 Stream 客户端并把原始事件消息交给回调。"""
    try:
        import dingtalk_stream as dingtalk
    except Exception as e:
        raise RuntimeError(f"钉钉 Stream 启动失败: 缺少 dingtalk-stream 依赖 ({e})") from e

    class _DingTalkChatbotHandler(dingtalk.ChatbotHandler):
        async def process(self, callback):
            try:
                incoming_message = dingtalk.ChatbotMessage.from_dict(callback.data or {})
                on_text_event(incoming_message)
            except Exception:
                logger.exception("钉钉 Stream 回调处理失败: site_id=%s", config.site_id)
            return dingtalk.AckMessage.STATUS_OK, "OK"

    credential = dingtalk.Credential(config.client_id, config.client_secret)
    client = dingtalk.DingTalkStreamClient(credential)
    handler = _DingTalkChatbotHandler()
    main_topic = getattr(dingtalk.ChatbotMessage, "TOPIC", None)
    delegate_topic = getattr(dingtalk.ChatbotMessage, "DELEGATE_TOPIC", None)
    legacy_topic = getattr(getattr(dingtalk, "chatbot", None), "TopicChatbotMessage", None)

    registered_topics: set[str] = set()
    for topic in (main_topic, delegate_topic, legacy_topic):
        if not topic or topic in registered_topics:
            continue
        client.register_callback_handler(topic, handler)
        registered_topics.add(topic)

    if not registered_topics:
        raise RuntimeError("钉钉 Stream 启动失败: 未找到可用的 chatbot callback topic 常量")

    logger.info(
        "钉钉 Stream 订阅回调 topic: site_id=%s topics=%s",
        config.site_id,
        sorted(registered_topics),
    )
    client.start_forever()
