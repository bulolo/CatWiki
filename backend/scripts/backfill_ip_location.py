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
历史数据回填脚本：为已有的 document_view_events 填充 location 字段
"""

import asyncio

from sqlalchemy import select, update

from app.core.common.ip_utils import get_ip_location
from app.db.database import AsyncSessionLocal
from app.models.document_view_event import DocumentViewEvent


async def backfill():
    print("🔍 开始扫描需要回填归属地的数据...")
    async with AsyncSessionLocal() as db:
        # 查找所有 location 为空的记录
        result = await db.execute(
            select(DocumentViewEvent.ip_address)
            .where(DocumentViewEvent.location.is_(None))
            .where(DocumentViewEvent.ip_address.isnot(None))
            .distinct()
        )
        unique_ips = [r[0] for r in result.all()]

        if not unique_ips:
            print("✅ 没有需要回填的数据。")
            return

        print(f"📦 发现 {len(unique_ips)} 个唯一 IP 需要解析。")

        count = 0
        for ip in unique_ips:
            location = get_ip_location(ip)
            # 更新该 IP 的所有记录
            await db.execute(
                update(DocumentViewEvent)
                .where(DocumentViewEvent.ip_address == ip)
                .where(DocumentViewEvent.location.is_(None))
                .values(location=location)
            )
            count += 1
            if count % 10 == 0:
                print(f"⏳ 已处理 {count}/{len(unique_ips)} 个 IP...")

        await db.commit()
        print(f"🎉 回填完成！共处理 {len(unique_ips)} 个 IP 的历史记录。")


if __name__ == "__main__":
    asyncio.run(backfill())
