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

    # 3. Feishu Bot
    feishu = config_value.get("feishuBot", {})
    if feishu:
        if "appId" in feishu:
            feishu["appId"] = mask_variable(feishu["appId"])
        if "appSecret" in feishu:
            feishu["appSecret"] = mask_variable(feishu["appSecret"])

    # 4. DingTalk Bot
    dingtalk = config_value.get("dingtalkBot", {})
    if dingtalk:
        if "clientId" in dingtalk:
            dingtalk["clientId"] = mask_variable(dingtalk["clientId"])
        if "clientSecret" in dingtalk:
            dingtalk["clientSecret"] = mask_variable(dingtalk["clientSecret"])


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


def mask_sensitive_data(config: dict[str, Any]) -> dict[str, Any]:
    """对通用配置字典进行脱敏处理（深度拷贝）"""
    import copy

    masked = copy.deepcopy(config)

    def _recursive_mask(data: Any):
        if isinstance(data, dict):
            for key, value in data.items():
                if any(
                    x in key.lower() for x in ["apikey", "api_key", "password", "secret", "token"]
                ):
                    if isinstance(value, str):
                        data[key] = mask_variable(value)
                else:
                    _recursive_mask(value)
        elif isinstance(data, list):
            for item in data:
                _recursive_mask(item)

    _recursive_mask(masked)
    return masked
