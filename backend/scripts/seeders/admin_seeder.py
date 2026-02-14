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
Admin Seeder - 平台管理员播种器
"""

import json
from pathlib import Path

from app.crud.user import crud_user
from app.models.user import UserRole, UserStatus
from app.schemas.user import UserCreate
from scripts.seeders.base_seeder import BaseSeeder


class AdminSeeder(BaseSeeder):
    """平台管理员数据播种器"""

    def __init__(self, db):
        super().__init__(db)
        self.data_path = Path(__file__).parent.parent / "data" / "admin.json"
        
        # 加载数据
        with open(self.data_path, "r", encoding="utf-8") as f:
            self.data = json.load(f)

    async def run(self):
        """执行播种"""
        await self.log("🚀 开始初始化平台管理员...")
        await self.create_default_admin()
        await self.log("✨ 平台管理员初始化完成！")

    async def create_default_admin(self):
        """创建默认平台管理员用户"""
        u_data = self.data["admin"]
        user = await crud_user.get_by_email(self.db, email=u_data["email"])
        
        if not user:
            user_in = UserCreate(
                name=u_data["name"],
                email=u_data["email"],
                password=u_data["password"],
                role=UserRole(u_data["role"]),
                status=UserStatus(u_data["status"]),
                tenant_id=None,
            )
            user = await crud_user.create(self.db, obj_in=user_in)
            await self.log(f"✅ 创建管理员：{user.email}")
        else:
            await self.log(f"✅ 管理员已存在：{user.email}")
        return user
