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
from app.core.common.ai_logging import rag_stats_var
from app.core.infra.config import settings
from app.core.vector import VectorStoreManager
from app.core.vector.exceptions import VectorStoreError
from app.schemas.document import VectorRetrieveFilter, VectorRetrieveResponse
from app.services.rag.exceptions import RAGRetrievalError

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
        # k = 召回深度（传入 RAG_RECALL_K），rerank_k = 重排后保留数量（传入 RAG_RERANK_TOP_K）
        recall_top_k = k if k is not None else settings.RAG_RECALL_K
        final_top_k = rerank_k if rerank_k is not None else settings.RAG_RERANK_TOP_K
        final_threshold = threshold if threshold is not None else settings.RAG_RECALL_THRESHOLD

        start_time = time.time()

        try:
            logger.info(
                f"🚀 [RAG] Query: '{query}' | Site: {filter.site_id if filter else 'Global'}"
            )
            # 1. 获取向量存储实例
            vector_store = await VectorStoreManager.get_instance()

            # 2. 构建过滤器（租户隔离为安全核心，必须注入）
            from app.core.infra.tenant import get_current_tenant

            current_tenant_id = get_current_tenant()
            filter_dict: dict = {}
            if filter:
                # site_id=0 表示全局搜索，不加站点过滤
                if filter.site_id is not None and filter.site_id > 0:
                    filter_dict["site_id"] = filter.site_id
                if filter.id is not None:
                    filter_dict["id"] = str(filter.id)
                if filter.source is not None:
                    filter_dict["source"] = filter.source
            if current_tenant_id is not None:
                filter_dict["tenant_id"] = current_tenant_id

            # 3. 确定重排序策略（探测调用，不打 usage signal；
            #    真正的 rerank 执行时会由 rerank() 内部统一记录）
            reranker_active = await reranker.is_enabled(tenant_id=current_tenant_id)
            should_apply_rerank = settings.RAG_ENABLE_RERANK and reranker_active
            if enable_rerank is not None:
                should_apply_rerank = enable_rerank and reranker_active

            # 4. 计算召回深度：重排时保证候选集至少为输出量的 2 倍，并守住全局上限
            if should_apply_rerank:
                recall_k = max(recall_top_k, final_top_k * 2)
            else:
                recall_k = recall_top_k
            recall_k = min(recall_k, settings.RAG_RECALL_MAX)

            # 5. 执行语义检索（接口引擎无关）
            results = await vector_store.search(
                query=query,
                k=recall_k,
                metadata_filter=filter_dict if filter_dict else None,
                purpose="执行语义检索 (Recall)",
            )

            # 6. 转换候选集
            # score_comparable=True（PG 余弦相似度）时应用阈值过滤；
            # score_comparable=False（ES RRF 排名分）时跳过阈值过滤（逐结果决策）
            candidate_list = []
            scores_are_comparable = False
            for item in results:
                doc = item["doc"]
                score = item["score"]
                if item["score_comparable"]:
                    scores_are_comparable = True
                    if score < final_threshold:
                        continue
                candidate_list.append(
                    {
                        "content": doc.page_content,
                        "score": score,
                        "document_id": int(doc.metadata.get("id", 0)),
                        "document_title": doc.metadata.get("title"),
                        "metadata": doc.metadata,
                        "original_score": score,
                    }
                )

            # 6.5 过滤草稿文档：批量查询候选 ID 的发布状态
            if candidate_list:
                from app.crud.document import crud_document
                from app.db.database import AsyncSessionLocal

                candidate_doc_ids = {
                    item["document_id"] for item in candidate_list if item["document_id"]
                }
                async with AsyncSessionLocal() as _db:
                    published_ids = await crud_document.get_published_ids(
                        _db, ids=candidate_doc_ids
                    )
                before = len(candidate_list)
                candidate_list = [
                    item for item in candidate_list if item["document_id"] in published_ids
                ]
                if len(candidate_list) < before:
                    logger.debug(f"[RAG] 已过滤草稿文档 {before - len(candidate_list)} 条")

            # 7. 重排序（如果启用）
            rerank_meta: dict | None = None
            if should_apply_rerank and candidate_list:
                final_list, rerank_meta = await reranker.rerank(
                    query=query,
                    documents=candidate_list,
                    top_n=final_top_k,
                    tenant_id=current_tenant_id,
                    purpose="对召回结果进行精排 (Rerank)",
                )
            else:
                # Sort by score only when scores have absolute meaning (PG cosine similarity).
                # For ES RRF scores, preserve the already-ranked order from the driver.
                if scores_are_comparable:
                    candidate_list.sort(key=lambda x: x["score"], reverse=True)
                final_list = candidate_list[:final_top_k]

            # 8. 转换为响应对象
            response_objects = [VectorRetrieveResponse(**item) for item in final_list]

            duration = time.time() - start_time
            logger.info(
                f"✨ [RAG] Turn Done | Recall: {len(candidate_list)} -> Filtered: {len(final_list)} | {duration:.3f}s"
            )

            # 9. 累计统计数据（供 chat_service 汇总日志使用）
            last_emb = vector_store.last_embedding
            embedding_model = last_emb.model if last_emb else "N/A"
            embedding_hash = last_emb.hash if last_emb else ""
            vector_backend = vector_store.vector_backend
            # 直接复用 rerank() 返回的 meta，避免再次回配置服务（与 chat/embedding 对齐）
            rerank_model_name = (
                rerank_meta["model"] if rerank_meta and rerank_meta.get("model") else "disabled"
            )

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
                    "vector_backend": vector_backend,
                    "embedding_model": embedding_model,
                    "embedding_hash": embedding_hash,
                    "recalled_count": stats.get("recalled_count", 0) + len(results),
                    "filtered_count": stats.get("filtered_count", 0) + len(candidate_list),
                    "threshold": final_threshold,
                    "threshold_applied": scores_are_comparable,
                    "rerank_model": rerank_model_name,
                    "output_count": stats.get("output_count", 0) + len(response_objects),
                    "top_k": final_top_k,
                    "retrieval_duration": stats.get("retrieval_duration", 0.0) + duration,
                }
            )

            return response_objects

        except VectorStoreError as e:
            # 向量库层已有 typed exception；统一包成 RAGRetrievalError 让上游
            # （tool wrapper / agent）能区分"系统失败"与"召回为空"。
            logger.error(f"❌ [Retrieve] 向量库异常: {e}", exc_info=True)
            raise RAGRetrievalError(f"向量库异常: {e}") from e
        except Exception as e:
            err_text = str(e)
            if "AuthenticationError" in err_text:
                logger.error("🔑 [Retrieve] Embedding / Reranker 认证失败: %s", e, exc_info=True)
            elif "ConnectionError" in err_text:
                logger.error("🌐 [Retrieve] 无法连接到向量数据库或模型服务: %s", e, exc_info=True)
            else:
                logger.error(f"❌ [Retrieve] 检索服务异常: {e}", exc_info=True)
            raise RAGRetrievalError(f"检索失败: {e}") from e
