# Copyright 2026 CatWiki Authors
#
# Licensed under the CatWiki Open Source License (Modified Apache 2.0);
# you may not use this file except in compliance with the License.

"""DocumentService —— DI 入口类，承载 CRUD、文档导入流水线、向量化任务分发。

重型领域逻辑被拆到了同包内的独立模块：
- ``vectorization``：``process_document_vectorization`` / ``delete_document_vector``
- ``enrichment``：``enrich_document_with_llm``（AI 元数据增强，含两级回退）

本类负责 FastAPI DI 入口 + DB 事务（``@transactional``）+ 跨服务编排
（site_service / system_config_service / TaskService）。
"""

import logging
import uuid
from pathlib import Path
from typing import Any

from fastapi import BackgroundTasks, Depends, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.common.document_utils import build_collection_map, enrich_document_dict
from app.core.common.i18n import _
from app.core.common.pagination import Paginator
from app.core.infra.tenant import get_current_tenant
from app.core.vector import VectorStoreManager
from app.core.web.exceptions import BadRequestException, NotFoundException
from app.crud.collection import crud_collection
from app.crud.document import crud_document
from app.crud.site import crud_site
from app.db.database import get_db
from app.db.transaction import on_commit, transactional
from app.models.document import DocumentStatus, VectorStatus
from app.models.task import TaskType
from app.schemas.document import DocumentCreate
from app.services.document.enrichment import enrich_document_with_llm
from app.services.document.vectorization import (
    delete_document_vector,
    is_document_vectorizable,
)
from app.services.site_service import SiteService, get_site_service
from app.services.system_config import SystemConfigService, get_system_config_service
from app.services.task_service import TaskService

logger = logging.getLogger(__name__)


