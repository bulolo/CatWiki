# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://github.com/CatWiki/CatWiki/blob/main/LICENSE
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
数据脱敏工具函数
"""

from typing import Any


def mask_variable(value: str) -> str:
    """对变量值进行脱敏处理

    保留前3个和后3个字符，中间用 **** 替代。
    短于7个字符的值全部脱敏。

    Args:
        value: 需要脱敏的字符串

    Returns:
        脱敏后的字符串
    """
    if not value:
        return value
    if len(value) <= 6:
        return "****"
    return value[:3] + "****" + value[-3:]


def mask_bot_config_inplace(config_value: dict) -> None:
    """对机器人配置进行原地脱敏处理"""
    if not config_value:
        return

    # 1. WeCom Smart Robot
    wecom = config_value.get("wecom_smart", {})
    if wecom:
        if "bot_id" in wecom:
            wecom["bot_id"] = mask_variable(wecom["bot_id"])
        if "secret" in wecom:
            wecom["secret"] = mask_variable(wecom["secret"])

    # 2. Feishu Bot
    feishu = config_value.get("feishu_app", {})
    if feishu:
        if "app_id" in feishu:
            feishu["app_id"] = mask_variable(feishu["app_id"])
        if "app_secret" in feishu:
            feishu["app_secret"] = mask_variable(feishu["app_secret"])

    # 3. DingTalk Bot
    dingtalk = config_value.get("dingtalk_app", {})
    if dingtalk:
        if "client_id" in dingtalk:
            dingtalk["client_id"] = mask_variable(dingtalk["client_id"])
        if "client_secret" in dingtalk:
            dingtalk["client_secret"] = mask_variable(dingtalk["client_secret"])

    # 4. WeCom Customer Service
    wecom_kefu = config_value.get("wecom_kefu", {})
    if wecom_kefu:
        if "corp_id" in wecom_kefu:
            wecom_kefu["corp_id"] = mask_variable(wecom_kefu["corp_id"])
        if "secret" in wecom_kefu:
            wecom_kefu["secret"] = mask_variable(wecom_kefu["secret"])
        if "token" in wecom_kefu:
            wecom_kefu["token"] = mask_variable(wecom_kefu["token"])
        if "encoding_aes_key" in wecom_kefu:
            wecom_kefu["encoding_aes_key"] = mask_variable(wecom_kefu["encoding_aes_key"])

    # 5. WeCom App
    wecom_app = config_value.get("wecom_app", {})
    if wecom_app:
        if "corp_id" in wecom_app:
            wecom_app["corp_id"] = mask_variable(wecom_app["corp_id"])
        if "secret" in wecom_app:
            wecom_app["secret"] = mask_variable(wecom_app["secret"])
        if "token" in wecom_app:
            wecom_app["token"] = mask_variable(wecom_app["token"])
        if "encoding_aes_key" in wecom_app:
            wecom_app["encoding_aes_key"] = mask_variable(wecom_app["encoding_aes_key"])

    # 6. Telegram Bot
    telegram = config_value.get("telegram_app", {})
    if telegram:
        if "bot_token" in telegram:
            telegram["bot_token"] = mask_variable(telegram["bot_token"])


def filter_client_site_data(site: Any) -> Any:
    """过滤客户端站点数据中的敏感信息"""
    if not site:
        return site

    # 处理机器人配置
    bot_config = getattr(site, "bot_config", None)
    if bot_config is None and isinstance(site, dict):
        bot_config = site.get("bot_config")

    if bot_config:
        # 仅保留 web_widget 配置，彻底移除 api_bot 和 wecom_smart 等包含密钥的配置
        filtered_config = {}
        if "web_widget" in bot_config:
            filtered_config["web_widget"] = bot_config["web_widget"]

        if hasattr(site, "bot_config"):
            site.bot_config = filtered_config
        elif isinstance(site, dict):
            site["bot_config"] = filtered_config

    return site


def mask_sensitive_data(config: dict[str, Any]) -> dict[str, Any]:
    """对通用配置字典进行脱敏处理（深度拷贝）"""
    import copy

    masked = copy.deepcopy(config)

    def _recursive_mask(data: Any):
        if isinstance(data, dict):
            for key, value in data.items():
                if any(
                    x in key.lower()
                    for x in [
                        "apikey",
                        "api_key",
                        "key",
                        "password",
                        "secret",
                        "token",
                        "app_id",
                        "client_id",
                        "app_secret",
                        "client_secret",
                    ]
                ):
                    if isinstance(value, str) and value:
                        data[key] = mask_variable(value)
                else:
                    _recursive_mask(value)
        elif isinstance(data, list):
            for item in data:
                _recursive_mask(item)

    _recursive_mask(masked)
    return masked
