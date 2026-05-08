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
IP 归属地查询工具 (EE 版使用)

使用 ip2region 离线数据库，无需外网请求，查询速度微秒级。
数据库文件路径：app/core/common/ip2region/ip2region.xdb
"""

import asyncio
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# 数据库文件跟随代码包，确保 git 提交且部署即用
_XDB_PATH = str(Path(__file__).parent / "ip2region" / "ip2region.xdb")

# 全量加载到内存（~10MB），后续查询完全离线，线程安全
_cb: bytes | None = None
_searcher = None


def _get_searcher():
    global _cb, _searcher
    if _searcher is not None:
        return _searcher
    try:
        from .ip2region import searcher, util

        if not Path(_XDB_PATH).exists():
            logger.warning(f"ip2region 数据库文件不存在: {_XDB_PATH}")
            return None

        # 加载内容并获取版本信息
        _cb = util.load_content_from_file(_XDB_PATH)
        header = util.load_header_from_file(_XDB_PATH)
        version = util.version_from_header(header)

        # 创建搜索器（内存模式）
        _searcher = searcher.new_with_buffer(version, _cb)
        logger.info("ip2region 数据库加载成功（内存模式）")
    except Exception as e:
        logger.warning(f"ip2region 初始化失败，将跳过归属地查询: {e}", exc_info=True)
        _searcher = None
    return _searcher


def _is_private_ip(ip: str) -> str | None:
    """判断是否为私有/保留 IP，是则返回标签，否则返回 None"""
    if not ip:
        return "未知"
    if ip in ("127.0.0.1", "::1", "0.0.0.0"):
        return "本地回环"
    parts = ip.split(".")
    if len(parts) == 4:
        try:
            a, b = int(parts[0]), int(parts[1])
            if a == 10:
                return "局域网"
            if a == 172 and 16 <= b <= 31:
                return "局域网"
            if a == 192 and b == 168:
                return "局域网"
        except ValueError:
            pass
    return None


def get_ip_location(ip: str) -> str:
    """
    同步查询 IP 归属地（适合在非异步上下文中直接调用）。
    返回格式示例：
      - "中国|广东省|深圳市"  → "广东省 深圳市"
      - "美国|0|0"           → "美国"
      - "局域网"、"本地回环"
    """
    private = _is_private_ip(ip)
    if private:
        return private

    try:
        s = _get_searcher()
        if s is None:
            return "未知位置"

        region = s.search(ip)  # e.g. "中国|0|广东省|深圳市|电信"
        if not region:
            return "未知位置"

        parts = [p for p in region.split("|") if p and p != "0"]

        if not parts:
            return "未知位置"

        country = parts[0]
        if country != "中国":
            # 海外只返回国家名
            return country

        # 国内：省份 + 城市
        province = parts[2] if len(parts) > 2 else ""
        city = parts[3] if len(parts) > 3 else ""
        if city and city != province:
            return f"{province} {city}".strip()
        return province or "中国"

    except Exception as e:
        logger.debug(f"ip2region 查询失败 ({ip}): {e}")
        return "未知位置"


async def get_ip_location_async(ip: str) -> str:
    """
    异步友好版本（在事件循环中用 run_in_executor 包裹同步调用）。
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, get_ip_location, ip)


async def update_event_location_task(event_id: int, ip: str):
    """
    FastAPI BackgroundTask：后台解析 IP 并更新数据库记录
    """
    from sqlalchemy import update

    from app.db.database import AsyncSessionLocal
    from app.models.document_view_event import DocumentViewEvent

    location = get_ip_location(ip)
    if not location or location == "未知位置":
        return

    async with AsyncSessionLocal() as db:
        await db.execute(
            update(DocumentViewEvent)
            .where(DocumentViewEvent.id == event_id)
            .values(location=location)
        )
        await db.commit()
        logger.debug(f"已在后台完成事件 {event_id} 的地理位置回填: {location}")
