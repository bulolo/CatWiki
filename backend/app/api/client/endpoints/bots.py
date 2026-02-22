import logging

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.integration.robot.wecom.crypt import WXBizJsonMsgCrypt
from app.core.integration.robot.wecom.service import WeComRobotService
from app.crud.site import crud_site
from app.db.database import get_db

router = APIRouter()
logger = logging.getLogger(__name__)


async def get_wecom_robot_context(site_id: int = Query(...), db: AsyncSession = Depends(get_db)):
    """获取企业微信机器人配置上下文的依赖项"""
    site = await crud_site.get(db, id=site_id)
    if not site or not site.bot_config:
        raise HTTPException(status_code=404, detail="未找到对应的站点或配置")

    config = site.bot_config.get("wecomSmartRobot", {})
    if not config or not config.get("enabled"):
        raise HTTPException(status_code=403, detail="该站点未启用企业微信智能机器人")

    token = config.get("token")
    aes_key = config.get("encodingAesKey")
    if not token or not aes_key:
        raise HTTPException(status_code=500, detail="企业微信机器人配置不完整")

    # 智能机器人的 receiveid 是空串
    crypt = WXBizJsonMsgCrypt(token, aes_key, "")
    return {"site": site, "config": config, "crypt": crypt}


@router.get("/wecom-smart-robot")
async def verify_url(
    msg_signature: str = Query(...),
    timestamp: str = Query(...),
    nonce: str = Query(...),
    echostr: str = Query(...),
    context: dict = Depends(get_wecom_robot_context),
):
    """验证回调 URL (企业微信智能机器人设置时触发)"""
    try:
        decrypted_echostr = WeComRobotService.verify_url(
            context["crypt"], msg_signature, timestamp, nonce, echostr
        )
        return Response(content=decrypted_echostr, media_type="text/plain")
    except ValueError:
        return Response(content="验证失败", media_type="text/plain", status_code=400)


@router.post("/wecom-smart-robot")
async def handle_wecom_message(
    request: Request,
    background_tasks: BackgroundTasks,
    msg_signature: str = Query(...),
    timestamp: str = Query(...),
    nonce: str = Query(...),
    context: dict = Depends(get_wecom_robot_context),
):
    """处理企业微信智能机器人消息回调 (JSON 协议)"""
    post_data = await request.body()
    try:
        response_text = await WeComRobotService.process_webhook(
            site=context["site"],
            crypt=context["crypt"],
            aes_key=context["config"].get("encodingAesKey"),
            post_data=post_data,
            msg_signature=msg_signature,
            timestamp=timestamp,
            nonce=nonce,
            background_tasks=background_tasks,
        )
        # 即使 reply_payload 没有内容，Service 也会保底返回加密的原文或者 "success"
        if response_text:
            return Response(content=response_text, media_type="text/plain")
        return Response(content="success", media_type="text/plain")
    except ValueError:
        return Response(status_code=400)
