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
初始化平台默认管理员用户
"""

import asyncio
import logging
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

# 配置日志和导入应用组件
from app.core.common.logger import setup_logging
from app.crud.user import crud_user
from app.db.database import AsyncSessionLocal
from app.models.user import UserRole, UserStatus
from app.schemas.user import UserCreate

setup_logging()
logger = logging.getLogger(__name__)


async def create_default_admin_user():
    """创建默认平台管理员用户"""
    async with AsyncSessionLocal() as db:
        try:
            # 检查管理员是否已存在
            admin_email = "admin@example.com"
            user = await crud_user.get_by_email(db, email=admin_email)
            if not user:
                # 创建管理员 (平台级，tenant_id=None)
                user_in = UserCreate(
                    name="Admin",
                    email=admin_email,
                    password="admin123",
                    role=UserRole.ADMIN,
                    status=UserStatus.ACTIVE,
                    tenant_id=None,
                )
                user = await crud_user.create(db, obj_in=user_in)
                logger.info(f"✅ 创建默认平台管理员用户：{user.email} / admin123")
            else:
                logger.info(f"✅ 平台管理员用户已存在：{user.email}")
            return user
        except Exception as e:
            logger.error(f"❌ 创建管理员用户失败: {e}", exc_info=True)
            raise


async def main():
    logger.info("🚀 开始初始化平台管理员...")
    await create_default_admin_user()
    logger.info("✨ 平台管理员初始化完成！")


if __name__ == "__main__":
    asyncio.run(main())
