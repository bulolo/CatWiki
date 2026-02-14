# Copyright 2024 CatWiki Authors
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

    # 1. API Bot
    api_bot = config_value.get("apiBot", {})
    if api_bot:
        if "apiEndpoint" in api_bot:
            api_bot["apiEndpoint"] = mask_variable(api_bot["apiEndpoint"])
        if "apiKey" in api_bot:
            api_bot["apiKey"] = mask_variable(api_bot["apiKey"])

    # 2. WeCom Smart Robot
    wecom = config_value.get("wecomSmartRobot", {})
    if wecom:
        if "token" in wecom:
            wecom["token"] = mask_variable(wecom["token"])
        if "encodingAesKey" in wecom:
            wecom["encodingAesKey"] = mask_variable(wecom["encodingAesKey"])


def filter_client_site_data(site: Any) -> Any:
    """过滤客户端站点数据中的敏感信息"""
    if not site:
        return site

    # 处理机器人配置
    bot_config = getattr(site, "bot_config", None)
    if bot_config is None and isinstance(site, dict):
        bot_config = site.get("bot_config")

    if bot_config:
        # 仅保留 webWidget 配置，彻底移除 apiBot 和 wecomSmartRobot 等包含密钥的配置
        filtered_config = {}
        if "webWidget" in bot_config:
            filtered_config["webWidget"] = bot_config["webWidget"]

        if hasattr(site, "bot_config"):
            site.bot_config = filtered_config
        elif isinstance(site, dict):
            site["bot_config"] = filtered_config

    return site
