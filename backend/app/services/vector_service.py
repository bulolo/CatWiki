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

import logging
import time
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from app.core.config import settings
from app.core.vector_store import VectorStoreManager
from app.core.reranker import reranker
from app.schemas.document import VectorRetrieveResponse, VectorRetrieveFilter

logger = logging.getLogger(__name__)


class VectorService:
    """向量检索服务 (RAG的核心逻辑)"""

    @classmethod
    async def retrieve(
        cls,
        query: str,
        k: int = 5,
        threshold: float = 0.0,
        filter: Optional[VectorRetrieveFilter] = None,
        enable_rerank: Optional[bool] = None,
        rerank_k: Optional[int] = None,
    ) -> List[VectorRetrieveResponse]:
        """
        执行语义检索（包含 召回 + 重排序）
        """
        logger.info(
            "\n"
            + "=" * 80
            + f"\n🚀 [VECTOR RETRIEVAL START]\n"
            + f"   Query: '{query}'\n"
            + f"   Params: k={k}, threshold={threshold}\n"
            + f"   Filter: {filter.model_dump() if filter else 'None'}\n"
            + "=" * 80
        )
        start_time = time.time()

        try:
            vector_store = await VectorStoreManager.get_instance()

            # 1. 构建动态过滤器
            filter_dict = {}
            if filter:
                # 只有当 site_id > 0 时才过滤站点；0 表示全局搜索
                if filter.site_id is not None and filter.site_id > 0:
                    filter_dict["site_id"] = filter.site_id
                if filter.id is not None:
                    filter_dict["id"] = str(filter.id)
                if filter.source is not None:
                    filter_dict["source"] = filter.source

            # 2. 决定检索数量
            # 确保 Reranker 配置是最新的
            await reranker._ensure_config()

            # 如果启用了 Rerank，初始召回数量需要增加
            recall_k = k
            do_rerank = enable_rerank if enable_rerank is not None else reranker.is_enabled

            if do_rerank:
                recall_k = max(recall_k * 5, 50)  # 至少召回 50 条用于精排
                logger.debug(f"🔍 [Retrieve] 启用重排序，初始召回数量: {recall_k}")

            # 3. 执行相似度搜索 (返回的是距离, distance)
            results = await vector_store.similarity_search_with_score(
                query=query, k=recall_k, filter=filter_dict if filter_dict else None
            )

            duration = time.time() - start_time
            logger.debug(
                f"✅ [Retrieve] 向量召回完成 | 数量: {len(results)} | 耗时: {duration:.3f}s"
            )

            # 4. 初步过滤相似度阈值并转换格式
            candidate_list = []
            for doc, distance in results:
                similarity = 1.0 - distance
                if similarity < threshold:
                    continue

                doc_id_val = doc.metadata.get("id")
                doc_title = doc.metadata.get("title")

                candidate_list.append(
                    {
                        "content": doc.page_content,
                        "score": similarity,
                        "document_id": int(doc_id_val) if doc_id_val else 0,
                        "document_title": doc_title,
                        "metadata": doc.metadata,
                        # 保留原始分数以便跟踪
                        "original_score": similarity,
                    }
                )

            # 5. 执行重排序 (如果启用)
            final_list = []
            if do_rerank:
                if candidate_list:
                    final_k = rerank_k or k
                    final_list = await reranker.rerank(
                        query=query, documents=candidate_list, top_n=final_k
                    )
                else:
                    logger.warning("⚠️ [Retrieve] 召回结果为空或均未通过阈值，跳过重排序")
                    final_list = []
            else:
                # 如果没启用 Rerank，直接截取 top k
                final_list = candidate_list[:k]

            # 6. 转换为响应对象
            response_objects = [VectorRetrieveResponse(**item) for item in final_list]

            # 日志
            log_lines = [f"✅ [Retrieve] 最终返回结果数: {len(response_objects)}"]
            for i, res in enumerate(response_objects):
                score_str = f"Score={res.score:.4f}"
                if res.original_score is not None and res.score != res.original_score:
                    score_str = f"Original={res.original_score:.4f} -> Final={res.score:.4f}"
                log_lines.append(
                    f"   #{i + 1}: {score_str} | Title: {res.document_title[:40] if res.document_title else 'N/A'}"
                )

            logger.info("\n" + "\n".join(log_lines))

            return response_objects

        except Exception as e:
            logger.error(f"❌ [Retrieve] 检索服务异常: {e}", exc_info=True)
            # 根据需求，这里可以选择抛出或者返回空列表
            # 为了稳健性，暂时返回空列表，但记录错误
            return []
