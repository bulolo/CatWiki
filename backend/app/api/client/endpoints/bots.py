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

import asyncio
import base64
import hashlib
import logging
import struct
import time
import xml.etree.ElementTree as ET

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db, AsyncSessionLocal
from app.crud.site import crud_site
from app.services.chat_service import ChatService
from app.schemas.chat import ChatCompletionRequest, ChatCompletionResponse
from app.schemas.document import VectorRetrieveFilter
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

class PKCS7Encoder:
    """RFC 2315 PKCS#7 padding"""
    block_size = 32

    @classmethod
    def encode(cls, text_bytes):
        amount_to_pad = cls.block_size - (len(text_bytes) % cls.block_size)
        pad = bytes([amount_to_pad] * amount_to_pad)
        return text_bytes + pad

    @classmethod
    def decode(cls, decrypted_bytes):
        pad = decrypted_bytes[-1]
        if pad < 1 or pad > cls.block_size:
            pad = 0
        return decrypted_bytes[:-pad]

class WXBizMsgCrypt:
    def __init__(self, token, encoding_aes_key, receive_id):
        self.token = token
        self.key = base64.b64decode(encoding_aes_key + "=")
        self.receive_id = receive_id

    def verify_signature(self, msg_signature, timestamp, nonce, echostr):
        sort_list = [self.token, timestamp, nonce, echostr]
        sort_list.sort()
        sha1 = hashlib.sha1()
        sha1.update("".join(sort_list).encode("utf-8"))
        hash_code = sha1.hexdigest()
        return hash_code == msg_signature

    def decrypt(self, text, msg_signature, timestamp, nonce):
        # 1. Verify Signature
        sort_list = [self.token, timestamp, nonce, text]
        sort_list.sort()
        sha1 = hashlib.sha1()
        sha1.update("".join(sort_list).encode("utf-8"))
        if sha1.hexdigest() != msg_signature:
            raise Exception("Signature verification failed")

        # 2. AES Decrypt
        cipher = Cipher(algorithms.AES(self.key), modes.CBC(self.key[:16]), backend=default_backend())
        decryptor = cipher.decryptor()
        decrypted = decryptor.update(base64.b64decode(text)) + decryptor.finalize()
        
        # 3. Handle PKCS7 padding
        decrypted = PKCS7Encoder.decode(decrypted)
        
        # 4. Extract content
        # Random(16) + MsgLen(4) + Msg + ReceiveID
        msg_len = struct.unpack(">I", decrypted[16:20])[0]
        msg_content = decrypted[20:20+msg_len].decode("utf-8")
        receive_id = decrypted[20+msg_len:].decode("utf-8")
        
        # Optional: check receive_id
        return msg_content

    def encrypt(self, reply, nonce):
        # Random(16) + MsgLen(4) + Msg + ReceiveID
        random_bytes = hashlib.sha1(str(time.time()).encode()).digest()[:16]
        reply_bytes = reply.encode("utf-8")
        msg_len_bytes = struct.pack(">I", len(reply_bytes))
        receive_id_bytes = self.receive_id.encode("utf-8")
        
        full_bytes = random_bytes + msg_len_bytes + reply_bytes + receive_id_bytes
        full_bytes = PKCS7Encoder.encode(full_bytes)
        
        cipher = Cipher(algorithms.AES(self.key), modes.CBC(self.key[:16]), backend=default_backend())
        encryptor = cipher.encryptor()
        encrypted = encryptor.update(full_bytes) + encryptor.finalize()
        
        base64_encrypted = base64.b64encode(encrypted).decode("utf-8")
        
        # Generate Signature
        timestamp = str(int(time.time()))
        sort_list = [self.token, timestamp, nonce, base64_encrypted]
        sort_list.sort()
        sha1 = hashlib.sha1()
        sha1.update("".join(sort_list).encode("utf-8"))
        signature = sha1.hexdigest()
        
        return base64_encrypted, signature, timestamp


