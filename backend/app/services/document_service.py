import logging
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import BackgroundTasks, Depends, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.common.document_utils import build_collection_map, enrich_document_dict
from app.core.common.utils import NAMESPACE_CATWIKI, Paginator
from app.core.infra.tenant import get_current_tenant, temporary_tenant_context
from app.core.vector.vector_store import VectorStoreManager
from app.core.web.exceptions import BadRequestException, NotFoundException
from app.crud.collection import crud_collection
from app.crud.document import crud_document
from app.crud.site import crud_site
from app.db.database import get_db
from app.db.transaction import transactional
from app.models.document import Document as DocumentModel
from app.models.document import DocumentStatus, VectorStatus
from app.models.task import TaskType
from app.schemas.document import DocumentCreate
from app.services.site_service import SiteService, get_site_service
from app.services.system_config_service import SystemConfigService, get_system_config_service
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

    def is_vectorizable(self, document: DocumentModel) -> bool:
        """检查文档是否可以向量化"""
        return document.vector_status in (
            VectorStatus.NONE,
            VectorStatus.FAILED,
            VectorStatus.COMPLETED,
            VectorStatus.PENDING,  # 允许重新排队，处理可能卡住的任务
            None,
        )

    @staticmethod
    @transactional()
    async def process_vectorization_task(db: AsyncSession, document_id: int):
        """处理文档向量化任务（异步后台任务）"""
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
                # 🔍 [New] 在执行逻辑前再次强制检测配置 (针对 Worker 场景)
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

                vector_store = await VectorStoreManager.get_instance()
                base_metadata = {
                    "source": "document",
                    "id": str(document.id),
                    "title": document.title,
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

                chunk_ids = []
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
                    f"✨ [Task] 文档向量化完成! | ID: {document.id} | Chunks: {len(chunks)} | 总耗时: {total_elapsed:.3f}s"
                )

        except Exception as e:
            logger.error(f"❌ 文档 {document_id} 向量化失败: {e}", exc_info=True)
            try:
                await crud_document.update_vector_status(
                    db, document_id=document_id, status=VectorStatus.FAILED, error=str(e)
                )
            except Exception as update_err:
                logger.warning(f"更新文档 {document_id} 向量化状态失败: {update_err}")
            # 重新抛出异常，让外部 Worker (document_tasks.py) 能感知到失败并标记 Task 状态
            raise e

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
    ) -> Any:
        """导入文档（上传 -> 云端暂存 -> 解析 -> 创建）并返回 enriched dictionary"""

        from app.core.infra.rustfs import get_rustfs_service
        from app.core.vector.vector_store import VectorStoreManager

        try:
            active_tenant_id = get_current_tenant()
            v_mgr = await VectorStoreManager.get_instance()
            await v_mgr.validate_config(tenant_id=active_tenant_id)
        except Exception as e:
            logger.warning(f"⚠️ 导入文档前配置检查失败: {e}")
            raise BadRequestException(detail=f"导入失败：{str(e)}")

        site = await crud_site.get(self.db, id=site_id)
        if not site:
            raise BadRequestException(detail=f"站点 {site_id} 不存在")

        filename = file.filename or "unknown"
        suffix = Path(filename).suffix.lower()
        if suffix not in [".pdf", ".jpg", ".jpeg", ".png"]:
            raise BadRequestException(detail="目前仅支持 PDF 和图片文件")

        # 2. 获取处理器配置 (显式获取，mask=False 以带上真实 API Key 到后台任务)
        processor_config_list = await self.system_config_service.get_doc_processor_config(
            active_tenant_id, scope="tenant", mask=False
        )
        target_processor_config = next(
            (p for p in processor_config_list.get("processors", []) if p["type"] == processor_type),
            None,
        )
        if not target_processor_config:
            raise BadRequestException(detail=f"处理器 {processor_type} 未配置或无效")

        # 3. 准备上传至 RustFS 暂存区 (云端共享，解耦存储)
        rustfs = get_rustfs_service()
        if not rustfs.is_available():
            raise BadRequestException(detail="云端存储服务不可用，无法处理文档导入")

        object_name = f"temp_imports/{uuid.uuid4()}{suffix}"
        file_content = await file.read()
        content_type = file.content_type or "application/octet-stream"

        # [✨ 关键修复]：将上传操作注册为 on_commit 回调
        # 理由：如果直接上传，但随后的数据库事务（如 enqueue_task）失败回滚，
        # 则云端会残留垃圾文件。且必须保证在 Worker 启动前文件已落盘。
        from app.db.transaction import on_commit

        on_commit(
            self.db,
            self._do_upload_to_rustfs,
            object_name,
            file_content,
            content_type,
            filename,
        )

        # 4. 创建后台任务 (enqueue_task 内部也会注册一个 on_commit 用于分发)
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
        """实际执行上传的回调函数"""
        import io

        from app.core.infra.rustfs import get_rustfs_service

        try:
            rustfs = get_rustfs_service()
            success = rustfs.upload_file(
                object_name=object_name,
                file_data=io.BytesIO(content),
                file_size=len(content),
                content_type=content_type,
                metadata={"original_filename": filename},
            )
            if not success:
                logger.error(f"❌ 异步上传云端失败: {object_name}")
            else:
                logger.info(f"☁️ 异步上传云端成功: {object_name}")
        except Exception as e:
            logger.error(f"❌ 执行云端异步上传遭遇异常: {e}")

    @transactional()
    async def dispatch_vectorization_tasks(
        self,
        background_tasks: BackgroundTasks,
        document_ids: list[int],
        current_username: str = "system",
    ) -> tuple[list[int], int]:
        """统一处理向量化任务分发"""
        documents = await crud_document.get_multi(self.db, ids=document_ids)
        document_map = {doc.id: doc for doc in documents}

        success_ids = []
        failed_count = 0

        for doc_id in document_ids:
            document = document_map.get(doc_id)
            if document and self.is_vectorizable(document):
                success_ids.append(doc_id)
            else:
                # 说明不可向量化 (is_vectorizable 返回 False)
                logger.warning("文档 %s 当前状态不满足向量化要求", doc_id)
                failed_count += 1

        if not success_ids:
            return [], failed_count

        # 设置为 PENDING
        await crud_document.batch_update_vector_status(
            self.db, document_ids=success_ids, status=VectorStatus.PENDING
        )

        try:
            target_tenant_id = documents[0].tenant_id if documents else None
            from app.core.vector.vector_store import VectorStoreManager

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
            raise BadRequestException(detail=f"学习失败：{error_msg}")

        for doc_id in success_ids:
            # 使用新的任务系统分发向量化任务
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
    ) -> tuple[list[dict], Paginator]:
        """获取文档列表（分页）"""
        paginator = Paginator(page=page, size=size, total=0)

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

        # 批量加载合集信息
        doc_collection_ids = list(
            set([doc.collection_id for doc in documents if doc.collection_id])
        )
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
        """获取文档详情"""
        document = await crud_document.get_with_related_site(self.db, id=document_id)
        if not document:
            raise NotFoundException(detail=f"文档 {document_id} 不存在")
        return await enrich_document_dict(
            document, self.db, crud_collection, include_site_info=True
        )

    @transactional()
    async def create_document(self, document_in: DocumentCreate) -> dict:
        """创建文档"""
        site = await crud_site.get(self.db, id=document_in.site_id)
        if not site:
            raise BadRequestException(detail=f"站点 {document_in.site_id} 不存在")

        # 执行关键操作
        document = await crud_document.create(self.db, obj_in=document_in)
        await self.site_service.increment_article_count(site_id=document_in.site_id)

        # 这里不再需要手动调用 commit() 或 refresh()，装饰器会自动处理
        # 我们可以只返回 enriched dict，装饰器处理外部事务
        return await enrich_document_dict(document, self.db, crud_collection)

    @transactional()
    async def update_document(self, document_id: int, document_in: any) -> dict:
        """更新文档"""
        document = await crud_document.get(self.db, id=document_id)
        if not document:
            raise NotFoundException(detail=f"文档 {document_id} 不存在")

        document = await crud_document.update(self.db, db_obj=document, obj_in=document_in)
        return await enrich_document_dict(document, self.db, crud_collection)

    @transactional()
    async def delete_document(self, document_id: int) -> None:
        """删除文档"""
        doc = await crud_document.get(self.db, id=document_id)
        if not doc:
            raise NotFoundException(detail=f"文档 {document_id} 不存在")

        site_id = doc.site_id

        # 2. 注册提交后回调：执行向量数据删除 (只有 DB 删除成功后才执行)
        from app.db.transaction import on_commit

        on_commit(self.db, self._do_delete_vector, document_id)

        # 3. 执行数据库删除操作 (由 @transactional 合并提交)
        await crud_document.delete(self.db, id=document_id)
        await self.site_service.decrement_article_count(site_id=site_id)

    async def _do_delete_vector(self, document_id: int):
        """实际执行向量删除的回调"""
        try:
            from app.core.vector.vector_store import VectorStoreManager

            vector_store = await VectorStoreManager.get_instance()
            await vector_store.delete_by_metadata(key="id", value=str(document_id))
            logger.info(f"💾 已清理文档 {document_id} 的相关向量数据")
        except Exception as e:
            logger.warning(f"⚠️ 清理文档向量失败: {e}")

    @transactional()
    async def remove_document_vector(self, document_id: int) -> dict:
        """手动清空文档向量数据"""
        doc = await crud_document.get(self.db, id=document_id)
        if not doc:
            raise NotFoundException(detail=f"文档 {document_id} 不存在")

        # 注册提交后回调执行向量删除
        from app.db.transaction import on_commit

        on_commit(self.db, self._do_delete_vector, document_id)

        # 更新 DB 状态
        await crud_document.update(self.db, db_obj=doc, obj_in={"vector_status": VectorStatus.NONE})
        return await enrich_document_dict(doc, self.db, crud_collection)

    @transactional()
    async def get_document_chunks(self, document_id: int) -> list[dict]:
        """获取文档切片"""
        document = await crud_document.get(self.db, id=document_id)
        if not document:
            raise NotFoundException(detail=f"文档 {document_id} 不存在")

        try:
            vector_store = await VectorStoreManager.get_instance()
            return await vector_store.get_chunks_by_metadata(key="id", value=str(document_id))
        except Exception as e:
            logger.error(f"Failed to get chunks for doc {document_id}: {e}")
            return []

    @transactional()
    async def vectorize_single_document(
        self, background_tasks: BackgroundTasks, document_id: int, current_username: str = "system"
    ) -> dict:
        """为单个文档触发向量化（返回文档详情字典）"""
        document = await crud_document.get(self.db, id=document_id)
        if not document:
            raise NotFoundException(detail=f"文档 {document_id} 不存在")

        # 使用已有的批量分发逻辑
        success_ids, _ = await self.dispatch_vectorization_tasks(
            background_tasks, [document_id], current_username
        )

        if not success_ids:
            # 说明不可向量化 (can_vectorize 返回 False)
            raise BadRequestException(
                detail=f"文档当前状态为 {document.vector_status}，无法重新学习"
            )

        # 重新获取文档以返回最新状态
        document = await crud_document.get(self.db, id=document_id)
        return await enrich_document_dict(document, self.db, crud_collection)

    @transactional()
    async def get_client_document(
        self,
        document_id: int,
        ip_address: str | None = None,
        user_agent: str | None = None,
        referer: str | None = None,
    ) -> dict:
        """获取已发布文档详情（客户端，增加浏览量）"""
        document = await crud_document.get_with_related_site(self.db, id=document_id)
        if not document or document.status != DocumentStatus.PUBLISHED:
            raise NotFoundException(detail=f"文档 {document_id} 不存在")

        # 自动增加浏览量并记录浏览事件
        document = await crud_document.increment_views(
            self.db,
            document_id=document_id,
            site_id=document.site_id,
            tenant_id=document.tenant_id,
            ip_address=ip_address,
            user_agent=user_agent,
            referer=referer,
        )

        return await enrich_document_dict(
            document, self.db, crud_collection, include_site_info=True
        )


def get_document_service(
    db: AsyncSession = Depends(get_db),
    site_service: SiteService = Depends(get_site_service),
    system_config_service: SystemConfigService = Depends(get_system_config_service),
) -> DocumentService:
    """获取 DocumentService 实例的依赖注入函数"""
    return DocumentService(db, site_service, system_config_service)
