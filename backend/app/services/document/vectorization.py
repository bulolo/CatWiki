# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""文档向量化逻辑 —— 与 DocumentService 拆分独立，便于 worker 直接调用。

调用方：
- ``worker/document_tasks.py``：直接调用 ``process_document_vectorization``，无需走 DI
- ``services/document/service.py``：``DocumentService.remove_document_vector`` /
  ``dispatch_vectorization_tasks`` 内部委托到这里
"""

import logging
import time
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.common.utils import NAMESPACE_CATWIKI
from app.core.infra.tenant import temporary_tenant_context
from app.core.vector import VectorStoreManager
from app.crud.document import crud_document
from app.db.transaction import transactional
from app.models.document import Document as DocumentModel
from app.models.document import VectorStatus

logger = logging.getLogger(__name__)


def is_document_vectorizable(document: DocumentModel) -> bool:
    """判断文档当前状态是否允许（重新）向量化。

    允许 PENDING 是为了处理 worker 异常导致状态卡死的场景 —— 重新入队可以
    覆盖卡死的任务。
    """
    return document.vector_status in (
        VectorStatus.NONE,
        VectorStatus.OUTDATED,
        VectorStatus.FAILED,
        VectorStatus.COMPLETED,
        VectorStatus.PENDING,
        None,
    )


@transactional()
async def process_document_vectorization(db: AsyncSession, document_id: int) -> None:
    """执行单文档的向量化（文本切分 + 向量入库），由 worker 调用。

    流程：
    1. 加载文档 → 检查状态必须为 PENDING
    2. 在租户上下文里校验 VectorStore 配置
    3. 标记 PROCESSING → 切分文本 → 删旧向量 → 写新向量
    4. 标记 COMPLETED（异常时回滚状态 + 抛出供上游 Task 系统感知）
    """
    task_start_time = time.time()
    logger.info(f"🔄 [Task] 开始处理向量化任务 | DocID: {document_id}")

    try:
        document = await crud_document.get(db, id=document_id)
        if not document:
            logger.warning(f"⚠️ 文档 {document_id} 不存在，跳过向量化")
            return

        if document.vector_status != VectorStatus.PENDING:
            logger.warning(
                f"⚠️ 文档 {document_id} 状态不为 pending ({document.vector_status})，跳过向量化"
            )
            return

        with temporary_tenant_context(document.tenant_id):
            vector_store = await VectorStoreManager.get_instance()
            await vector_store.validate_config(tenant_id=document.tenant_id)

            await crud_document.update_vector_status(
                db, document_id=document_id, status=VectorStatus.PROCESSING
            )

            if not document.content:
                logger.warning(f"⚠️ 文档 {document_id} 内容为空，无法向量化")
                await crud_document.update_vector_status(
                    db,
                    document_id=document_id,
                    status=VectorStatus.FAILED,
                    error="文档内容为空",
                )
                return

            base_metadata = {
                "source": "document",
                "id": str(document.id),
                "title": document.title,
                "summary": document.summary or "",
                "tags": " ".join(document.tags or []),
                "author": document.author,
                "site_id": document.site_id,
                "collection_id": document.collection_id,
                "tenant_id": document.tenant_id,
            }

            from langchain_text_splitters import RecursiveCharacterTextSplitter

            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000, chunk_overlap=200, length_function=len
            )
            chunks = text_splitter.create_documents(
                texts=[document.content], metadatas=[base_metadata]
            )

            logger.info(
                f"📄 文档 {document_id} (租户: {document.tenant_id}) 已切分为 {len(chunks)} 个片段"
            )

            chunk_ids: list[str] = []
            for i, chunk in enumerate(chunks):
                chunk_id_str = f"{document.id}_chunk_{i}"
                chunk_uuid = str(uuid.uuid5(NAMESPACE_CATWIKI, chunk_id_str))
                chunk_ids.append(chunk_uuid)
                chunk.metadata["id"] = str(document.id)
                chunk.metadata["chunk_index"] = i

            await vector_store.delete_by_metadata(key="id", value=str(document.id))

            if chunks:
                await vector_store.add_documents(documents=chunks, ids=chunk_ids)

            await crud_document.update_vector_status(
                db, document_id=document_id, status=VectorStatus.COMPLETED
            )
            total_elapsed = time.time() - task_start_time
            logger.info(
                f"✨ [Task] 文档向量化完成! | ID: {document.id} | "
                f"Chunks: {len(chunks)} | 总耗时: {total_elapsed:.3f}s"
            )

    except Exception as e:
        logger.error(f"❌ 文档 {document_id} 向量化失败: {e}", exc_info=True)
        try:
            await crud_document.update_vector_status(
                db, document_id=document_id, status=VectorStatus.FAILED, error=str(e)
            )
        except Exception as update_err:
            logger.warning(f"更新文档 {document_id} 向量化状态失败: {update_err}")
        # 重新抛出，让上游 worker (document_tasks._do_vectorize) 标记 Task 状态
        raise


async def delete_document_vector(document_id: int) -> None:
    """从 VectorStore 中删除文档的所有 chunk —— 用于 on_commit 回调和手动清除。

    失败仅记 warning，不抛出（背景操作，不应阻断主流程）。
    """
    try:
        vector_store = await VectorStoreManager.get_instance()
        await vector_store.delete_by_metadata(key="id", value=str(document_id))
        logger.info(f"💾 已清理文档 {document_id} 的相关向量数据")
    except Exception as e:
        logger.warning(f"⚠️ 清理文档向量失败: {e}")
