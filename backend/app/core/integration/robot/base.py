import abc
from dataclasses import dataclass
from typing import Any


from pydantic import BaseModel


class BaseRobotConfig(BaseModel):
    """跨平台通用适配器配置基类。"""

    pass


@dataclass
class RobotInboundEvent:
    """标准化的平台输入事件。"""

    site_id: int
    message_id: str | None
    from_user: str
    content: str
    raw_data: Any = None
    # 扩展字段（如钉钉的 session_webhook, 企微的 stream_id 等）
    extra: dict[str, Any] = None


@dataclass
class RobotSession:
    """机器人回复会话状态封装。"""

    event: RobotInboundEvent
    # 平台特定的会话上下文（如飞书的 message_id, 钉钉的 card_instance_id）
    context_id: str | None = None
    # 平台特定的配置
    config: BaseRobotConfig | None = None


class BaseRobotAdapter(abc.ABC):
    """机器人平台适配器基类。"""

    @abc.abstractmethod
    def get_provider_name(self) -> str:
        """模型显示名称。"""
        pass

    @abc.abstractmethod
    def parse_inbound_text_event(self, data: Any, site_id: int) -> RobotInboundEvent | None:
        """
        将平台原始回调对象直接解析为标准化的 RobotInboundEvent。
        :param data: 平台 SDK 传来的原始字典或对象
        :param site_id: 所属站点 ID
        """
        pass

    @abc.abstractmethod
    async def reply(
        self,
        session: RobotSession,
        content: str,
        is_finish: bool = False,
        is_error: bool = False,
    ) -> None:
        """
        向平台回复/更新消息。
        :param session: 会话模型
        :param content: 回复内容（流式场景下可能为全量或增量，取决于实现）
        :param is_finish: 是否回答结束
        :param is_error: 是否发生错误
        """
        pass

    def get_sync_interval(self) -> float:
        """获取平台建议的流式同步间隔（秒）。默认 0.6s。"""
        return 0.6

    async def close(self) -> None:
        """释放资源（可选）。"""
        pass