class DocumentService:
    def __init__(
        self,
        db: AsyncSession,
        site_service: SiteService,
        system_config_service: SystemConfigService,
    ):
        self.db = db
        self.site_service = site_service
        self.system_config_service = system_config_service

    # ──────────────────────────────────────────────────────────────────────
    # 导入流水线 (上传 + 暂存 + 排任务)
    # ──────────────────────────────────────────────────────────────────────

    @transactional()
    async def import_document(
        self,
        file: UploadFile,
        site_id: int,
        collection_id: int,
        processor_type: str,
        ocr_enabled: bool,
        extract_images: bool,
        extract_tables: bool,
        current_username: str,
        duplicate_strategy: str = "allow",
        generate_summary: bool = False,
        generate_tags: bool = False,
        auto_vectorize: bool = False,
    ) -> Any:
        """导入文档（上传 -> 云端暂存 -> 解析 -> 创建）并返回 enriched dictionary。"""
        from app.core.infra.rustfs import get_rustfs_service

        active_tenant_id = get_current_tenant()

        site = await crud_site.get(self.db, id=site_id)
        if not site:
            raise BadRequestException(detail=_("doc.site_not_found", id=site_id))

        filename = file.filename or "unknown"
        suffix = Path(filename).suffix.lower()

        # 重复文件检测：仅在 skip 策略且租户上下文有效时执行
        if duplicate_strategy == "skip" and active_tenant_id is not None:
            potential_title = Path(filename).stem
            existing_doc = await crud_document.get_by_title_collection(
                self.db,
                title=potential_title,
                collection_id=collection_id,
                tenant_id=active_tenant_id,
            )
            if existing_doc is not None:
                logger.info(
                    f"[Import] Skipping duplicate: '{potential_title}' "
                    f"already exists in collection {collection_id}"
                )
                return None

        # 根据解析器类型动态判断支持的格式
        from app.schemas.system_config import DocProcessorType

        processor_supported_suffixes: dict[str, list[str]] = {
            DocProcessorType.MINERU: [
                ".pdf",
                ".docx",
                ".doc",
                ".jpg",
                ".jpeg",
                ".png",
                ".webp",
                ".tiff",
            ],
            DocProcessorType.DOCLING: [
                ".pdf",
                ".docx",
                ".doc",
                ".pptx",
                ".ppt",
                ".xlsx",
                ".xls",
                ".html",
                ".htm",
                ".jpg",
                ".jpeg",
                ".png",
                ".webp",
                ".tiff",
                ".md",
            ],
            DocProcessorType.PADDLEOCR: [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".tiff"],
        }
        allowed_suffixes = processor_supported_suffixes.get(
            processor_type, [".pdf", ".jpg", ".jpeg", ".png"]
        )
        if suffix not in allowed_suffixes:
            raise BadRequestException(detail=_("doc.unsupported_format"))

        # 获取处理器配置（mask=False 以带上真实 API Key 到后台任务）
        processor_config_list = await self.system_config_service.get_doc_processor_config(
            active_tenant_id, scope="tenant", mask=False
        )
        target_processor_config = next(
            (p for p in processor_config_list.get("processors", []) if p["type"] == processor_type),
            None,
        )
        if not target_processor_config:
            raise BadRequestException(detail=_("doc.processor_invalid", type=processor_type))

        # 准备上传至 RustFS 暂存区（云端共享，解耦存储）
        rustfs = get_rustfs_service()
        if not rustfs.is_available():
            raise BadRequestException(detail=_("doc.storage_unavailable"))

        object_name = f"temp_imports/{uuid.uuid4()}{suffix}"
        file_content = await file.read()
        content_type = file.content_type or "application/octet-stream"

        # [关键] 把上传注册为 on_commit 回调：如果后续 DB 事务失败回滚，
        # 云端不会残留垃圾文件；同时确保在 Worker 启动前文件已落盘。
        on_commit(
            self.db,
            self._do_upload_to_rustfs,
            object_name,
            file_content,
            content_type,
            filename,
        )

        task_payload = {
            "object_name": object_name,
            "filename": filename,
            "original_filename": filename,
            "site_id": site_id,
            "collection_id": collection_id,
            "tenant_id": active_tenant_id,
            "author": current_username,
            "processor_config": target_processor_config,
            "ocr_enabled": ocr_enabled,
            "extract_images": extract_images,
            "extract_tables": extract_tables,
            "generate_summary": generate_summary,
            "generate_tags": generate_tags,
            "auto_vectorize": auto_vectorize,
        }

        task = await TaskService.enqueue_task(
            db=self.db,
            task_type=TaskType.IMPORT_PARSING,
            payload=task_payload,
            tenant_id=active_tenant_id,
            site_id=site_id,
            created_by=current_username,
        )

        return task

    async def _do_upload_to_rustfs(
        self, object_name: str, content: bytes, content_type: str, filename: str
    ):
        """实际执行上传的回调函数（注册到 on_commit）。"""
        import io
        from urllib.parse import quote

        from app.core.infra.rustfs import get_rustfs_service

        try:
            rustfs = get_rustfs_service()
            success = rustfs.upload_file(
                object_name=object_name,
                file_data=io.BytesIO(content),
                file_size=len(content),
                content_type=content_type,
                metadata={"original_filename": quote(filename)},
            )
            if not success:
                logger.error(f"❌ 异步上传云端失败: {object_name}")
            else:
                logger.info(f"☁️ 异步上传云端成功: {object_name}")
        except Exception as e:
            logger.error(f"❌ 执行云端异步上传遭遇异常: {e}")

    # ──────────────────────────────────────────────────────────────────────
    # 向量化任务分发
    # ──────────────────────────────────────────────────────────────────────

    @transactional()
    async def dispatch_vectorization_tasks(
        self,
        background_tasks: BackgroundTasks,
        document_ids: list[int],
        current_username: str = "system",
    ) -> tuple[list[int], int]:
        """批量分发向量化任务。返回 (成功 ID 列表, 跳过/失败的数量)。"""
        documents = await crud_document.get_multi(self.db, ids=document_ids)
        document_map = {doc.id: doc for doc in documents}

        success_ids: list[int] = []
        failed_count = 0
        for doc_id in document_ids:
            document = document_map.get(doc_id)
            if document and is_document_vectorizable(document):
                success_ids.append(doc_id)
            else:
                logger.warning("文档 %s 当前状态不满足向量化要求", doc_id)
                failed_count += 1

        if not success_ids:
            return [], failed_count

        await crud_document.batch_update_vector_status(
            self.db, document_ids=success_ids, status=VectorStatus.PENDING
        )

        try:
            target_tenant_id = documents[0].tenant_id if documents else None
            v_mgr = await VectorStoreManager.get_instance()
            await v_mgr.validate_config(tenant_id=target_tenant_id)
        except Exception as e:
            error_msg = str(e)
            logger.debug(f"Sync configuration check failed: {e}")
            await crud_document.batch_update_vector_status(
                self.db,
                document_ids=success_ids,
                status=VectorStatus.FAILED,
                error=f"配置缺失: {error_msg}",
            )
            raise BadRequestException(detail=_("doc.learn_failed", error=error_msg))

        for doc_id in success_ids:
            await TaskService.enqueue_task(
                self.db,
                task_type=TaskType.VECTORIZE,
                tenant_id=target_tenant_id,
                site_id=documents[0].site_id if documents else None,
                created_by=current_username,
                payload={"document_id": doc_id},
            )

        return success_ids, failed_count

    @transactional()
    async def vectorize_single_document(
        self, background_tasks: BackgroundTasks, document_id: int, current_username: str = "system"
    ) -> dict:
        """为单个文档触发向量化（返回文档详情字典）。"""
        document = await crud_document.get(self.db, id=document_id)
        if not document:
            raise NotFoundException(detail=_("doc.not_found", id=document_id))

        success_ids, _skipped = await self.dispatch_vectorization_tasks(
            background_tasks, [document_id], current_username
        )

        if not success_ids:
            raise BadRequestException(detail=_("doc.cannot_relearn", status=document.vector_status))

        document = await crud_document.get(self.db, id=document_id)
        return await enrich_document_dict(document, self.db, crud_collection)

    @transactional()
    async def remove_document_vector(self, document_id: int) -> dict:
        """手动清空文档向量数据（DB 状态置 NONE + 注册 on_commit 删向量）。"""
        doc = await crud_document.get(self.db, id=document_id)
        if not doc:
            raise NotFoundException(detail=_("doc.not_found", id=document_id))

        on_commit(self.db, delete_document_vector, document_id)
        await crud_document.update(self.db, db_obj=doc, obj_in={"vector_status": VectorStatus.NONE})
        return await enrich_document_dict(doc, self.db, crud_collection)

    @transactional()
    async def get_document_chunks(self, document_id: int) -> list[dict]:
        """获取文档切片。"""
        document = await crud_document.get(self.db, id=document_id)
        if not document:
            raise NotFoundException(detail=_("doc.not_found", id=document_id))

        try:
            vector_store = await VectorStoreManager.get_instance()
            return await vector_store.get_chunks_by_metadata(key="id", value=str(document_id))
        except Exception as e:
            logger.error(f"Failed to get chunks for doc {document_id}: {e}")
            return []

    # ──────────────────────────────────────────────────────────────────────
    # CRUD
    # ──────────────────────────────────────────────────────────────────────

    @transactional()
    async def list_documents(
        self,
        page: int,
        size: int,
        site_id: int | None,
        collection_id: int | None,
        status: str | None,
        vector_status: str | None,
        keyword: str | None,
        order_by: str | None,
        order_dir: str | None,
        exclude_content: bool,
        tenant_id: int | None = None,
        include_site: bool = False,
        is_pager: int = 1,
    ) -> tuple[list[dict], Paginator]:
        """获取文档列表（分页）。"""
        paginator = Paginator(page=page, size=size, total=0, is_pager=is_pager)

        if collection_id:
            collection_ids = await crud_collection.get_descendant_ids(
                self.db, collection_id=collection_id
            )
        else:
            collection_ids = None

        documents = await crud_document.list(
            self.db,
            site_id=site_id,
            tenant_id=tenant_id,
            collection_ids=collection_ids,
            status=status,
            vector_status=vector_status,
            keyword=keyword,
            skip=paginator.skip,
            limit=paginator.size,
            order_by=order_by,
            order_dir=order_dir,
            include_site=include_site,
        )
        paginator.total = await crud_document.count(
            self.db,
            site_id=site_id,
            tenant_id=tenant_id,
            collection_ids=collection_ids,
            status=status,
            vector_status=vector_status,
            keyword=keyword,
        )

        doc_collection_ids = list({doc.collection_id for doc in documents if doc.collection_id})
        collection_map = await build_collection_map(self.db, crud_collection, doc_collection_ids)

        enriched_docs = []
        for doc in documents:
            doc_dict = await enrich_document_dict(
                doc,
                self.db,
                crud_collection,
                collection_map=collection_map,
                include_site_info=include_site,
            )
            if exclude_content:
                doc_dict["content"] = None
            enriched_docs.append(doc_dict)

        return enriched_docs, paginator

    @transactional()
    async def get_document(self, document_id: int) -> dict:
        """获取文档详情。"""
        document = await crud_document.get_with_related_site(self.db, id=document_id)
        if not document:
            raise NotFoundException(detail=_("doc.not_found", id=document_id))
        return await enrich_document_dict(
            document, self.db, crud_collection, include_site_info=True
        )

    @transactional()
    async def create_document(self, document_in: DocumentCreate) -> dict:
        """创建文档。"""
        site = await crud_site.get(self.db, id=document_in.site_id)
        if not site:
            raise BadRequestException(detail=_("doc.site_not_found", id=document_in.site_id))

        document = await crud_document.create(self.db, obj_in=document_in)
        await self.site_service.increment_article_count(site_id=document_in.site_id)

        return await enrich_document_dict(document, self.db, crud_collection)

    @transactional()
    async def update_document(self, document_id: int, document_in: any) -> dict:
        """更新文档。若向量字段（content/title/summary/tags）变更则标记为 OUTDATED。"""
        document = await crud_document.get(self.db, id=document_id)
        if not document:
            raise NotFoundException(detail=_("doc.not_found", id=document_id))

        was_vectorized = document.vector_status == VectorStatus.COMPLETED
        old_vector_fields = (
            document.content,
            document.title,
            document.summary,
            tuple(document.tags or []),
        )

        document = await crud_document.update(self.db, db_obj=document, obj_in=document_in)

        if was_vectorized:
            new_vector_fields = (
                document.content,
                document.title,
                document.summary,
                tuple(document.tags or []),
            )
            if new_vector_fields != old_vector_fields:
                # 向量相关字段变更 → 标记过期，由用户手动触发重新向量化
                await crud_document.update_vector_status(
                    self.db, document_id=document_id, status=VectorStatus.OUTDATED
                )

        return await enrich_document_dict(document, self.db, crud_collection)

    @transactional()
    async def delete_document(self, document_id: int) -> None:
        """删除文档（DB + 异步清理向量）。"""
        doc = await crud_document.get(self.db, id=document_id)
        if not doc:
            raise NotFoundException(detail=_("doc.not_found", id=document_id))

        site_id = doc.site_id

        # 注册 on_commit 回调：DB 删除成功后才清理向量
        on_commit(self.db, delete_document_vector, document_id)

        await crud_document.delete(self.db, id=document_id)
        await self.site_service.decrement_article_count(site_id=site_id)

    @transactional()
    async def get_client_document(
        self,
        document_id: int,
        ip_address: str | None = None,
        user_agent: str | None = None,
        referer: str | None = None,
        background_tasks: BackgroundTasks | None = None,
    ) -> dict:
        """获取已发布文档详情（客户端，增加浏览量）。"""
        document = await crud_document.get_with_related_site(self.db, id=document_id)
        if not document or document.status != DocumentStatus.PUBLISHED:
            raise NotFoundException(detail=_("doc.not_found", id=document_id))

        document = await crud_document.increment_views(
            self.db,
            document_id=document_id,
            site_id=document.site_id,
            tenant_id=document.tenant_id,
            ip_address=ip_address,
            user_agent=user_agent,
            referer=referer,
            background_tasks=background_tasks,
        )

        return await enrich_document_dict(
            document, self.db, crud_collection, include_site_info=True
        )

    # ──────────────────────────────────────────────────────────────────────
    # AI 字段生成（轻代理 → enrich_document_with_llm）
    # ──────────────────────────────────────────────────────────────────────

    async def ai_generate_fields(
        self,
        content: str,
        fields: list[str],
        summary_max_length: int | None = None,
        tags_max_count: int | None = None,
    ) -> dict:
        """用 LLM 生成文档摘要 / 标签（实际逻辑在 ``enrichment`` 模块）。"""
        return await enrich_document_with_llm(
            content,
            fields,
            summary_max_length=summary_max_length,
            tags_max_count=tags_max_count,
        )


def get_document_service(
    db: AsyncSession = Depends(get_db),
    site_service: SiteService = Depends(get_site_service),
    system_config_service: SystemConfigService = Depends(get_system_config_service),
) -> DocumentService:
    """获取 DocumentService 实例的依赖注入函数。"""
    return DocumentService(db, site_service, system_config_service)
