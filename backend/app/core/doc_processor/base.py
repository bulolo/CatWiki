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
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from app.schemas.system_config import DocProcessorConfig


class ParsedResult(BaseModel):
    """文档解析结果"""

    content: str
    markdown: str
    images: list[str] = []
    metadata: dict[str, Any] = {}


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
        return self.config.base_url.rstrip("/")

    @property
    def api_key(self) -> str:
        return self.config.api_key

    @abstractmethod
    async def is_healthy(self) -> bool:
        """检查服务是否可用"""
        pass

    async def get_version(self) -> str | None:
        """获取服务版本号，子类可按需覆盖"""
        return None

    @abstractmethod
    async def process(self, file_path: Path, **kwargs) -> ParsedResult:
        """
        解析文件

        Args:
            file_path: 文件路径
            **kwargs: 额外参数

        Returns:
            ParsedResult: 解析结果
        """
        pass
