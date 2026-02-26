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

import logging
import time

from app.core.ai.providers.reranker import reranker
from app.core.infra.config import settings
from app.core.common.utils import rag_stats_var
from app.core.vector.vector_store import VectorStoreManager
from app.schemas.document import VectorRetrieveFilter, VectorRetrieveResponse

logger = logging.getLogger(__name__)


class RAGService:
    """RAG 检索增强服务 (召回 + 重排)"""

    @classmethod
    async def retrieve(
        cls,
        query: str,
        k: int | None = None,
        threshold: float | None = None,
        filter: VectorRetrieveFilter | None = None,
        enable_rerank: bool | None = None,
        rerank_k: int | None = None,
    ) -> list[VectorRetrieveResponse]:
        """
        执行语义检索（包含 召回 + 重排序）
        """
        # 使用环境变量作为默认值
        final_top_k = k if k is not None else settings.RAG_RERANK_TOP_K
        final_threshold = threshold if threshold is not None else settings.RAG_RECALL_THRESHOLD

        start_time = time.time()

        try:
            logger.info(
                f"🚀 [RAG] Query: '{query}' | Site: {filter.site_id if filter else 'Global'}"
            )
            # 1. 获取向量索引实例 (支持多租户隔离)
            vector_store = await VectorStoreManager.get_instance(purpose="初始化向量检索引擎")
            if not vector_store:
                logger.error("❌ [RAG] Vector store not initialized")
                return []

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

            # 2. 决定检索数量与重排序策略
            # 获取当前租户上下文以获取正确的配置指纹
            from app.core.infra.tenant import get_current_tenant

            current_tenant_id = get_current_tenant()

            # 强制注入租户ID过滤（安全核心）
            if current_tenant_id is not None:
                filter_dict["tenant_id"] = current_tenant_id

            # 确定是否使用重排序 (异步校验租户配置)
            reranker_active = await reranker.is_enabled(
                tenant_id=current_tenant_id, purpose="检查重排服务可用性"
            )
            env_rerank_enabled = settings.RAG_ENABLE_RERANK

            # 只有在 reranker 实例可用 (有配置) 且业务逻辑请求启用时才真正执行
            should_apply_rerank = env_rerank_enabled and reranker_active
            if enable_rerank is not None:
                should_apply_rerank = enable_rerank and reranker_active

            # 计算召回深度 recall_k
            # 如果要重排序，则按照环境变量设定的 RECALL_K 召回，但为保证精排质量，召回深度应至少为 final_top_k 的 2 倍
            if should_apply_rerank:
                recall_k = max(settings.RAG_RECALL_K, final_top_k * 2)
            else:
                recall_k = final_top_k

            # 应用全局硬上限保护
            recall_k = min(recall_k, settings.RAG_RECALL_MAX)

            # 3. 执行相似度搜索
            results = await vector_store.similarity_search_with_score(
                query=query,
                k=recall_k,
                filter=filter_dict if filter_dict else None,
                purpose="执行语义检索 (Recall)",
            )

            # 4. 转换候选集 (直接转换，不进行合并)
            candidate_list = []
            if results:
                for doc, distance in results:
                    similarity = 1.0 - distance
                    if similarity < final_threshold:
                        continue

                    candidate_list.append(
                        {
                            "content": doc.page_content,
                            "score": similarity,
                            "document_id": int(doc.metadata.get("id", 0)),
                            "document_title": doc.metadata.get("title"),
                            "metadata": doc.metadata,
                            "original_score": similarity,
                        }
                    )

            # 5. 执行重排序 (如果启用)
            final_list = []
            if should_apply_rerank and candidate_list:
                reranked_results = await reranker.rerank(
                    query=query,
                    documents=candidate_list,
                    top_n=final_top_k,
                    tenant_id=current_tenant_id,
                    purpose="对召回结果进行精排 (Rerank)",
                )
                final_list = reranked_results
            else:
                # 没启用 Rerank 则按分数排序取 top k
                candidate_list.sort(key=lambda x: x["score"], reverse=True)
                final_list = candidate_list[:final_top_k]

            # 6. 转换为响应对象
            response_objects = [VectorRetrieveResponse(**item) for item in final_list]

            # 7. 暂存统计数据并打印单轮 INFO 摘要
            duration = time.time() - start_time
            recalled_count = len(candidate_list)
            output_count = len(final_list)

            logger.info(
                f"✨ [RAG] Turn Done | Recall: {recalled_count} -> Filtered: {output_count} | {duration:.3f}s"
            )
            embedding_model = getattr(vector_store, "_current_model", "N/A")
            embedding_model = getattr(vector_store, "_current_model", "N/A")
            embedding_hash = getattr(vector_store, "_current_hash", "")
            rerank_info = "disabled"
            if should_apply_rerank:
                for inst in reranker._instances.values():
                    rerank_info = inst.get("model", "N/A")
                    break

            # 💡 [精简] 统一字典累加逻辑，避免 if/else 分支冗余
            stats = rag_stats_var.get()
            if stats is None:
                stats = {}
                rag_stats_var.set(stats)

            stats["steps"] = stats.get("steps", 0) + 1
            queries = stats.get("queries", [])
            if query not in queries:
                queries.append(query)

            stats.update(
                {
                    "queries": queries,
                    "site": filter.site_id if filter else "Global",
                    "embedding_model": embedding_model,
                    "embedding_hash": embedding_hash,
                    "recalled_count": stats.get("recalled_count", 0) + len(results),
                    "filtered_count": stats.get("filtered_count", 0) + len(candidate_list),
                    "threshold": final_threshold,
                    "rerank_model": rerank_info,
                    "output_count": stats.get("output_count", 0) + len(response_objects),
                    "top_k": final_top_k,
                    "retrieval_duration": stats.get("retrieval_duration", 0.0) + duration,
                }
            )

            return response_objects

        except Exception as e:
            logger.error(f"❌ [Retrieve] 检索服务严重异常: {str(e)}", exc_info=True)
            # 根据错误类型提供更具体的提示（可选）
            if "AuthenticationError" in str(e):
                logger.error("🔑 [Retrieve] 可能是 Embedding 或 Reranker 认证失败")
            elif "ConnectionError" in str(e):
                logger.error("🌐 [Retrieve] 无法连接到向量数据库或模型服务")

            # 返回空列表以保证下游系统不崩溃，但在日志中留痕
            return []
