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
JWT 认证工具函数单元测试
"""

from datetime import timedelta

from app.core.common.utils import (
    create_access_token,
    decode_access_token,
    verify_token,
)


class TestCreateAccessToken:
    def test_creates_token(self):
        token = create_access_token({"sub": "user@example.com"})
        assert isinstance(token, str)
        assert len(token) > 0

    def test_with_custom_expiry(self):
        token = create_access_token(
            {"sub": "user@example.com"},
            expires_delta=timedelta(minutes=5),
        )
        assert isinstance(token, str)


class TestDecodeAccessToken:
    def test_decode_valid_token(self):
        token = create_access_token({"sub": "user@example.com", "role": "admin"})
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "user@example.com"
        assert payload["role"] == "admin"

    def test_decode_invalid_token(self):
        payload = decode_access_token("invalid.token.string")
        assert payload is None

    def test_decode_expired_token(self):
        token = create_access_token(
            {"sub": "user@example.com"},
            expires_delta=timedelta(seconds=-1),
        )
        payload = decode_access_token(token)
        assert payload is None


class TestVerifyToken:
    def test_valid_token(self):
        token = create_access_token({"sub": "user@example.com"})
        assert verify_token(token) is True

    def test_invalid_token(self):
        assert verify_token("invalid.token") is False

    def test_expired_token(self):
        token = create_access_token(
            {"sub": "user@example.com"},
            expires_delta=timedelta(seconds=-1),
        )
        assert verify_token(token) is False