@router.get("/wecom-smart-robot")
async def verify_url(
    msg_signature: str = Query(...),
    timestamp: str = Query(...),
    nonce: str = Query(...),
    echostr: str = Query(...),
    site_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """验证回调 URL (企业微信设置时触发)"""
    site = await crud_site.get(db, id=site_id)
    if not site or not site.bot_config:
        raise HTTPException(status_code=404, detail="Site or config not found")
        
    config = site.bot_config.get("wecomSmartRobot", {})
    if not config or not config.get("enabled"):
        raise HTTPException(status_code=400, detail="WeCom robot not enabled")
        
    token = config.get("token")
    encoding_aes_key = config.get("encodingAesKey")
    
    if not token or not encoding_aes_key:
        raise HTTPException(status_code=400, detail="WeCom robot token or key missing")
        
    crypt = WXBizMsgCrypt(token, encoding_aes_key, "")
    
    # WeCom VerifyURL expects the decrypted echostr as response
    try:
        # Note: WeCom sends encrypted echostr in GET request for VerifyURL
        # Wait, actually for VerifyURL, echostr IS the value to decrypt
        decrypted_echostr = crypt.decrypt(echostr, msg_signature, timestamp, nonce)
        return Response(content=decrypted_echostr)
    except Exception as e:
        logger.error(f"WeCom VerifyURL failed: {e}")
        raise HTTPException(status_code=400, detail="Verification failed")


@router.post("/wecom-smart-robot")
async def handle_message(
    request: Request,
    background_tasks: BackgroundTasks,
    msg_signature: str = Query(...),
    timestamp: str = Query(...),
    nonce: str = Query(...),
    site_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    """处理企业微信消息回调"""
    site = await crud_site.get(db, id=site_id)
    if not site or not site.bot_config:
        return Response(status_code=404)
        
    config = site.bot_config.get("wecomSmartRobot", {})
    if not config or not config.get("enabled"):
        return Response(status_code=403)
        
    token = config.get("token")
    encoding_aes_key = config.get("encodingAesKey")
    
    # 读取 XML 消息体
    body = await request.body()
    try:
        root = ET.fromstring(body)
        encrypt_node = root.find("Encrypt")
        if encrypt_node is None:
            return Response(status_code=400)
        
        encrypt_text = encrypt_node.text
        crypt = WXBizMsgCrypt(token, encoding_aes_key, "")
        xml_content = crypt.decrypt(encrypt_text, msg_signature, timestamp, nonce)
        
        msg_root = ET.fromstring(xml_content)
        msg_type = msg_root.find("MsgType").text
        from_user = msg_root.find("FromUserName").text
        to_user = msg_root.find("ToUserName").text
        
        if msg_type == "text":
            content = msg_root.find("Content").text
            
            # 构造聊天请求
            chat_request = ChatCompletionRequest(
                message=content,
                thread_id=f"wecom-{from_user}",
                user=from_user,
                stream=False,
                filter=VectorRetrieveFilter(site_id=site.id)
            )
            
            # 企业微信要求 5 秒内响应，暂时改为同步等待，增加 4.5s 超时保护
            try:
                logger.info(f"WeCom synchronous AI starting for {from_user}...")
                response = await asyncio.wait_for(
                    ChatService.process_chat_request(chat_request, background_tasks),
                    timeout=4.5
                )
                reply_text = ""
                if hasattr(response, "choices") and response.choices:
                    reply_text = response.choices[0].message.content or ""
            except asyncio.TimeoutError:
                logger.warning(f"WeCom AI timeout for {from_user}, returning fallback.")
                reply_text = "AI 助手正在深度思考中，由于企业微信回复时间限制，请稍后再次提问或联系管理员。"
            except Exception as e:
                logger.error(f"WeCom AI error: {e}", exc_info=True)
                reply_text = "抱歉，处理消息时遇到错误。"
            
            # 返回回复消息
            reply_xml = _build_reply_xml(from_user, to_user, reply_text)
            encrypted_reply, signature, ts = crypt.encrypt(reply_xml, nonce)
            
            response_xml = f"""<xml>
<Encrypt><![CDATA[{encrypted_reply}]]></Encrypt>
<MsgSignature><![CDATA[{signature}]]></MsgSignature>
<TimeStamp>{ts}</TimeStamp>
<Nonce><![CDATA[{nonce}]]></Nonce>
</xml>"""
            return Response(content=response_xml, media_type="application/xml")
            
        return Response(content="")
    except Exception as e:
        logger.error(f"WeCom Message handling failed: {e}", exc_info=True)
        return Response(status_code=500)


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
        raise HTTPException(status_code=401, detail="Invalid authorization header format")

    token = authorization.replace("Bearer ", "")

    async with AsyncSessionLocal() as db:
        site = await crud_site.get_by_api_token(db, api_token=token)
        if not site:
            raise HTTPException(status_code=401, detail="Invalid API Key")

    # 统一将识别出的 site_id 注入 filter
    if not request.filter:
        request.filter = VectorRetrieveFilter(site_id=site.id)
    else:
        request.filter.site_id = site.id

    return await ChatService.process_chat_request(request, background_tasks)


def _build_reply_xml(to_user: str, from_user: str, content: str) -> str:
    """构造企业微信被动回复的明文 XML"""
    return f"""<xml>
<ToUserName><![CDATA[{to_user}]]></ToUserName>
<FromUserName><![CDATA[{from_user}]]></FromUserName>
<CreateTime>{int(time.time())}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[{content}]]></Content>
</xml>"""
