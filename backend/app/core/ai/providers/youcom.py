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

"""You.com Search API 客户端。

API 文档：https://ydc-index.io/v1/search
认证方式：X-API-Key 请求头
"""

import logging
import time
from typing import Any

import httpx

from app.core.infra.config import settings

logger = logging.getLogger(__name__)

_SEARCH_URL = "https://ydc-index.io/v1/search"
_REQUEST_TIMEOUT = 10.0


class YoucomSearchClient:
    """You.com 网络搜索客户端。"""

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=_REQUEST_TIMEOUT,
                limits=httpx.Limits(
                    max_keepalive_connections=20,
                    max_connections=50,
                    keepalive_expiry=60.0,
                ),
            )
        return self._client

    async def aclose(self) -> None:
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
        self._client = None

    async def search(self, query: str, top_k: int = 10) -> list[dict[str, Any]]:
        """执行 You.com 网络搜索。

        Args:
            query: 搜索关键词。
            top_k: 返回的最大结果数。

        Returns:
            搜索结果列表，每项包含 title、url、content（snippet）、score。
        """
        api_key = settings.YOUCOM_API_KEY
        if not api_key:
            logger.debug("You.com search skipped: API key not configured")
            return []

        enabled = settings.YOUCOM_SEARCH_ENABLED
        if not enabled:
            logger.debug("You.com search skipped: disabled")
            return []

        if not query or not query.strip():
            return []

        start_time = time.time()
        try:
            payload = {"query": query, "count": top_k}
            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "X-API-Key": api_key,
            }

            client = self._get_client()
            response = await client.post(_SEARCH_URL, json=payload, headers=headers)
            status = response.status_code

            if status == 429:
                logger.warning("You.com search rate limit exceeded (429)")
                return []
            if status == 401:
                logger.warning("You.com API key invalid or expired (401)")
                return []
            if status != 200:
                logger.warning("You.com search failed with status %d: %s", status, response.text[:200])
                return []

            results = self._parse_response(response.json())
            elapsed_ms = (time.time() - start_time) * 1000
            logger.info(
                "You.com search completed: query=%s, results=%d, elapsedMs=%.1f",
                query,
                len(results),
                elapsed_ms,
            )
            return results

        except Exception as e:
            elapsed_ms = (time.time() - start_time) * 1000
            logger.error("You.com search error: %s (elapsedMs=%.1f)", e, elapsed_ms)
            return []

    def _parse_response(self, data: dict[str, Any]) -> list[dict[str, Any]]:
        results: list[dict[str, Any]] = []
        items = data.get("results", [])
        if not isinstance(items, list):
            return results

        for idx, item in enumerate(items, start=1):
            title = item.get("title", "")
            url = item.get("url", "")
            content = self._extract_snippet(item)
            if not content:
                content = item.get("description", "")

            results.append(
                {
                    "title": title,
                    "url": url,
                    "content": content,
                    "score": 1.0 / idx,
                    "evidence_id": f"WEB{idx}",
                }
            )
        return results

    def _extract_snippet(self, item: dict[str, Any]) -> str:
        snippets = item.get("snippets", [])
        if isinstance(snippets, list) and snippets:
            return str(snippets[0])
        return ""


# 模块级单例
youcom_search_client = YoucomSearchClient()


__all__ = ["YoucomSearchClient", "youcom_search_client"]
