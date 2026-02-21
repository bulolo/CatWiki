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
通用工具函数单元测试
"""

from datetime import datetime

from app.core.common.utils import (
    Paginator,
    format_datetime,
    generate_token,
    get_vector_id,
    hash_string,
    is_valid_email,
    parse_datetime,
    remove_none_values,
    truncate_string,
)


class TestGenerateToken:
    def test_default_length(self):
        token = generate_token()
        assert isinstance(token, str)
        assert len(token) > 0

    def test_custom_length(self):
        token1 = generate_token(16)
        token2 = generate_token(64)
        # URL-safe base64 encoding makes actual length differ from byte length
        assert isinstance(token1, str)
        assert isinstance(token2, str)

    def test_uniqueness(self):
        tokens = {generate_token() for _ in range(100)}
        assert len(tokens) == 100


class TestHashString:
    def test_deterministic(self):
        assert hash_string("hello") == hash_string("hello")

    def test_different_inputs(self):
        assert hash_string("hello") != hash_string("world")

    def test_returns_hex(self):
        result = hash_string("test")
        assert all(c in "0123456789abcdef" for c in result)
        assert len(result) == 64  # SHA256 hex


class TestIsValidEmail:
    def test_valid_emails(self):
        assert is_valid_email("user@example.com")
        assert is_valid_email("user.name@domain.co")
        assert is_valid_email("user+tag@sub.domain.com")

    def test_invalid_emails(self):
        assert not is_valid_email("")
        assert not is_valid_email("user@")
        assert not is_valid_email("@domain.com")
        assert not is_valid_email("user@domain")
        assert not is_valid_email("no-at-sign")


class TestTruncateString:
    def test_short_string(self):
        assert truncate_string("hello", max_length=10) == "hello"

    def test_exact_length(self):
        assert truncate_string("hello", max_length=5) == "hello"

    def test_long_string(self):
        result = truncate_string("hello world", max_length=8)
        assert result == "hello..."
        assert len(result) == 8

    def test_custom_suffix(self):
        result = truncate_string("hello world", max_length=8, suffix="…")
        assert result == "hello w…"


class TestRemoveNoneValues:
    def test_removes_none(self):
        assert remove_none_values({"a": 1, "b": None}) == {"a": 1}

    def test_empty_dict(self):
        assert remove_none_values({}) == {}

    def test_all_none(self):
        assert remove_none_values({"a": None, "b": None}) == {}

    def test_no_none(self):
        data = {"a": 1, "b": "two"}
        assert remove_none_values(data) == data


class TestGetVectorId:
    def test_deterministic(self):
        assert get_vector_id(1) == get_vector_id(1)

    def test_different_ids(self):
        assert get_vector_id(1) != get_vector_id(2)

    def test_returns_uuid_string(self):
        result = get_vector_id(42)
        assert len(result) == 36  # UUID format: 8-4-4-4-12
        assert result.count("-") == 4


class TestDatetimeUtils:
    def test_format_datetime(self):
        dt = datetime(2024, 1, 15, 10, 30, 0)
        assert format_datetime(dt) == "2024-01-15 10:30:00"

    def test_format_datetime_custom(self):
        dt = datetime(2024, 1, 15)
        assert format_datetime(dt, "%Y/%m/%d") == "2024/01/15"

    def test_parse_datetime(self):
        dt = parse_datetime("2024-01-15 10:30:00")
        assert dt.year == 2024
        assert dt.month == 1
        assert dt.hour == 10

    def test_roundtrip(self):
        dt = datetime(2024, 6, 15, 14, 30, 0)
        assert parse_datetime(format_datetime(dt)) == dt


class TestPaginator:
    def test_defaults(self):
        p = Paginator(page=1, size=10, total=100)
        assert p.skip == 0
        assert p.total_pages == 10
        assert p.has_next is True
        assert p.has_prev is False

    def test_middle_page(self):
        p = Paginator(page=5, size=10, total=100)
        assert p.skip == 40
        assert p.has_next is True
        assert p.has_prev is True

    def test_last_page(self):
        p = Paginator(page=10, size=10, total=100)
        assert p.skip == 90
        assert p.has_next is False
        assert p.has_prev is True

    def test_zero_total(self):
        p = Paginator(page=1, size=10, total=0)
        assert p.total_pages == 0
        assert p.has_next is False
        assert p.has_prev is False

    def test_invalid_page_clamped(self):
        p = Paginator(page=-1, size=10, total=100)
        assert p.page == 1
        assert p.skip == 0

    def test_partial_last_page(self):
        p = Paginator(page=1, size=10, total=15)
        assert p.total_pages == 2

    def test_to_dict(self):
        p = Paginator(page=2, size=10, total=25)
        d = p.to_dict()
        assert d["page"] == 2
        assert d["size"] == 10
        assert d["total"] == 25
        assert d["total_pages"] == 3
        assert d["has_next"] is True
        assert d["has_prev"] is True
