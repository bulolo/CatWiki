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

"""OpenAI 兼容的 Embeddings 实现。

支持任何 OpenAI API 兼容的服务（DashScope、vLLM、Ollama、自部署模型等）。
"""

import asyncio
import logging

from langchain_core.embeddings import Embeddings
from openai import AsyncOpenAI, AuthenticationError

logger = logging.getLogger(__name__)


class OpenAICompatibleEmbeddings(Embeddings):
    """OpenAI ``/v1/embeddings`` 兼容客户端。

    注意：构造期 **不接收 ``extra_body``**。在 CatWiki 中该字段是 chat 模型的
    reasoning 开关（如 ``enable_thinking``），对 embedding 协议无意义；若误透传
    到此处，部分严格的 provider 会以 400 拒绝请求。embedding 配置层的
    ``extra_body`` 字段不再被消费。
    """

    def __init__(
        self,
        model: str,
        api_key: str,
        base_url: str,
        max_retries: int = 3,
        timeout: float = 60.0,
        embedding_batch_size: int = 10,
        batch_concurrency: int = 5,
    ):
        self.model = model
        self.embedding_batch_size = embedding_batch_size
        self.batch_concurrency = max(1, batch_concurrency)
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            max_retries=max_retries,
            timeout=timeout,
        )

    async def aembed_documents(self, texts: list[str]) -> list[list[float]]:
        """批量异步嵌入。

        按 ``embedding_batch_size`` 切片为 N 个 batch，用 ``Semaphore`` 限流并行
        发送（默认并发 ``batch_concurrency=5``）。返回顺序与 ``texts`` 输入顺序
        一致（``asyncio.gather`` 保序）。
        """
        if not texts:
            return []

        batch_size = self.embedding_batch_size
        sem = asyncio.Semaphore(self.batch_concurrency)

        async def _embed_batch(batch: list[str]) -> list[list[float]]:
            async with sem:
                try:
                    response = await self.client.embeddings.create(model=self.model, input=batch)
                    return [item.embedding for item in response.data]
                except AuthenticationError:
                    self._log_auth_error()
                    raise

        batches = [texts[i : i + batch_size] for i in range(0, len(texts), batch_size)]
        results = await asyncio.gather(*(_embed_batch(b) for b in batches))
        return [vec for batch_result in results for vec in batch_result]

    async def aembed_query(self, text: str) -> list[float]:
        """异步嵌入单个查询。"""
        try:
            response = await self.client.embeddings.create(model=self.model, input=text)
            return response.data[0].embedding
        except AuthenticationError:
            self._log_auth_error()
            raise

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """同步嵌入多个文档。"""
        return asyncio.run(self.aembed_documents(texts))

    def embed_query(self, text: str) -> list[float]:
        """同步嵌入单个查询。"""
        return asyncio.run(self.aembed_query(text))

    # ──────────────────────────────────────────────────────────────────────
    # Internal helpers
    # ──────────────────────────────────────────────────────────────────────

    def _log_auth_error(self) -> None:
        """打印掩码后的 401 诊断信息（aembed_documents / aembed_query 共用）。"""
        api_key = self.client.api_key
        key_preview = f"{api_key[:6]}...{api_key[-4:]}" if api_key else "None"
        logger.error(
            "❌ Embeddings 认证失败 (401 Unauthorized)\n"
            f"   API Base: {self.client.base_url}\n"
            f"   API Key: {key_preview}\n"
            "   请检查 .env 文件中的 AI_EMBEDDING_API_KEY 配置是否正确。"
        )
