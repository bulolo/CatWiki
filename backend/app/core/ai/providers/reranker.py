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

"""Reranker —— Cohere 风格事实标准 rerank API 客户端。

**为什么不是"OpenAI 兼容"**：OpenAI 没有官方 rerank 端点。Cohere 最早做商用
rerank 并定义了请求 schema，Voyage / Jina / SiliconFlow / HuggingFace TEI /
vLLM 等后来都沿用该 schema：

    POST {endpoint}
    { "model": "...", "query": "...", "documents": [...], "top_n": N }
    → { "results": [{"index": N, "relevance_score": F}, ...] }

请求体高度收敛，但 endpoint 路径各家不一致：
- Cohere / Voyage / Jina / SiliconFlow / vLLM：``/v1/rerank``
- HuggingFace TEI：``/rerank``（无 ``/v1`` 前缀）
- DashScope：``/api/v1/services/rerank/text-rerank/text-rerank``（特殊）
- 自部署代理：可能任意

本实现默认按"base_url + /rerank"猜测（覆盖 ~95% 场景），admin 可通过 conf
中的 ``endpoint_path`` 字段做硬覆盖（参见 ``resolve_rerank_url``）。

与 chat / embedding 对齐：继承 ``BaseAIProvider``，享用统一的 double-check
locking 缓存、HIT/MISS 日志、Resolved 元数据返回；不同点：
- 缓存值是 ``dict``（配置快照），而非持久 client —— rerank 是无状态 HTTP
  调用，真正复用的资源是 ``self._client`` 这一根常驻 httpx 客户端，独立于
  按指纹分桶的配置缓存。
- 暴露两个 public 入口：``is_enabled``（探测，静默）与 ``rerank``（真实调用）。
"""

import logging
import time
from typing import Any

import httpx

from app.core.ai.providers.base import BaseAIProvider

logger = logging.getLogger(__name__)

# Cohere / Voyage / Jina / DashScope 一致使用 ``/rerank`` 作为 endpoint 路径。
# 该常量是默认值；如某 provider 走自定义路径，可在 rerank_config 里加
# ``endpoint_path`` 字段覆盖（admin 当前需直接写 DB；不在 Pydantic schema 中
# 暴露是因为这是稀有 escape hatch，不值得污染 ModelConfig）。
_DEFAULT_RERANK_PATH = "/rerank"


def resolve_rerank_url(base_url: str, endpoint_path: str | None) -> str:
    """组装最终请求 URL —— Reranker / admin 连通性测试共用。

    - ``endpoint_path`` 非空：admin 显式覆盖，直接拼接（不做"是否已含路径"
      的猜测，由 admin 自行保证 base_url 不重复包含该路径）。
    - ``endpoint_path`` 为空：默认 ``/rerank``；若 base_url 末尾已是该路径
      （典型：admin 误把完整 URL 当 base_url 填入），保持原样不重复拼接。

    对照同行：
    - Dify ``openai_api_compatible`` 直接 ``f"{base}/rerank"`` 无检查，
      导致 admin 填完整 URL 时变成 ``.../rerank/rerank`` 触发 404
      （github langgenius/dify issue #13879、#511 都是这个 bug）。
    - RAGFlow 走 ``endswith("/rerank")`` 检测，与本实现思路一致；不同点
      在于 RAGFlow 为每家 provider 单独建一个类，而本实现是一个通用客户端
      + ``endpoint_path`` escape hatch（覆盖 DashScope 等非标路径的稀有
      场景）。
    """
    base = base_url.rstrip("/")
    path = endpoint_path or _DEFAULT_RERANK_PATH
    if not path.startswith("/"):
        path = "/" + path

    if endpoint_path:
        return f"{base}{path}"
    return base if base.endswith(path) else f"{base}{path}"


