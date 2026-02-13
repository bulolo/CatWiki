
import os
import time
import json
import uuid
import requests
import hashlib
import base64
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

# --- 配置 ---
API_URL = os.getenv("API_URL", "http://localhost:3000")
SITE_ID = os.getenv("SITE_ID", "1")
TOKEN = os.getenv("WECOM_TOKEN", "test_token_123")
AES_KEY = os.getenv("WECOM_AES_KEY", "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG")
TEST_MESSAGE = os.getenv("TEST_MESSAGE", "你好，请介绍一下你自己")

# --- 微信加解密类 (简化版) ---
class WXBizMsgCrypt:
    def __init__(self, token, aes_key, receive_id):
        self.token = token
        self.aes_key = base64.b64decode(aes_key + "=")
        self.receive_id = receive_id

    def _get_signature(self, timestamp, nonce, encrypt_text):
        sort_list = sorted([self.token, timestamp, nonce, encrypt_text])
        sha1 = hashlib.sha1()
        sha1.update("".join(sort_list).encode("utf-8"))
        return sha1.hexdigest()

    def encrypt(self, text, nonce):
        text_bytes = text.encode("utf-8")
        # 32位随机字节 + 4字节长度 + 内容 + receive_id
        random_bytes = os.urandom(16)
        content_len = len(text_bytes).to_bytes(4, byteorder='big')
        raw_data = random_bytes + content_len + text_bytes + self.receive_id.encode("utf-8")
        
        # PKCS7 填充
        pad_len = 32 - (len(raw_data) % 32)
        raw_data += bytes([pad_len] * pad_len)
        
        cipher = Cipher(algorithms.AES(self.aes_key), modes.CBC(self.aes_key[:16]), backend=default_backend())
        encryptor = cipher.encryptor()
        encrypted = encryptor.update(raw_data) + encryptor.finalize()
        
        encrypt_text = base64.b64encode(encrypted).decode("utf-8")
        timestamp = str(int(time.time()))
        signature = self._get_signature(timestamp, nonce, encrypt_text)
        return encrypt_text, signature, timestamp

    def decrypt(self, encrypt_text, signature, timestamp, nonce):
        # 仅由于测试简单，暂时跳过签名校验
        encrypted = base64.b64decode(encrypt_text)
        cipher = Cipher(algorithms.AES(self.aes_key), modes.CBC(self.aes_key[:16]), backend=default_backend())
        decryptor = cipher.decryptor()
        decrypted = decryptor.update(encrypted) + decryptor.finalize()
        
        # 移除 PKCS7 填充
        pad_len = decrypted[-1]
        decrypted = decrypted[:-pad_len]
        
        # 移除前16字节随机数和4字节长度
        content_len = int.from_bytes(decrypted[16:20], byteorder='big')
        content = decrypted[20:20+content_len].decode("utf-8")
        return content

def run_test():
    print("=" * 60)
    print("🤖 企业微信智能机器人 模拟测试")
    print("=" * 60)
    print(f"  API:     {API_URL}")
    print(f"  站点 ID:  {SITE_ID}")
    print(f"  消息:     {TEST_MESSAGE}")
    print()

    crypt = WXBizMsgCrypt(TOKEN, AES_KEY, "ww_corp_id_placeholder")
    nonce = "test_nonce_" + str(uuid.uuid4())[:8]
    
    # 模拟用户提问 XML
    plain_xml = f"""<xml>
    <ToUserName><![CDATA[gh_placeholder]]></ToUserName>
    <FromUserName><![CDATA[test_user_001]]></FromUserName>
    <CreateTime>{int(time.time())}</CreateTime>
    <MsgType><![CDATA[text]]></MsgType>
    <Content><![CDATA[{TEST_MESSAGE}]]></Content>
    <MsgId>1234567890</MsgId>
    <AgentID>1</AgentID>
</xml>"""

    print("📤 步骤 1: 加密消息...")
    encrypt_text, signature, timestamp = crypt.encrypt(plain_xml, nonce)
    
    callback_payload = f"""<xml>
    <ToUserName><![CDATA[gh_placeholder]]></ToUserName>
    <Encrypt><![CDATA[{encrypt_text}]]></Encrypt>
</xml>"""

    endpoint = f"{API_URL}/v1/bot/wecom-smart-robot"
    params = {
        "msg_signature": signature,
        "timestamp": timestamp,
        "nonce": nonce,
        "site_id": SITE_ID
    }

    print(f"📡 步骤 2: 发送回调请求到 {endpoint}")
    print(f"   参数: site_id={SITE_ID}")
    
    try:
        resp = requests.post(endpoint, params=params, data=callback_payload, timeout=10)
        print(f"   状态码: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"   ❌ 错误: {resp.text}")
            return

        if not resp.text:
            print("   ⚠️  收到空响应 (AI 正在后台处理，后续结果会记录在会话中)")
            return

        print("\n📥 步骤 3: 解析响应")
        import xml.etree.ElementTree as ET
        root = ET.fromstring(resp.text)
        resp_encrypt = root.find("Encrypt").text
        resp_signature = root.find("MsgSignature").text
        resp_timestamp = root.find("TimeStamp").text
        
        reply_xml = crypt.decrypt(resp_encrypt, resp_signature, resp_timestamp, nonce)
        reply_root = ET.fromstring(reply_xml)
        reply_text = reply_root.find("Content").text
        
        print("   ✅ 成功解密回复!")
        print("\n" + "─" * 60)
        print("🤖 AI 回复:")
        print("─" * 60)
        print(reply_text)
        print("─" * 60)

    except requests.exceptions.Timeout:
        print("\n⏰ 请求超时 (10 秒)，AI 推理可能需要更长时间")
    except Exception as e:
        print(f"\n❌ 测试出错: {e}")

if __name__ == "__main__":
    run_test()
