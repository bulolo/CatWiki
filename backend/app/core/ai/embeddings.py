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

"""OpenAI 兼容的 Embeddings 实现

支持任何 OpenAI API 兼容的服务（DashScope、vLLM、Ollama、自部署模型等）
"""

import asyncio

from langchain_core.embeddings import Embeddings
from openai import AsyncOpenAI


class OpenAICompatibleEmbeddings(Embeddings):
    """OpenAI 兼容的 Embeddings 类

    使用标准 AsyncOpenAI 客户端，兼容所有 OpenAI API 格式的服务
    """

    def __init__(
        self,
        model: str,
        api_key: str,
        base_url: str,
        max_retries: int = 3,
        timeout: float = 60.0,
        embedding_batch_size: int = 10,
    ):
        self.model = model
        self.embedding_batch_size = embedding_batch_size
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            max_retries=max_retries,
            timeout=timeout,
        )

    def update_credentials(
        self, api_key: str, base_url: str, model: str, embedding_batch_size: int | None = None
    ):
        """更新客户端凭证

        Args:
            embedding_batch_size: 可选，如果提供则更新 Embedding API 分批大小
        """
        self.model = model
        if embedding_batch_size is not None:
            self.embedding_batch_size = embedding_batch_size
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            max_retries=self.client.max_retries,
            timeout=self.client.timeout,
        )

    async def aembed_documents(self, texts: list[str]) -> list[list[float]]:
        """异步嵌入多个文档（自动分批处理以防止超过 API 限制）"""
        try:
            # 分批处理，防止超过服务商的单次请求限制
            all_embeddings: list[list[float]] = []
            batch_size = self.embedding_batch_size

            for i in range(0, len(texts), batch_size):
                batch = texts[i : i + batch_size]
                response = await self.client.embeddings.create(model=self.model, input=batch)
                all_embeddings.extend([item.embedding for item in response.data])

            return all_embeddings
        except Exception as e:
            from openai import AuthenticationError

            if isinstance(e, AuthenticationError):
                key_preview = (
                    f"{self.client.api_key[:6]}...{self.client.api_key[-4:]}"
                    if self.client.api_key
                    else "None"
                )
                error_msg = (
                    f"❌ Embeddings 认证失败 (401 Unauthorized)\n"
                    f"   API Base: {self.client.base_url}\n"
                    f"   API Key: {key_preview}\n"
                    f"   请检查 .env 文件中的 AI_EMBEDDING_API_KEY 配置是否正确。"
                )
                import logging

                logging.getLogger(__name__).error(error_msg)
            raise e

    async def aembed_query(self, text: str) -> list[float]:
        """异步嵌入单个查询"""
        try:
            response = await self.client.embeddings.create(model=self.model, input=text)
            return response.data[0].embedding
        except Exception as e:
            from openai import AuthenticationError

            if isinstance(e, AuthenticationError):
                key_preview = (
                    f"{self.client.api_key[:6]}...{self.client.api_key[-4:]}"
                    if self.client.api_key
                    else "None"
                )
                error_msg = (
                    f"❌ Embeddings 认证失败 (401 Unauthorized)\n"
                    f"   API Base: {self.client.base_url}\n"
                    f"   API Key: {key_preview}\n"
                    f"   请检查 .env 文件中的 AI_EMBEDDING_API_KEY 配置是否正确。"
                )
                import logging

                logging.getLogger(__name__).error(error_msg)
            raise e

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """同步嵌入多个文档"""
        return asyncio.run(self.aembed_documents(texts))

    def embed_query(self, text: str) -> list[float]:
        """同步嵌入单个查询"""
        return asyncio.run(self.aembed_query(text))
