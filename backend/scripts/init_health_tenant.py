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
初始化 Health 站点和医学知识文档 (Refactored to use Seeder)
"""

import asyncio
import logging
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.common.logger import setup_logging
from app.db.database import AsyncSessionLocal
from scripts.seeders.tenant_seeder import TenantSeeder

setup_logging()
logger = logging.getLogger(__name__)


async def main():
    async with AsyncSessionLocal() as db:
        try:
            # 使用通用 TenantSeeder，指定配置文件名为 health_care.json
            seeder = TenantSeeder(db, "health_care.json")
            await seeder.run()
        except Exception as e:
            logger.error(f"❌ 初始化失败: {e}", exc_info=True)
            raise


if __name__ == "__main__":
    asyncio.run(main())
