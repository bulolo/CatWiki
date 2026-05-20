from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.common.i18n import _
from app.core.integration.robot.wecom_internals.crypto import WXBizXmlMsgCrypt
from app.crud.site import crud_site

_WECOM_CONTEXT_META = {
    "kefu": {
        "config_key": "wecom_kefu",
        "crypt_cls": WXBizXmlMsgCrypt,
        "receiveid": lambda cfg: cfg.get("corp_id"),
        "enabled_msg": "该站点未启用企业微信客服",
        "invalid_msg": "企业微信客服配置不完整",
        "require_corp_id": True,
    },
    "app": {
        "config_key": "wecom_app",
        "crypt_cls": WXBizXmlMsgCrypt,
        "receiveid": lambda cfg: cfg.get("corp_id"),
        "enabled_msg": "该站点未启用企业微信机器人",
        "invalid_msg": "企业微信应用配置不完整",
        "require_corp_id": True,
    },
}


async def get_wecom_context(kind: str, site_id: int, db: AsyncSession) -> dict:
    """获取企业微信机器人配置上下文的通用依赖项"""
    meta = _WECOM_CONTEXT_META.get(kind)
    if not meta:
        raise HTTPException(status_code=500, detail=_("bot.unknown_wecom_type"))

    site = await crud_site.get(db, id=site_id)
    if not site or not site.bot_config:
        raise HTTPException(status_code=404, detail=_("bot.site_config_not_found"))

    config = site.bot_config.get(meta["config_key"], {})
    if not config or not config.get("enabled"):
        raise HTTPException(status_code=403, detail=meta["enabled_msg"])

    token = config.get("token")
    aes_key = config.get("encoding_aes_key")
    receiveid = meta["receiveid"](config)

    if not token or not aes_key:
        raise HTTPException(status_code=500, detail=meta["invalid_msg"])

    if meta["require_corp_id"] and not receiveid:
        raise HTTPException(status_code=500, detail=meta["invalid_msg"])

    crypt = meta["crypt_cls"](token, aes_key, receiveid)
    return {"site": site, "config": config, "crypt": crypt}


async def get_wecom_kefu_context(site_id: int, db: AsyncSession) -> dict:
    return await get_wecom_context("kefu", site_id, db)


async def get_wecom_app_context(site_id: int, db: AsyncSession) -> dict:
    return await get_wecom_context("app", site_id, db)
