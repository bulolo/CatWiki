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
from typing import Any, Dict, Optional

import httpx
from app.core.infra.config import settings

logger = logging.getLogger(__name__)


class Reranker:
    """Reranker 处理类 (支持多配置实例隔离)"""

    def __init__(self):
        # 实例池: { hash: { "api_key": ..., "base_url": ..., "model": ... } }
        self._instances: Dict[str, Dict[str, Any]] = {}

    async def _get_instance_config(self, tenant_id: int | None = None) -> Dict[str, Any]:
        """获取并确认为当前上下文准备的配置实例"""
        from app.core.ai.dynamic_config_manager import dynamic_config_manager

        # 获取数据库或缓存中的动态配置
        rerank_conf = await dynamic_config_manager.get_rerank_config(tenant_id=tenant_id)
        conf_hash = rerank_conf.get("_hash")

        # 构造最终执行所需的配置（按指纹隔离）
        if conf_hash not in self._instances:
            # 优先级：数据库动态配置 > 环境变量固化配置
            api_key = rerank_conf.get("apiKey") or settings.AI_RERANK_API_KEY
            base_url = rerank_conf.get("baseUrl") or settings.AI_RERANK_API_BASE
            model = rerank_conf.get("model") or settings.AI_RERANK_MODEL
            
            self._instances[conf_hash] = {
                "api_key": api_key,
                "base_url": base_url,
                "model": model,
                "enabled": bool(api_key and base_url)
            }
            logger.info(f"✨ [Reranker] 已准备新配置实例 (Hash: {conf_hash[:8]}, Model: {model})")
        
        return self._instances[conf_hash]

    async def is_enabled(self, tenant_id: int | None = None) -> bool:
        """检查特定上下文下的 Reranker 是否可用"""
        inst = await self._get_instance_config(tenant_id=tenant_id)
        return inst["enabled"]

    async def rerank(self, query: str, documents: list[dict], top_n: int = 5, tenant_id: int | None = None) -> list[dict]:
        """
        异步执行重排序
        """
        # 1. 获取对应租户/指纹的实例配置
        inst = await self._get_instance_config(tenant_id=tenant_id)
        
        if not inst["enabled"] or not documents:
            return documents[:top_n]

        try:
            start_time = time.time()
            api_key = inst["api_key"]
            base_url = inst["base_url"]
            model = inst["model"]

            # 准备请求数据
            doc_contents = [doc["content"] for doc in documents]
            payload = {
                "model": model,
                "query": query,
                "documents": doc_contents,
                "top_n": top_n,
            }

            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }

            # 使用 httpx 发送异步请求
            async with httpx.AsyncClient(timeout=30.0) as client:
                url = base_url.rstrip("/")
                if not url.endswith("/rerank"):
                    url = f"{url}/rerank"

                logger.debug(
                    f"🚀 [Reranker] 发起请求: {url} | Model: {model} | Hash: {list(self._instances.keys())[0][:8]}..."
                )

                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                result_data = response.json()

            # 解析结果
            results = result_data.get("results", [])
            reranked_docs = []
            for item in results:
                idx = item["index"]
                score = item.get("relevance_score") or item.get("score", 0.0)

                if idx < len(documents):
                    doc = documents[idx].copy()
                    doc["original_score"] = doc.get("score")
                    doc["rerank_score"] = score
                    doc["score"] = score
                    reranked_docs.append(doc)

            duration = time.time() - start_time
            logger.info(
                f"✨ [Reranker] 重排序完成 | 耗时: {duration:.3f}s | 模型: {model} | 输入: {len(documents)} | 返回: {len(reranked_docs)}"
            )

            return reranked_docs

        except Exception as e:
            logger.error(f"❌ [Reranker] 重排序失败: {e}")
            return documents[:top_n]


# 单例容器，但内部支持多实例配置隔离
reranker = Reranker()
