from dataclasses import dataclass
from app.core.integration.robot.base import BaseRobotConfig


@dataclass(frozen=True)
class DingTalkStreamConfig:
    site_id: int
    client_id: str
    client_secret: str
    template_id: str | None = None


class DingTalkAdapterConfig(BaseRobotConfig):
    client_id: str
    client_secret: str
    template_id: str | None = None
    last_content_len: int = 0
