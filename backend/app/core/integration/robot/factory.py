from app.core.integration.robot.adapters.dingtalk_app import DingTalkAdapter
from app.core.integration.robot.adapters.feishu_app import FeishuAdapter
from app.core.integration.robot.adapters.telegram_app import TelegramAdapter
from app.core.integration.robot.adapters.wecom_app import WeComAppAdapter
from app.core.integration.robot.adapters.wecom_kefu import WeComKefuAdapter
from app.core.integration.robot.adapters.wecom_smart import WeComSmartAdapter
from app.core.integration.robot.base import BaseRobotAdapter


class RobotFactory:
    """机器人适配器工厂。"""

    _instances: dict[str, BaseRobotAdapter] = {}

    @classmethod
    def get_adapter(cls, platform: str) -> BaseRobotAdapter:
        """
        根据平台标识获取适配器实例（单例模式以支持 Token 缓存和连接池复用）。
        """
        if platform in cls._instances:
            return cls._instances[platform]

        adapter: BaseRobotAdapter
        if platform == "feishu_app":
            adapter = FeishuAdapter()
        elif platform == "dingtalk_app":
            adapter = DingTalkAdapter()
        elif platform == "wecom_smart":
            adapter = WeComSmartAdapter()
        elif platform == "wecom_app":
            adapter = WeComAppAdapter()
        elif platform == "wecom_kefu":
            adapter = WeComKefuAdapter()
        elif platform == "telegram_app":
            adapter = TelegramAdapter()
        else:
            raise ValueError(f"暂不支持的机器人平台: {platform}")

        cls._instances[platform] = adapter
        return adapter

    @classmethod
    async def shutdown(cls) -> None:
        """关闭工厂并触发适配器的资源清理。"""
        for adapter in cls._instances.values():
            try:
                await adapter.close()
            except Exception as e:
                import logging

                logging.getLogger(__name__).warning("适配器关闭异常: %s", e)
        cls._instances.clear()
