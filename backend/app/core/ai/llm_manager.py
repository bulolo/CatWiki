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

import logging
from typing import Dict, Optional
from langchain_openai import ChatOpenAI
from app.services.configuration_service import configuration_service

logger = logging.getLogger(__name__)


class LLMManager:
    """LLM 实例管理器 (单例池)

    基于配置指纹 (Hash) 管理 ChatOpenAI 实例，实现连接复用。
    """

    _instance: Optional["LLMManager"] = None
    _models: Dict[str, ChatOpenAI] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(LLMManager, cls).__new__(cls)
        return cls._instance

    @classmethod
    def get_instance(cls) -> "LLMManager":
        if cls._instance is None:
            cls._instance = LLMManager()
        return cls._instance

    async def get_model(
        self, tenant_id: Optional[int] = None, temperature: float = 0.7, force: bool = False
    ) -> ChatOpenAI:
        """根据租户获取模型实例 (带缓存)"""

        # 1. 获取配置
        config = await configuration_service.get_chat_config(tenant_id=tenant_id, force=force)
        conf_hash = config.get("_hash")

        # 为了支持不同 Temperature 的复用，将 Temperature 混入索引 Key
        # 实际上 ChatOpenAI 实例通常可以设置不同的 temperature，但为了保险起见，
        # 我们按 (Hash, Temp) 进行对象级别复用
        pool_key = f"{conf_hash}_{temperature}"

        # 2. 检查池化缓存
        if pool_key in self._models and not force:
            logger.debug(
                f"⚡ [LLMManager] Reusing Chat model instance (Hash: {conf_hash[:8]}, Temp: {temperature})"
            )
            return self._models[pool_key]

        # 3. 初始化新实例
        logger.info(
            f"🔄 [LLMManager] Initializing new Chat model... "
            f"(Tenant: {tenant_id}, Model: {config.get('model')}, Temp: {temperature}, Hash: {conf_hash[:8]})"
        )

        new_llm = ChatOpenAI(
            model=config["model"],
            api_key=config["apiKey"],
            base_url=config["baseUrl"],
            temperature=temperature,
            streaming=True,
        )

        self._models[pool_key] = new_llm
        return new_llm


llm_manager = LLMManager.get_instance()
