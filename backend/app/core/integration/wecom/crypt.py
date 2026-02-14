#!/usr/bin/env python
# -*- encoding:utf-8 -*-

"""企业微信发送给企业后台的消息加解密模块 (JSON 协议).
@copyright: Copyright (c) 1998-2020 Tencent Inc.
"""
# ------------------------------------------------------------------------

import base64
import string
import random
import hashlib
import time
import struct
import logging
from Crypto.Cipher import AES
import sys
import socket
import json

from . import ierror

logger = logging.getLogger(__name__)


class FormatException(Exception):
    """格式异常类"""

    pass


def throw_exception(message, exception_class=FormatException):
    """抛出自定义异常"""
    raise exception_class(message)


class SHA1:
    """计算企业微信消息签名"""

    def getSHA1(self, token, timestamp, nonce, encrypt):
        """用 SHA1 算法生成安全签名
        @param token:  票据
        @param timestamp: 时间戳
        @param encrypt: 密文
        @param nonce: 随机字符串
        @return: (错误码, 安全签名)
        """
        try:
            # 确保所有输入都是字符串类型
            if isinstance(encrypt, bytes):
                encrypt = encrypt.decode("utf-8")

            sortlist = [str(token), str(timestamp), str(nonce), str(encrypt)]
            sortlist.sort()
            sha = hashlib.sha1()
            sha.update("".join(sortlist).encode("utf-8"))
            return ierror.WXBizMsgCrypt_OK, sha.hexdigest()

        except Exception as e:
            logger.error(f"SHA1 签名计算失败: {e}")
            return ierror.WXBizMsgCrypt_ComputeSignature_Error, None


class JsonParse:
    """提供提取消息格式中的密文及生成回复消息格式的接口"""

    # json消息模板
    AES_TEXT_RESPONSE_TEMPLATE = """{
        "encrypt": "%(msg_encrypt)s",
        "msgsignature": "%(msg_signaturet)s",
        "timestamp": "%(timestamp)s",
        "nonce": "%(nonce)s"
    }"""

    def extract(self, jsontext):
        """提取出 JSON 数据包中的加密消息
        @param jsontext: 待提取的 JSON 字符串
        @return: (错误码, 加密消息)
        """
        try:
            json_dict = json.loads(jsontext)
            return ierror.WXBizMsgCrypt_OK, json_dict["encrypt"]
        except Exception as e:
            logger.error(f"JSON 解析提取失败: {e}")
            return ierror.WXBizMsgCrypt_ParseJson_Error, None

    def generate(self, encrypt, signature, timestamp, nonce):
        """生成回复 JSON 消息
        @param encrypt: 加密后的消息密文
        @param signature: 安全签名
        @param timestamp: 时间戳
        @param nonce: 随机字符串
        @return: 生成的 JSON 字符串
        """
        resp_dict = {
            "msg_encrypt": encrypt,
            "msg_signaturet": signature,
            "timestamp": timestamp,
            "nonce": nonce,
        }
        resp_json = self.AES_TEXT_RESPONSE_TEMPLATE % resp_dict
        return resp_json


class PKCS7Encoder:
    """提供基于 PKCS7 算法的加解密填充接口"""

    block_size = 32

    def encode(self, text):
        """对需要加密的明文进行填充补位
        @param text: 需要进行填充补位操作的明文
        @return: 补齐后的 bytes
        """
        text_length = len(text)
        # 计算需要填充的位数
        amount_to_pad = self.block_size - (text_length % self.block_size)
        if amount_to_pad == 0:
            amount_to_pad = self.block_size
        # 获得补位所用的字符
        pad = bytes([amount_to_pad])
        # 确保text是bytes类型
        if isinstance(text, str):
            text = text.encode("utf-8")
        return text + pad * amount_to_pad

    def decode(self, decrypted):
        """删除解密后明文的填充字符
        @param decrypted: 解密后的明文
        @return: 删除填充后的明文
        """
        pad = ord(decrypted[-1]) if isinstance(decrypted[-1], str) else decrypted[-1]
        if pad < 1 or pad > 32:
            pad = 0
        return decrypted[:-pad]


