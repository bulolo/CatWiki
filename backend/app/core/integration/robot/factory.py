from app.core.integration.robot.base import BaseRobotAdapter
from app.core.integration.robot.dingtalk.adapter import DingTalkAdapter
from app.core.integration.robot.feishu.adapter import FeishuAdapter
from app.core.integration.robot.wecom.adapter import WeComAdapter


class RobotFactory:
    """机器人适配器工厂。"""

    @classmethod
    def get_adapter(cls, platform: str) -> BaseRobotAdapter:
        """
        根据平台标识获取适配器的新实例。
        platform 取值建议和 site.bot_config 的 key 对应或约定：
        - feishu
        - dingtalk
        - wecom
        """
        if platform == "feishu":
            return FeishuAdapter()
        elif platform == "dingtalk":
            return DingTalkAdapter()
        elif platform == "wecom":
            return WeComAdapter()
        else:
            raise ValueError(f"暂不支持的机器人平台: {platform}")
