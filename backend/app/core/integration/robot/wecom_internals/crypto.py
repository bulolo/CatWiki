#!/usr/bin/env python
# Copyright 2026 CatWiki Authors

import base64
import logging
import time
import xml.etree.ElementTree as ET

from . import ierror
from .crypt_base import SHA1, FormatException, Prpcrypt, throw_exception

logger = logging.getLogger(__name__)


class XMLParse:
    """提供提取消息格式中的密文及生成回复消息格式的接口 (XML 协议)"""

    AES_TEXT_RESPONSE_TEMPLATE = """<xml>
<Encrypt><![CDATA[%(msg_encrypt)s]]></Encrypt>
<MsgSignature><![CDATA[%(msg_signaturet)s]]></MsgSignature>
<TimeStamp>%(timestamp)s</TimeStamp>
<Nonce><![CDATA[%(nonce)s]]></Nonce>
</xml>"""

    def extract(self, xmltext):
        try:
            xml_tree = ET.fromstring(xmltext)
            encrypt = xml_tree.find("Encrypt")
            return ierror.WXBizMsgCrypt_OK, encrypt.text
        except Exception as e:
            logger.error("XML 解析提取失败: %s", e)
            return ierror.WXBizMsgCrypt_ParseXml_Error, None

    def generate(self, encrypt, signature, timestamp, nonce):
        resp_dict = {
            "msg_encrypt": encrypt,
            "msg_signaturet": signature,
            "timestamp": timestamp,
            "nonce": nonce,
        }
        resp_xml = self.AES_TEXT_RESPONSE_TEMPLATE % resp_dict
        return resp_xml


class WXBizXmlMsgCrypt:
    """企业微信 XML 消息加解密封装"""

    def __init__(self, s_token, s_encoding_aes_key, s_receive_id):
        try:
            missing_padding = len(s_encoding_aes_key) % 4
            if missing_padding:
                s_encoding_aes_key += "=" * (4 - missing_padding)
            self.key = base64.b64decode(s_encoding_aes_key)
            assert len(self.key) == 32
        except Exception:
            throw_exception("[错误]: EncodingAESKey 无效!", FormatException)
        self.m_sToken = s_token
        self.m_sReceiveId = s_receive_id

    def VerifyURL(self, s_msg_signature, s_time_stamp, s_nonce, s_echo_str):
        sha1 = SHA1()
        ret, signature = sha1.getSHA1(self.m_sToken, s_time_stamp, s_nonce, s_echo_str)
        if ret != 0:
            return ret, None
        if not signature == s_msg_signature:
            return ierror.WXBizMsgCrypt_ValidateSignature_Error, None
        pc = Prpcrypt(self.key)
        ret, s_reply_echo_str = pc.decrypt(s_echo_str, self.m_sReceiveId)
        return ret, s_reply_echo_str

    def EncryptMsg(self, s_reply_msg, s_nonce, timestamp=None):
        pc = Prpcrypt(self.key)
        ret, encrypt = pc.encrypt(s_reply_msg, self.m_sReceiveId)
        if ret != 0:
            return ret, None
        encrypt = encrypt.decode("utf-8")
        if timestamp is None:
            timestamp = str(int(time.time()))
        sha1 = SHA1()
        ret, signature = sha1.getSHA1(self.m_sToken, timestamp, s_nonce, encrypt)
        if ret != 0:
            return ret, None
        xml_parse = XMLParse()
        return ret, xml_parse.generate(encrypt, signature, timestamp, s_nonce)

    def DecryptMsg(self, s_post_data, s_msg_signature, s_time_stamp, s_nonce):
        xml_parse = XMLParse()
        ret, encrypt = xml_parse.extract(s_post_data)
        if ret != 0:
            return ret, None
        sha1 = SHA1()
        ret, signature = sha1.getSHA1(self.m_sToken, s_time_stamp, s_nonce, encrypt)
        if ret != 0:
            return ret, None
        if not signature == s_msg_signature:
            logger.error("签名不匹配: 计算值=%s, 预期值=%s", signature, s_msg_signature)
            return ierror.WXBizMsgCrypt_ValidateSignature_Error, None
        pc = Prpcrypt(self.key)
        ret, xml_content = pc.decrypt(encrypt, self.m_sReceiveId)
        return ret, xml_content
