#!/usr/bin/env python
# Copyright 2026 CatWiki Authors

import base64
import hashlib
import logging
import random
import socket
import struct

from Crypto.Cipher import AES

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
        """用 SHA1 算法生成安全签名"""
        try:
            if isinstance(encrypt, bytes):
                encrypt = encrypt.decode("utf-8")

            sortlist = [str(token), str(timestamp), str(nonce), str(encrypt)]
            sortlist.sort()
            sha = hashlib.sha1()
            sha.update("".join(sortlist).encode("utf-8"))
            return ierror.WXBizMsgCrypt_OK, sha.hexdigest()
        except Exception as e:
            logger.error("SHA1 签名计算失败: %s", e)
            return ierror.WXBizMsgCrypt_ComputeSignature_Error, None


class PKCS7Encoder:
    """提供基于 PKCS7 算法的加解密填充接口"""

    block_size = 32

    def encode(self, text):
        """对需要加密的明文进行填充补位"""
        text_length = len(text)
        amount_to_pad = self.block_size - (text_length % self.block_size)
        if amount_to_pad == 0:
            amount_to_pad = self.block_size
        pad = bytes([amount_to_pad])
        if isinstance(text, str):
            text = text.encode("utf-8")
        return text + pad * amount_to_pad

    def decode(self, decrypted):
        """删除解密后明文的填充字符"""
        pad = ord(decrypted[-1]) if isinstance(decrypted[-1], str) else decrypted[-1]
        if pad < 1 or pad > 32:
            pad = 0
        return decrypted[:-pad]


class Prpcrypt:
    """提供接收和推送给企业微信消息的加解密接口"""

    def __init__(self, key):
        self.key = key
        self.mode = AES.MODE_CBC

    def encrypt(self, text, receiveid):
        """对明文进行加密"""
        text = text.encode("utf-8")
        text = (
            self.get_random_str()
            + struct.pack("I", socket.htonl(len(text)))
            + text
            + receiveid.encode("utf-8")
        )

        pkcs7 = PKCS7Encoder()
        text = pkcs7.encode(text)
        cryptor = AES.new(self.key, self.mode, self.key[:16])
        try:
            ciphertext = cryptor.encrypt(text)
            return ierror.WXBizMsgCrypt_OK, base64.b64encode(ciphertext)
        except Exception as e:
            logger.error("AES 加密失败: %s", e)
            return ierror.WXBizMsgCrypt_EncryptAES_Error, None

    def decrypt(self, text, receiveid):
        """对密文进行解密"""
        try:
            cryptor = AES.new(self.key, self.mode, self.key[:16])
            plain_text = cryptor.decrypt(base64.b64decode(text))
        except Exception as e:
            logger.error("AES 解密失败: %s", e)
            return ierror.WXBizMsgCrypt_DecryptAES_Error, None
        try:
            pad = plain_text[-1]
            content = plain_text[16:-pad]
            msg_len = socket.ntohl(struct.unpack("I", content[:4])[0])
            msg_content = content[4 : msg_len + 4].decode("utf-8")
            from_receiveid = content[msg_len + 4 :].decode("utf-8")
        except Exception as e:
            logger.error("解密消息提取失败: %s", e)
            return ierror.WXBizMsgCrypt_IllegalBuffer, None
        if from_receiveid != receiveid:
            logger.error("receiveid 不匹配: 预期=%s, 实际=%s", receiveid, from_receiveid)
            return ierror.WXBizMsgCrypt_ValidateCorpid_Error, None
        return 0, msg_content

    def get_random_str(self):
        """随机生成16位字符串"""
        return str(random.randint(1000000000000000, 9999999999999999)).encode("utf-8")
