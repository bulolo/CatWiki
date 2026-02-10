# Copyright 2024 CatWiki Authors
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

"""Dakewe-Reranker 实现

使用 OpenAI 兼容的重排序接口对向量检索结果进行精排。
"""

import logging
import time
from typing import Any

import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)


class Reranker:
    """Reranker 处理类"""

    def __init__(self):
        self.api_key = None
        self.base_url = None
        self.model = None
        self._enabled = False

    async def _ensure_config(self):
        """确保配置已加载，使用全局配置管理器同步 API 配置"""
        from app.core.dynamic_config_manager import dynamic_config_manager

        # 获取数据库中的动态配置
        rerank_conf = await dynamic_config_manager.get_rerank_config()

        # 优先级：数据库动态配置 > 环境变量固化配置
        # 注意：dict.get() missing key returns None, which triggers the 'or' fallback
        self.api_key = rerank_conf.get("apiKey") or settings.AI_RERANK_API_KEY
        self.base_url = rerank_conf.get("baseUrl") or settings.AI_RERANK_API_BASE
        self.model = rerank_conf.get("model") or settings.AI_RERANK_MODEL

    @property
    def is_enabled(self) -> bool:
        """检查后端服务是否配置了 Reranker API"""
        return bool(self.api_key and self.base_url)

    async def rerank(self, query: str, documents: list[dict], top_n: int = 5) -> list[dict]:
        """
        异步执行重排序

        Args:
            query: 查询语句
            documents: 待排序的文档列表 (VectorRetrieveResponse 转化为字典)
            top_n: 返回的前 N 个结果

        Returns:
            重排序后的文档列表
        """

        # 每次或者定期加载配置
        await self._ensure_config()

        if not self.is_enabled or not documents:
            return documents[:top_n]

        try:
            start_time = time.time()

            # 准备请求数据
            # 兼容标准重排序接口格式: { "model": "...", "query": "...", "documents": ["...", "..."] }
            doc_contents = [doc["content"] for doc in documents]

            payload = {
                "model": self.model,
                "query": query,
                "documents": doc_contents,
                "top_n": top_n,
            }

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }

            # 使用 httpx 发送异步请求
            async with httpx.AsyncClient(timeout=30.0) as client:
                # 拼接完整的 API 地址，通常重排序端点是 /rerank
                url = self.base_url.rstrip("/")
                if not url.endswith("/rerank"):
                    url = f"{url}/rerank"

                logger.debug(
                    f"🚀 [Reranker] 发起请求: {url} | Model: {self.model} | Count: {len(documents)}"
                )

                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                result_data = response.json()

            # 解析结果
            # 结果通常是: { "results": [ { "index": 0, "relevance_score": 0.99 }, ... ] }
            results = result_data.get("results", [])

            reranked_docs = []
            for item in results:
                idx = item["index"]
                score = item.get("relevance_score") or item.get("score", 0.0)

                if idx < len(documents):
                    doc = documents[idx].copy()
                    # 记录原始分数以便对比
                    doc["original_score"] = doc.get("score")
                    doc["rerank_score"] = score
                    # 用 Rerank 分数替换原始分数作为最终排序依据
                    doc["score"] = score
                    reranked_docs.append(doc)

            duration = time.time() - start_time
            logger.warning(
                f"✨ [Reranker] 重排序完成 | 耗时: {duration:.3f}s | 输入: {len(documents)} | 返回: {len(reranked_docs)}"
            )

            return reranked_docs

        except Exception as e:
            logger.error(f"❌ [Reranker] 重排序失败: {e}", exc_info=True)
            # 失败则降级返回原始结果的前 top_n 条
            return documents[:top_n]


# 单例实例
reranker = Reranker()
