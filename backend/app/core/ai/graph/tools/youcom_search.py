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

"""You.com 网络搜索工具 —— 供 LangGraph Agent 调用。"""

import json
import logging
from typing import Annotated

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langgraph.prebuilt import InjectedState

from app.core.ai.providers.youcom import youcom_search_client
from app.core.infra.config import settings

logger = logging.getLogger(__name__)


@tool
async def search_web(
    query: str,
    config: RunnableConfig,
    state: Annotated[dict, InjectedState],
) -> str:
    """从互联网搜索相关信息。

    当需要最新资讯、实时数据或超出内部知识库范围的内容时使用本工具。
    对于事实性问题，**优先**使用 `search_knowledge_base`。

    Args:
        query: 搜索查询词，应为清晰的问题或关键词。

    Returns:
        JSON 格式的搜索结果列表，每项包含 title、url、content、evidence_id。
    """
    offset = int(state.get("source_offset", 0) or 0)

    logger.debug("🔧 [Tool] search_web: query='%s', offset=%s", query, offset)

    results = await youcom_search_client.search(
        query=query,
        top_k=settings.YOUCOM_SEARCH_TOP_K,
    )

    if not results:
        return "未找到相关网络结果。"

    formatted = []
    for i, r in enumerate(results):
        formatted.append(
            {
                "source_index": offset + i + 1,
                "title": r["title"],
                "content": r["content"],
                "metadata": {
                    "evidence_id": r["evidence_id"],
                    "url": r["url"],
                    "retrieval_source": "YOUCOM",
                    "score": r["score"],
                },
            }
        )

    return json.dumps(formatted, ensure_ascii=False)
