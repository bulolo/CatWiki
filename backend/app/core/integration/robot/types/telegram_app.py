from dataclasses import dataclass

from app.core.integration.robot.base import BaseRobotConfig

DEFAULT_TELEGRAM_API_BASE = "https://api.telegram.org"


@dataclass(frozen=True)
class TelegramLongPollConfig:
    """Telegram 长轮询配置（service 层使用）。

    api_base_url 留给被墙环境用反向代理替换（如 cloudflare worker）。
    """

    site_id: int
    bot_token: str
    api_base_url: str = DEFAULT_TELEGRAM_API_BASE
    allowed_user_ids: tuple[int, ...] = ()


class TelegramAdapterConfig(BaseRobotConfig):
    """Telegram 适配器运行期配置（reply 时携带）。"""

    bot_token: str
    api_base_url: str = DEFAULT_TELEGRAM_API_BASE
    chat_id: int
    # 上一次成功 editMessageText 推送的文本，用于跳过"内容未变化"的无效编辑
    last_pushed_text: str = ""
