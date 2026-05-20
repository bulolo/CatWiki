# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""企业微信专用 helpers 与 context resolver 注册入口。

本子包收口所有企微内部工具：

| 文件 | 角色 |
|---|---|
| ``context``     | 由 ``site_id`` 解析企微 corp_id / crypt 实例（``get_wecom_*_context``） |
| ``crypto``      | 企微 XML 加密 / 签名（``WXBizXmlMsgCrypt``）                              |
| ``crypt_base``  | 加密原语（``SHA1`` / ``PKCS7Encoder`` / ``Prpcrypt``，源自腾讯 SDK 样例） |
| ``utils``       | Token 管理 / 通用 SDK 工具（``WeComTokenManager``）                       |
| ``ierror``      | 企微 SDK 错误码常量                                                       |

启动时由 ``lifecycle/manager.py`` 调用一次 ``register_resolvers()`` 把 ``wecom_app``
/ ``wecom_kefu`` 两个 context resolver 注册到 ``robot.registry``。
"""

from app.core.infra.config import settings
from app.core.integration.robot.registry import register_robot_context_resolver
from app.core.integration.robot.wecom_internals.context import (
    get_wecom_app_context,
    get_wecom_kefu_context,
)

# 这两个名字同时作为 ``settings.ROBOT_PLUGIN_ALLOWLIST`` 的 filter key
_RESOLVER_NAMES = ("wecom_kefu", "wecom_app")


async def _kefu_resolver(kind: str, site_id: int, db) -> dict:
    return await get_wecom_kefu_context(site_id, db)


async def _app_resolver(kind: str, site_id: int, db) -> dict:
    return await get_wecom_app_context(site_id, db)


_RESOLVERS: dict = {
    "wecom_kefu": _kefu_resolver,
    "wecom_app": _app_resolver,
}


def register_resolvers(names: list[str] | None = None) -> None:
    """把企微 context resolver 注册到全局 ``registry``。

    ``names`` 显式覆盖默认全部；否则若 ``settings.ROBOT_PLUGIN_ALLOWLIST`` 设置，
    按它过滤；否则全部注册。
    """
    allowlist = list(settings.ROBOT_PLUGIN_ALLOWLIST or [])
    if allowlist:
        names = [n for n in allowlist if n in _RESOLVER_NAMES]
    elif names is None:
        names = list(_RESOLVER_NAMES)

    for name in names:
        resolver = _RESOLVERS.get(name)
        if resolver:
            register_robot_context_resolver(name, resolver, override=True, source="builtin")


__all__ = ["register_resolvers"]
