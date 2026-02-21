import logging
from typing import Any

from app.core.integration.robot.feishu.types import FeishuLongConnConfig

logger = logging.getLogger(__name__)


def start_longconn_client(
    *,
    config: FeishuLongConnConfig,
    on_text_event: Any,
) -> None:
    """启动飞书长连接客户端并把原始事件消息交给回调。"""
    try:
        import lark_oapi as lark
    except Exception as e:
        raise RuntimeError(f"飞书长连接启动失败: 缺少 lark_oapi 依赖 ({e})") from e

    def _on_message(data) -> None:
        if data:
            on_text_event(data)

    handler_builder = lark.EventDispatcherHandler.builder("", "", lark.LogLevel.INFO)
    if hasattr(handler_builder, "register_im_message_receive_v1"):
        handler_builder = handler_builder.register_im_message_receive_v1(_on_message)
    else:
        handler_builder = handler_builder.register_p2_im_message_receive_v1(_on_message)
    event_handler = handler_builder.build()
    ws_client = lark.ws.Client(
        config.app_id,
        config.app_secret,
        event_handler=event_handler,
        log_level=lark.LogLevel.INFO,
    )
    ws_client.start()
