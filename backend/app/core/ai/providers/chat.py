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

"""Chat Provider —— OpenAI ``/v1/chat/completions`` 兼容。

运行时对象是 ``langchain_openai.ChatOpenAI``，底层走 AsyncOpenAI 客户端，所有
字段（``model`` / ``api_key`` / ``base_url`` / ``temperature`` / ``streaming`` /
``extra_body`` / ``timeout``）都是 OpenAI 标准请求字段。
"""

import logging
from typing import Any

from langchain_openai import ChatOpenAI

from app.core.ai.providers.base import BaseAIProvider

logger = logging.getLogger(__name__)


class ChatProvider(BaseAIProvider[ChatOpenAI]):
    """OpenAI chat completions provider。

    缓存键包含 ``model`` / ``temperature`` ：同一指纹下，不同 model override 或
    不同 temperature 视为不同实例（OpenAI 客户端绑定 temperature 在构造期）。
    """

    section_name = "chat"

    async def _fetch_config(self, tenant_id: int | None, *, force: bool) -> dict[str, Any]:
        from app.services.config import configuration_service

        return await configuration_service.get_chat_config(tenant_id=tenant_id, force=force)

    def _cache_key(
        self,
        conf: dict[str, Any],
        *,
        model: str | None = None,
        temperature: float = 0.7,
    ) -> str:
        effective_model = model or conf.get("model") or "gpt-3.5-turbo"
        return f"{conf.get('_hash', '')}_{effective_model}_{temperature}"

    def _signal_extras(
        self,
        conf: dict[str, Any],
        *,
        model: str | None = None,
        temperature: float = 0.7,
    ) -> dict[str, Any]:
        return {
            **super()._signal_extras(conf),
            "Temperature": temperature,
        }

    async def _build_instance(
        self,
        conf: dict[str, Any],
        *,
        model: str | None = None,
        temperature: float = 0.7,
    ) -> ChatOpenAI:
        effective_model = model or conf.get("model") or "gpt-3.5-turbo"
        extra_body = conf.get("extra_body") or None
        return ChatOpenAI(
            model=effective_model,
            api_key=conf.get("api_key"),
            base_url=conf.get("base_url"),
            temperature=temperature,
            streaming=True,
            extra_body=extra_body,
            timeout=300,
        )

    async def get_model(
        self,
        tenant_id: int | None = None,
        model_name: str | None = None,
        temperature: float = 0.7,
        force: bool = False,
        purpose: str | None = None,
    ) -> ChatOpenAI:
        """返回 ``ChatOpenAI`` 实例的便捷方法。

        仅返回 instance；调用方若需要 model / hash / tenant 等元数据，
        应直接调用 ``resolve()`` 拿 ``Resolved[ChatOpenAI]``。
        """
        resolved = await self.resolve(
            tenant_id=tenant_id,
            force=force,
            purpose=purpose,
            model=model_name,
            temperature=temperature,
        )
        return resolved.instance


chat_provider = ChatProvider()


__all__ = ["ChatProvider", "chat_provider"]
