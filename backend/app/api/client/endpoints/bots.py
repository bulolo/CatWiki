import json
import logging
import time

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    Header,
    HTTPException,
    Query,
    Request,
    Response,
)
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db, AsyncSessionLocal
from app.crud.site import crud_site
from app.services.chat_service import ChatService
from app.schemas.chat import ChatCompletionRequest, ChatCompletionResponse
from app.schemas.document import VectorRetrieveFilter
from app.core.infra.config import settings
from app.core.integration.wecom.crypt import WXBizJsonMsgCrypt
from app.services.wecom_robot_service import WeComRobotService

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
    crypt = context["crypt"]

    ret, decrypted_echostr = crypt.VerifyURL(msg_signature, timestamp, nonce, echostr)
    if ret != 0:
        logger.error(f"企业微信回调 URL 验证失败: 错误码={ret}")
        return Response(content="验证失败", media_type="text/plain", status_code=400)

    return Response(content=decrypted_echostr, media_type="text/plain")


@router.post("/wecom-smart-robot")
async def handle_message(
    request: Request,
    background_tasks: BackgroundTasks,
    msg_signature: str = Query(...),
    timestamp: str = Query(...),
    nonce: str = Query(...),
    context: dict = Depends(get_wecom_robot_context),
):
    """处理企业微信智能机器人消息回调 (JSON 协议)"""
    site = context["site"]
    crypt = context["crypt"]
    aes_key = context["config"].get("encodingAesKey")

    # 获取并解密消息
    post_data = await request.body()
    ret, msg_body = crypt.DecryptMsg(post_data, msg_signature, timestamp, nonce)

    if ret != 0:
        logger.error(f"企业微信消息解密失败: 错误码={ret}")
        return Response(status_code=400)

    try:
        data = json.loads(msg_body)
    except json.JSONDecodeError:
        logger.error("解析解密后的企业微信消息 JSON 失败")
        return Response(status_code=400)

    msg_type = data.get("msgtype")
    reply_payload = None

    # 根据消息类型分发逻辑
    if msg_type == "text":
        content = data.get("text", {}).get("content", "")
        # 兼容处理发送者标识
        from_info = data.get("from", {})
        from_user = from_info.get("alias") or from_info.get("userid", "anonymous")
        reply_payload = await WeComRobotService.process_text_message(
            site, from_user, content, background_tasks
        )

    elif msg_type == "stream":
        stream_id = data.get("stream", {}).get("id")
        if stream_id:
            reply_payload = WeComRobotService.get_stream_response(stream_id)

    elif msg_type == "image":
        image_url = data.get("image", {}).get("url")
        if image_url:
            reply_payload = await WeComRobotService.process_image_message(image_url, aes_key)

    # 如果有回复内容，则加密后返回
    if reply_payload:
        reply_json = json.dumps(reply_payload, ensure_ascii=False)
        ret, encrypted_resp = crypt.EncryptMsg(reply_json, nonce, timestamp)
        if ret == 0:
            return Response(content=encrypted_resp, media_type="text/plain")
        logger.error(f"企业微信消息加密失败: 错误码={ret}")

    return Response(content="success", media_type="text/plain")


@router.post(
    "/site-completions",
    response_model=ChatCompletionResponse,
    operation_id="createSiteChatCompletion",
)
async def create_site_chat_completion(
    request: ChatCompletionRequest,
    background_tasks: BackgroundTasks,
    authorization: str = Header(..., description="Bearer <api_key>"),
) -> ChatCompletionResponse | StreamingResponse:
    """
    创建聊天补全 (专用接口，兼容 OpenAI 格式)
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="认证头格式无效，须以 'Bearer ' 开头")

    token = authorization.replace("Bearer ", "")

    async with AsyncSessionLocal() as db:
        site = await crud_site.get_by_api_token(db, api_token=token)
        if not site:
            raise HTTPException(status_code=401, detail="无效的 API 密钥")

    # 统一将识别出的 site_id 注入 filter
    if not request.filter:
        request.filter = VectorRetrieveFilter(site_id=site.id)
    else:
        request.filter.site_id = site.id

    return await ChatService.process_chat_request(request, background_tasks)