class Reranker(BaseAIProvider[dict[str, Any]]):
    """Rerank provider。

    ``BaseAIProvider`` 的 ``_cache`` 此处存"配置快照 dict"而非持久 client —— 因为
    rerank 是无状态 HTTP 调用，没有客户端生命周期需要管理；真正复用的资源
    是 ``self._client`` 这一根常驻 httpx 客户端，独立于按指纹分桶的配置缓存。
    """

    section_name = "rerank"

    def __init__(self) -> None:
        super().__init__()
        # 常驻 AsyncClient：跨调用复用 TCP/TLS，避免每次握手开销
        self._client: httpx.AsyncClient | None = None

    # ──────────────────────────────────────────────────────────────────────
    # BaseAIProvider 钩子
    # ──────────────────────────────────────────────────────────────────────

    async def _fetch_config(self, tenant_id: int | None, *, force: bool) -> dict[str, Any]:
        from app.services.config import configuration_service

        return await configuration_service.get_rerank_config(tenant_id=tenant_id, force=force)

    async def _build_instance(self, conf: dict[str, Any], **override: Any) -> dict[str, Any]:
        # 缓存配置快照；``extra_body`` 在 CatWiki 中是 chat 专属字段，rerank
        # 协议无对应语义，故不读取。``endpoint_path`` 若 conf 中未设则为 None，
        # 由 ``resolve_rerank_url`` 走默认 ``/rerank``。
        return {
            "api_key": conf.get("api_key"),
            "base_url": conf.get("base_url"),
            "model": conf.get("model"),
            "enabled": conf.get("enabled", True),
            "endpoint_path": conf.get("endpoint_path"),
        }

    # ──────────────────────────────────────────────────────────────────────
    # 公共 API
    # ──────────────────────────────────────────────────────────────────────

    async def is_enabled(self, tenant_id: int | None = None) -> bool:
        """探测调用：仅查询当前租户的 rerank 配置是否启用，不写 usage signal。"""
        resolved = await self.resolve(tenant_id=tenant_id, emit_signal=False)
        return bool(resolved.instance.get("enabled"))

    async def rerank(
        self,
        query: str,
        documents: list[dict],
        top_n: int = 5,
        tenant_id: int | None = None,
        purpose: str | None = None,
    ) -> tuple[list[dict], dict[str, Any]]:
        """异步执行重排序。

        Returns:
            ``(docs, meta)``。``meta`` 包含 model / hash / enabled / applied —
            调用方可直接取用，无需再回配置服务。
            * ``enabled=False`` 或 docs 为空时：返回 ``docs[:top_n]``，
              ``applied=False``。
            * 重排失败时同样返回 ``docs[:top_n]``，``applied=False``。
        """
        resolved = await self.resolve(tenant_id=tenant_id, purpose=purpose)
        inst = resolved.instance
        meta: dict[str, Any] = {
            "model": resolved.model,
            "hash": resolved.hash,
            "enabled": bool(inst.get("enabled")),
            "applied": False,
        }

        if not inst["enabled"] or not documents:
            return documents[:top_n], meta

        try:
            start_time = time.time()
            api_key = inst["api_key"]
            base_url = inst["base_url"]
            model = inst["model"]

            # 按行业惯例构造 /v1/rerank payload（Cohere / Voyage / Jina 通用 schema）
            payload = {
                "model": model,
                "query": query,
                "documents": [doc["content"] for doc in documents],
                "top_n": top_n,
            }

            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }

            client = self._get_http_client()
            url = resolve_rerank_url(base_url, inst.get("endpoint_path"))

            logger.debug(
                f"♻️  [RERANK   ] Reranking | Model: {model} | Hash: {resolved.hash[:8]} | Input: {len(documents)}"
            )

            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            result_data = response.json()

            results = result_data.get("results", [])
            reranked_docs: list[dict] = []
            for item in results:
                idx = item["index"]
                # 用 `in` 判断而非 `or`——relevance_score=0.0 是合法低分，
                # `or` 会错误地回落到备用字段
                score = (
                    item["relevance_score"] if "relevance_score" in item else item.get("score", 0.0)
                )

                if idx < len(documents):
                    doc = documents[idx].copy()
                    doc["original_score"] = doc.get("score")
                    doc["rerank_score"] = score
                    doc["score"] = score
                    reranked_docs.append(doc)

            duration = time.time() - start_time
            logger.debug(
                f"✨ [RERANK   ] Done | Duration: {duration:.3f}s | Returned: {len(reranked_docs)}"
            )

            meta["applied"] = True
            return reranked_docs, meta

        except Exception as e:
            logger.error(f"❌ [Reranker] 重排序失败: {e}")
            return documents[:top_n], meta

    # ──────────────────────────────────────────────────────────────────────
    # 资源生命周期
    # ──────────────────────────────────────────────────────────────────────

    def _get_http_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=30.0,
                limits=httpx.Limits(
                    max_keepalive_connections=20,
                    max_connections=50,
                    keepalive_expiry=60.0,
                ),
            )
        return self._client

    async def aclose(self) -> None:
        """关闭常驻 HTTP 客户端 + 清空配置缓存。应在应用关闭钩子中调用。"""
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
        self._client = None
        await super().aclose()


# 模块级单例
reranker = Reranker()


__all__ = ["Reranker", "reranker", "resolve_rerank_url"]
