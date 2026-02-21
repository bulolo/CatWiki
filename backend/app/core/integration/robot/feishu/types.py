from dataclasses import dataclass
from app.core.integration.robot.base import BaseRobotConfig


@dataclass(frozen=True)
class FeishuLongConnConfig:
    site_id: int
    app_id: str
    app_secret: str


class FeishuAdapterConfig(BaseRobotConfig):
    app_id: str
    app_secret: str
