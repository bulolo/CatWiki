# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""AI Provider 包公共入口。

调用方应直接从本包导入 provider 单例，无需感知子模块路径：

    from app.core.ai.providers import chat_provider, embedding_provider, reranker

每个 provider 都封装了"读配置 → 缓存/构造实例 → 打 usage signal"，并通过
``BaseAIProvider`` 统一了 fast/slow path + double-check locking。
"""

from app.core.ai.providers.base import BaseAIProvider, Resolved
from app.core.ai.providers.chat import ChatProvider, chat_provider
from app.core.ai.providers.embedding import EmbeddingProvider, embedding_provider
from app.core.ai.providers.openai_embeddings import OpenAICompatibleEmbeddings
from app.core.ai.providers.reranker import Reranker, reranker, resolve_rerank_url

__all__ = [
    "BaseAIProvider",
    "Resolved",
    "ChatProvider",
    "chat_provider",
    "EmbeddingProvider",
    "embedding_provider",
    "Reranker",
    "reranker",
    "resolve_rerank_url",
    "OpenAICompatibleEmbeddings",
]
