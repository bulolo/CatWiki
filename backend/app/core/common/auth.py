# Copyright 2026 CatWiki Authors
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

"""
JWT 认证工具函数
"""

from datetime import datetime, timedelta

from jose import jwt
from jose.exceptions import JWTError

from app.core.infra.config import settings


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    创建 JWT access token

    Args:
        data: 要编码到 token 中的数据（通常是用户信息）
        expires_delta: token 过期时间增量，如果为 None 则使用配置的默认值

    Returns:
        JWT token 字符串
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict | None:
    """
    解码并验证 JWT access token

    Args:
        token: JWT token 字符串

    Returns:
        解码后的 token 数据，如果 token 无效或过期则返回 None
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def verify_token(token: str) -> bool:
    """
    验证 token 是否有效

    Args:
        token: JWT token 字符串

    Returns:
        如果 token 有效返回 True，否则返回 False
    """
    payload = decode_access_token(token)
    return payload is not None
