#!/usr/bin/env python3

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

"""
CatWiki 统一初始化入口
自动根据 CATWIKI_EDITION 环境变量执行对应版本的初始化
"""

import asyncio
import logging
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.common.logger import setup_logging
from app.core.infra.config import settings
from app.db.database import AsyncSessionLocal
from scripts.seeders.tenant_seeder import TenantSeeder

setup_logging()
logger = logging.getLogger(__name__)


async def init_database():
    """初始化数据库数据"""
    async with AsyncSessionLocal() as db:
        edition = settings.CATWIKI_EDITION
        logger.info(f"✨ 检测到系统版本: {edition.upper()}")

        # ========================
        # 社区版 (CE) 初始化
        # ========================
        logger.info("🌍 开始执行社区版 (CE) 初始化...")
        logger.info("  👉 社区版仅加载基础默认数据")

        # CE 版本仅需加载一个最基础的默认组织 (使用 health_care.json 的结构作为默认结构)
        # 在 CE 分支打包时，sync_ce.sh 会自动将 health_care.json 替换为单组织默认内容
        try:
            await TenantSeeder(db, "health_care.json").run()
        except Exception as e:
            await db.rollback()
            logger.error(f"❌ 导入社区版默认站点数据失败: {e}")

        logger.info("✅ 社区版 (CE) 数据库数据初始化完成")


def init_storage():
    """初始化对象存储"""
    logger.info("🗄️  开始初始化对象存储 (RustFS)...")
    try:
        from scripts.init_rustfs import init_rustfs

        init_rustfs()
        logger.info("✅ 对象存储初始化完成")
    except Exception as e:
        logger.error(f"❌ 对象存储初始化失败: {e}")


def main():
    """入口主函数"""
    logger.info("==========================================")
    logger.info("🚀 开始初始化 CatWiki...")
    logger.info("==========================================")

    try:
        # 1. 数据初始化 (CE/EE 区分)
        asyncio.run(init_database())
        print("")

        # 2. 存储初始化 (CE/EE 通用)
        init_storage()

        logger.info("==========================================")
        logger.info("🎉 CatWiki 初始化流程全部执行完毕！")
        logger.info("==========================================")
        sys.exit(0)
    except KeyboardInterrupt:
        logger.warning("\n⚠️  初始化被手动中断")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ 初始化过程发生致命错误: {e}", exc_info=True)
        # 初始化失败建议继续退出 0，不阻塞服务启动（目前其他 init 脚本也是这样设计的）
        sys.exit(0)


if __name__ == "__main__":
    main()
