"""Robot 集成层基类与通用数据类型。

整个 ``robot/`` 子树按职责分层，新接手时先看这里：

| 子目录 | 职责 | 典型类 / 函数 |
|---|---|---|
| ``base``            | 抽象基类 + 共享数据类型（本文件）| ``BaseRobotAdapter`` / ``RobotInboundEvent`` / ``RobotSession`` / ``MessageDeduplicator`` |
| ``factory``         | 平台名 → adapter 实例的单例工厂 | ``RobotFactory.get_adapter(platform)`` |
| ``adapters/``       | ``BaseRobotAdapter`` 的平台实现：消息解析 + 回复 | ``DingTalkAdapter`` / ``FeishuAdapter`` / ``WeCom*Adapter`` |
| ``services/``       | 长跑后台单例：维护 longconn 连接、事件分发、与 RobotOrchestrator 集成 | ``DingTalkRobotService`` 等 |
| ``clients/``        | 平台 HTTP SDK 客户端 wrapper（Token 缓存、原生 API 调用）| ``DingTalkClient`` / ``FeishuClient`` |
| ``connections/``    | 长连接 starter（lark_oapi / dingtalk_stream 等的薄封装）| ``start_longconn_client`` |
| ``types/``          | 平台特定的 Pydantic 配置类型 | ``DingTalkStreamConfig`` 等 |
| ``registry``        | Plugin-style context resolver 注册表（``site_id`` → 平台 ctx）| ``register_robot_context_resolver`` / ``get_robot_context`` |
| ``wecom_internals/``| 企微专用 helper：context / XML crypto / SDK utils + resolver 注册 | ``register_resolvers()`` / ``WXBizXmlMsgCrypt`` 等 |

Adapter vs Service：``Adapter`` 是无状态的接口实现（解析 + 回复），由 ``factory``
按平台名按需返回；``Service`` 是有状态的长跑单例（``startup`` / ``shutdown``
生命周期，``_workers`` 维护多站点连接），由 lifecycle 在 app 启动时唤起。
"""

import abc
from dataclasses import dataclass, field
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
    chat_id: str | None = None
    raw_data: Any = None
    # 扩展字段（如钉钉的 session_webhook, 企微的 stream_id 等）
    extra: dict[str, Any] = field(default_factory=dict)


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
        """模型显示名称 (如：企业微信)。"""
        pass

    @abc.abstractmethod
    def get_provider_id(self) -> str:
        """模型唯一标识 (如：wecom)。"""
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

    def is_streaming_supported(self, session: RobotSession | None = None) -> bool:
        """
        判断当前机器人平台是否支持流式推送。
        默认支持流式。对于不支持的原生 API 推送（如企微内部应用/企微客服），子类可重写为 False。
        在为 False 时，Orchestrator 将使用 `stream: False` 一次性请求大模型以获得更快的回报。
        """
        return True

    async def close(self) -> None:
        """释放资源（可选）。"""
        pass


class MessageDeduplicator:
    """机器人消息去重工具类，防止同一消息被多次处理。"""

    def __init__(self, ttl: int = 600, max_size: int = 2000) -> None:
        import threading
        from collections import OrderedDict

        self._ttl = ttl
        self._max_size = max_size
        self._cache: OrderedDict[str, float] = OrderedDict()
        self._lock = threading.Lock()

    def is_duplicate(self, message_id: str) -> bool:
        """判断消息是否重复。如果第一次见则记录并返回 False，否则返回 True。"""
        import time

        if not message_id:
            return False

        now = time.time()
        with self._lock:
            # 1. 清理过期数据
            expire_before = now - self._ttl
            while self._cache:
                first_key = next(iter(self._cache))
                if self._cache[first_key] >= expire_before:
                    break
                self._cache.popitem(last=False)

            # 2. 查重
            if message_id in self._cache:
                return True

            # 3. 记录新消息
            self._cache[message_id] = now
            self._cache.move_to_end(message_id)

            # 4. 容量控制
            if len(self._cache) > self._max_size:
                self._cache.popitem(last=False)

            return False

    def check_and_log_duplicate(self, site_id: int, message_id: str | None, tag: str) -> bool:
        """检查消息是否重复并记录日志。如果是重复消息返回 True，否则返回 False。"""
        import logging

        if not message_id:
            return False

        dedupe_key = f"{site_id}:{message_id}"
        if self.is_duplicate(dedupe_key):
            logging.getLogger(self.__module__).debug(
                "%s 忽略重复消息: site_id=%s message_id=%s", tag, site_id, message_id
            )
            return True
        return False
