import base64
import json
import logging
import random
import string
from typing import Any

import httpx
from Crypto.Cipher import AES

from app.core.integration.robot.base import RobotInboundEvent, RobotSession
from app.core.integration.robot.factory import RobotFactory
from app.core.integration.robot.wecom.adapter import WeComBufferManager
from app.models.site import Site
from app.services.robot import RobotOrchestrator

logger = logging.getLogger(__name__)


class WeComRobotService:
    """企业微信智能机器人业务逻辑 (已重构为统一架构)。"""

    @classmethod
    def verify_url(
        cls, crypt: Any, msg_signature: str, timestamp: str, nonce: str, echostr: str
    ) -> str:
        """验证企业微信回调 URL"""
        ret, decrypted_echostr = crypt.VerifyURL(msg_signature, timestamp, nonce, echostr)
        if ret != 0:
            logger.error(f"企业微信回调 URL 验证失败: 错误码={ret}")
            raise ValueError(f"验证失败: {ret}")
        return decrypted_echostr

    @classmethod
    async def process_webhook(
        cls,
        site: Site,
        crypt: Any,
        aes_key: str,
        post_data: bytes,
        msg_signature: str,
        timestamp: str,
        nonce: str,
        background_tasks: Any,
    ) -> str | None:
        """处理企业微信智能机器人 Webhook 消息"""
        ret, msg_body = crypt.DecryptMsg(post_data, msg_signature, timestamp, nonce)
        if ret != 0:
            logger.error(f"企业微信消息解密失败: 错误码={ret}")
            raise ValueError(f"解密失败: {ret}")

        try:
            data = json.loads(msg_body)
        except json.JSONDecodeError:
            logger.error("解析解密后的企业微信消息 JSON 失败")
            raise ValueError("JSON 解析失败")

        msg_type = data.get("msgtype")
        reply_payload = None

        if msg_type == "text":
            content = data.get("text", {}).get("content", "")
            from_info = data.get("from", {})
            from_user = from_info.get("alias") or from_info.get("userid", "anonymous")
            reply_payload = await cls.process_text_message(
                site, from_user, content, background_tasks
            )
        elif msg_type == "stream":
            stream_id = data.get("stream", {}).get("id")
            if stream_id:
                reply_payload = cls.get_stream_response(stream_id)
        elif msg_type == "image":
            image_url = data.get("image", {}).get("url")
            if image_url:
                reply_payload = await cls.process_image_message(image_url, aes_key)

        if reply_payload:
            reply_json = json.dumps(reply_payload, ensure_ascii=False)
            ret, encrypted_resp = crypt.EncryptMsg(reply_json, nonce, timestamp)
            if ret == 0:
                return encrypted_resp
            logger.error(f"企业微信消息加密失败: 错误码={ret}")

        return "success"

    @classmethod
    def _generate_stream_id(cls, length: int = 10) -> str:
        """生成随机流 ID"""
        letters = string.ascii_letters + string.digits
        return "".join(random.choice(letters) for _ in range(length))

    @classmethod
    async def process_text_message(
        cls, site: Site, from_user: str, content: str, background_tasks: Any
    ) -> dict[str, Any]:
        """处理文本消息：启动异步统一编排任务"""
        # 1. 企微特殊逻辑：清理过期缓冲区
        WeComBufferManager.cleanup_buffer()

        # 2. 生成流 ID 并构造会话
        stream_id = cls._generate_stream_id()
        inbound_event = RobotInboundEvent(
            site_id=site.id,
            message_id=None,
            from_user=from_user,
            content=content,
        )

        adapter = RobotFactory.get_adapter("wecom")
        session = RobotSession(
            event=inbound_event,
            context_id=stream_id,
            config=None,  # 企微 Webhook 模式暂不需额外 config
        )

        # 3. 异步启动编排流程
        # 企微是 Pull 模式，orchestrate_reply 会不断更新 adapter 里的 buffer
        background_tasks.add_task(
            RobotOrchestrator.orchestrate_reply,
            adapter=adapter,
            session=session,
            background_tasks=background_tasks,
        )

        return {
            "msgtype": "stream",
            "stream": {"id": stream_id, "finish": False, "content": "已收到，正在为您写答案..."},
        }

    @classmethod
    def get_stream_response(cls, stream_id: str) -> dict[str, Any]:
        """获取流式进度 (代理到 BufferManager)"""
        task = WeComBufferManager.get_buffered_response(stream_id)
        if not task:
            return {
                "msgtype": "stream",
                "stream": {"id": stream_id, "finish": True, "content": "任务已过期，请重新提问。"},
            }

        return {
            "msgtype": "stream",
            "stream": {"id": stream_id, "finish": task["finish"], "content": task["content"]},
        }

    @classmethod
    async def process_image_message(cls, image_url: str, aes_key_base64: str) -> dict[str, Any]:
        """处理加密图片消息 (保留原有解密逻辑，暂未统一推送)"""
        # 图片处理逻辑由于暂不支持 AI 分析，目前仅做解密演示，保持现状
        temp_id = cls._generate_stream_id()
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(image_url, timeout=15)
                resp.raise_for_status()
                encrypted_data = resp.content

            missing_padding = len(aes_key_base64) % 4
            if missing_padding:
                aes_key_base64 += "=" * (4 - missing_padding)
            aes_key = base64.b64decode(aes_key_base64)

            cipher = AES.new(aes_key, AES.MODE_CBC, aes_key[:16])
            decrypted_data = cipher.decrypt(encrypted_data)

            pad_len = decrypted_data[-1]
            if not (1 <= pad_len <= 32):
                raise ValueError("无效的填充模式")
            decrypted_data = decrypted_data[:-pad_len]

            logger.info(f"图片解密成功: {len(decrypted_data)} 字节")
            return {
                "msgtype": "stream",
                "stream": {
                    "id": temp_id,
                    "finish": True,
                    "content": "已收到图片。目前智能机器人主要处理文本咨询，后续将支持图片分析。",
                },
            }
        except Exception as e:
            logger.error(f"图片处理失败: {e}")
            return {
                "msgtype": "stream",
                "stream": {
                    "id": temp_id,
                    "finish": True,
                    "content": "图片处理失败，请检查网络或稍后重试。",
                },
            }
