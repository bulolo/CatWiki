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

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from pydantic import BaseModel

from app.schemas.system_config import DocProcessorConfig


class ParsedResult(BaseModel):
    """文档解析结果"""

    content: str
    markdown: str
    images: list[str] = []
    metadata: Dict[str, Any] = {}


class BaseDocProcessor(ABC):
    """
    文档处理服务抽象基类
    所有具体的解析器都应该继承此类并实现相应方法
    """

    def __init__(self, config: DocProcessorConfig):
        self.config = config
        self.timeout = 30.0  # 默认超时时间

    @property
    def name(self) -> str:
        return self.config.name

    @property
    def base_url(self) -> str:
        return self.config.baseUrl.rstrip("/")

    @property
    def api_key(self) -> str:
        return self.config.apiKey

    @abstractmethod
    async def check_health(self) -> bool:
        """
        检查服务是否可用
        Returns:
            bool: True if healthy, False otherwise
        """
        pass

    @abstractmethod
    async def process(self, file_path: Any, **kwargs) -> ParsedResult:
        """
        解析文件

        Args:
            file_path: 文件路径
            **kwargs: 额外参数

        Returns:
            ParsedResult: 解析结果
        """
        pass
