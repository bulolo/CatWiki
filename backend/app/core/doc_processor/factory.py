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


from app.core.doc_processor.base import BaseDocProcessor
from app.schemas.system_config import DocProcessorConfig, DocProcessorType


class DocProcessorFactory:
    """
    文档处理服务工厂类
    负责注册和创建具体的解析器实例
    """

    _registry: dict[DocProcessorType, type[BaseDocProcessor]] = {}

    @classmethod
    def register(cls, processor_type: DocProcessorType, processor_cls: type[BaseDocProcessor]):
        """
        注册解析器类
        """
        cls._registry[processor_type] = processor_cls

    @classmethod
    def get_processor(cls, config: DocProcessorConfig) -> BaseDocProcessor:
        """
        获取解析器实例
        """
        processor_cls = cls._registry.get(config.type)
        if not processor_cls:
            raise ValueError(f"不支持的文档处理服务类型: {config.type}")

        return processor_cls(config)

    @classmethod
    def create(cls, config: DocProcessorConfig) -> BaseDocProcessor:
        """
        create 的别名，更符合工厂模式命名习惯
        """
        return cls.get_processor(config)