class Prpcrypt(object):
    """提供接收和推送给企业微信消息的加解密接口"""

    def __init__(self, key):
        self.key = key
        # 设置加解密模式为 AES 的 CBC 模式
        self.mode = AES.MODE_CBC

    def encrypt(self, text, receiveid):
        """对明文进行加密
        @param text: 需要加密的明文
        @param receiveid: 接收者 ID
        @return: (错误码, 密文)
        """
        # 16位随机字符串添加到明文开头
        text = text.encode("utf-8")
        text = (
            self.get_random_str()
            + struct.pack("I", socket.htonl(len(text)))
            + text
            + receiveid.encode("utf-8")
        )

        # 填充
        pkcs7 = PKCS7Encoder()
        text = pkcs7.encode(text)
        # 加密
        cryptor = AES.new(self.key, self.mode, self.key[:16])
        try:
            ciphertext = cryptor.encrypt(text)
            # 使用 BASE64 编码
            return ierror.WXBizMsgCrypt_OK, base64.b64encode(ciphertext)
        except Exception as e:
            logger.error(f"AES 加密失败: {e}")
            return ierror.WXBizMsgCrypt_EncryptAES_Error, None

    def decrypt(self, text, receiveid):
        """对密文进行解密
        @param text: 密文
        @param receiveid: 预期接收者 ID
        @return: (错误码, 明文内容)
        """
        try:
            cryptor = AES.new(self.key, self.mode, self.key[:16])
            # Base64 解码后进行 AES-CBC 解密
            plain_text = cryptor.decrypt(base64.b64decode(text))
        except Exception as e:
            logger.error(f"AES 解密失败: {e}")
            return ierror.WXBizMsgCrypt_DecryptAES_Error, None
        try:
            pad = plain_text[-1]
            # 去除 16 位随机字符串和填充内容
            content = plain_text[16:-pad]
            json_len = socket.ntohl(struct.unpack("I", content[:4])[0])
            json_content = content[4 : json_len + 4].decode("utf-8")
            from_receiveid = content[json_len + 4 :].decode("utf-8")
        except Exception as e:
            logger.error(f"解密消息提取失败: {e}")
            return ierror.WXBizMsgCrypt_IllegalBuffer, None
        if from_receiveid != receiveid:
            logger.error(f"receiveid 不匹配: 预期={receiveid}, 实际={from_receiveid}")
            return ierror.WXBizMsgCrypt_ValidateCorpid_Error, None
        return 0, json_content

    def get_random_str(self):
        """随机生成16位字符串"""
        return str(random.randint(1000000000000000, 9999999999999999)).encode("utf-8")


class WXBizJsonMsgCrypt(object):
    """企业微信 JSON 消息加解密封装"""

    def __init__(self, sToken, sEncodingAESKey, sReceiveId):
        try:
            # 处理 Base64 补位
            missing_padding = len(sEncodingAESKey) % 4
            if missing_padding:
                sEncodingAESKey += "=" * (4 - missing_padding)
            self.key = base64.b64decode(sEncodingAESKey)
            assert len(self.key) == 32
        except:
            throw_exception("[错误]: EncodingAESKey 无效!", FormatException)
        self.m_sToken = sToken
        self.m_sReceiveId = sReceiveId

    def VerifyURL(self, sMsgSignature, sTimeStamp, sNonce, sEchoStr):
        """验证回调 URL"""
        sha1 = SHA1()
        ret, signature = sha1.getSHA1(self.m_sToken, sTimeStamp, sNonce, sEchoStr)
        if ret != 0:
            return ret, None
        if not signature == sMsgSignature:
            return ierror.WXBizMsgCrypt_ValidateSignature_Error, None
        pc = Prpcrypt(self.key)
        ret, sReplyEchoStr = pc.decrypt(sEchoStr, self.m_sReceiveId)
        return ret, sReplyEchoStr

    def EncryptMsg(self, sReplyMsg, sNonce, timestamp=None):
        """加密回复消息"""
        pc = Prpcrypt(self.key)
        ret, encrypt = pc.encrypt(sReplyMsg, self.m_sReceiveId)
        if ret != 0:
            return ret, None
        encrypt = encrypt.decode("utf-8")
        if timestamp is None:
            timestamp = str(int(time.time()))
        # 生成安全签名
        sha1 = SHA1()
        ret, signature = sha1.getSHA1(self.m_sToken, timestamp, sNonce, encrypt)
        if ret != 0:
            return ret, None
        jsonParse = JsonParse()
        return ret, jsonParse.generate(encrypt, signature, timestamp, sNonce)

    def DecryptMsg(self, sPostData, sMsgSignature, sTimeStamp, sNonce):
        """解密接收到的消息"""
        jsonParse = JsonParse()
        ret, encrypt = jsonParse.extract(sPostData)
        if ret != 0:
            return ret, None
        sha1 = SHA1()
        ret, signature = sha1.getSHA1(self.m_sToken, sTimeStamp, sNonce, encrypt)
        if ret != 0:
            return ret, None
        if not signature == sMsgSignature:
            logger.error(f"签名不匹配: 计算值={signature}, 预期值={sMsgSignature}")
            return ierror.WXBizMsgCrypt_ValidateSignature_Error, None
        pc = Prpcrypt(self.key)
        ret, json_content = pc.decrypt(encrypt, self.m_sReceiveId)
        return ret, json_content
