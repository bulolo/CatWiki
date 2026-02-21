import threading
import time
from typing import Any

from app.core.integration.robot.base import BaseRobotAdapter, RobotInboundEvent, RobotSession


class WeComBufferManager:
    """企业微信流式回复内存缓冲区管理器 (全局单例存储)。"""

    _response_buffer: dict[str, dict[str, Any]] = {}
    _buffer_lock = threading.Lock()

    @classmethod
    def update_buffer(cls, stream_id: str, content: str, is_finish: bool, is_error: bool) -> None:
        with cls._buffer_lock:
            if stream_id not in cls._response_buffer:
                cls._response_buffer[stream_id] = {
                    "content": "",
                    "finish": False,
                    "timestamp": time.time(),
                }

            payload = cls._response_buffer[stream_id]
            if is_error:
                payload["content"] = (
                    (content + "\n\n服务繁忙，请稍后再试。")
                    if content
                    else "服务繁忙，请稍后再试。"
                )
                payload["finish"] = True
            else:
                payload["content"] = content
                payload["finish"] = is_finish

            payload["timestamp"] = time.time()

    @classmethod
    def get_buffered_response(cls, stream_id: str) -> dict[str, Any] | None:
        with cls._buffer_lock:
            return cls._response_buffer.get(stream_id)

    @classmethod
    def cleanup_buffer(cls, expiry_seconds: int = 300) -> int:
        now = time.time()
        count = 0
        with cls._buffer_lock:
            keys_to_remove = [
                sid
                for sid, task in cls._response_buffer.items()
                if now - task.get("timestamp", 0) > expiry_seconds
            ]
            for k in keys_to_remove:
                cls._response_buffer.pop(k, None)
                count += 1
        return count


class WeComAdapter(BaseRobotAdapter):
    """企业微信智能机器人适配器。"""

    def get_provider_name(self) -> str:
        return "企业微信"

    def get_sync_interval(self) -> float:
        """企业微信采用 Pull 模式，由于是局部内存更新，0.5s 可以提供更连贯的轮询响应。"""
        return 0.5

    def parse_inbound_text_event(self, data: Any, site_id: int) -> RobotInboundEvent | None:
        """企微验证和解密在 Endpoint 中完成，这里暂不使用。"""
        raise NotImplementedError("企微 Webhook 暂时由 Endpoint 直接解析成 RobotInboundEvent")

    async def reply(
        self,
        session: RobotSession,
        content: str,
        is_finish: bool = False,
        is_error: bool = False,
    ) -> None:
        """更新企微流式缓冲区。"""
        stream_id = session.context_id
        if not stream_id:
            return

        WeComBufferManager.update_buffer(stream_id, content, is_finish, is_error)
