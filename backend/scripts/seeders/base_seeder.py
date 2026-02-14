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

"""
Base Seeder - 数据播种基类
"""

import logging
from abc import ABC, abstractmethod
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class BaseSeeder(ABC):
    """数据播种基类"""

    def __init__(self, db: AsyncSession):
        self.db = db

    @abstractmethod
    async def run(self, *args, **kwargs) -> Any:
        """执行播种逻辑"""
        pass

    async def log(self, message: str):
        """记录日志"""
        logger.info(f"🌱 [Seeder] {message}")
