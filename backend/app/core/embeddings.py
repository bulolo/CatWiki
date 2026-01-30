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
    ):
        self.model = model
        self.client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            max_retries=max_retries,
            timeout=timeout,
        )

    async def aembed_documents(self, texts: list[str]) -> list[list[float]]:
        """异步嵌入多个文档"""
        try:
            response = await self.client.embeddings.create(
                model=self.model,
                input=texts
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            from openai import AuthenticationError
            if isinstance(e, AuthenticationError):
                key_preview = f"{self.client.api_key[:6]}...{self.client.api_key[-4:]}" if self.client.api_key else "None"
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
            response = await self.client.embeddings.create(
                model=self.model,
                input=text
            )
            return response.data[0].embedding
        except Exception as e:
            from openai import AuthenticationError
            if isinstance(e, AuthenticationError):
                key_preview = f"{self.client.api_key[:6]}...{self.client.api_key[-4:]}" if self.client.api_key else "None"
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

