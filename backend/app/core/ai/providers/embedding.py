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

"""Embedding Provider —— OpenAI ``/v1/embeddings`` 兼容。

运行时对象是 ``OpenAICompatibleEmbeddings``（内部走 AsyncOpenAI 客户端），所有
字段（``model`` / ``api_key`` / ``base_url`` / ``dimensions``）都是 OpenAI 标准
请求字段。元数据通过 ``Resolved[OpenAICompatibleEmbeddings]`` 显式回传给调用方。
"""

import logging
from typing import Any

from app.core.ai.providers.base import BaseAIProvider
from app.core.ai.providers.openai_embeddings import OpenAICompatibleEmbeddings

logger = logging.getLogger(__name__)


class EmbeddingProvider(BaseAIProvider[OpenAICompatibleEmbeddings]):
    """OpenAI-compatible embeddings provider。"""

    section_name = "embedding"

    async def _fetch_config(self, tenant_id: int | None, *, force: bool) -> dict[str, Any]:
        from app.core.infra.tenant import get_current_tenant
        from app.services.config import configuration_service

        resolved_id = tenant_id if tenant_id is not None else get_current_tenant()
        return await configuration_service.get_embedding_config(tenant_id=resolved_id, force=force)

    def _signal_extras(self, conf: dict[str, Any], **override: Any) -> dict[str, Any]:
        # Dimension 保留原始类型（int 或 None）：下游 vector schema init 需要 int，
        # 日志打印自然 stringify。不把 None 改写成 "auto" 是为了避免在数值上下文
        # 触发 ``int("auto")`` 这种错误。
        return {
            **super()._signal_extras(conf),
            "Dimension": conf.get("dimension"),
        }

    async def _build_instance(
        self, conf: dict[str, Any], **override: Any
    ) -> OpenAICompatibleEmbeddings:
        from app.core.infra.config import settings

        return OpenAICompatibleEmbeddings(
            model=conf.get("model", "N/A"),
            api_key=conf.get("api_key"),
            base_url=conf.get("base_url"),
            embedding_batch_size=settings.AI_EMBEDDING_BATCH_SIZE,
            batch_concurrency=settings.AI_EMBEDDING_BATCH_CONCURRENCY,
        )


embedding_provider = EmbeddingProvider()


__all__ = ["EmbeddingProvider", "embedding_provider"]
