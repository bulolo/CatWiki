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
文档管理 API 端点
"""

import logging
import shutil
import tempfile
import time
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.common.document_utils import (
    build_collection_map,
    enrich_document_dict,
)
from app.core.common.utils import (
    Paginator,
)
from app.core.doc_processor import DocProcessorFactory
from app.core.infra.tenant import get_current_tenant
from app.core.web.deps import (
    get_current_user_with_tenant,
    get_db,
)
from app.core.web.exceptions import BadRequestException, NotFoundException
from app.crud import crud_collection, crud_document, crud_site
from app.crud.system_config import crud_system_config
from app.db.database import AsyncSessionLocal
from app.models.document import Document as DocumentModel
from app.models.document import DocumentStatus, VectorStatus
from app.models.user import User
from app.schemas.document import (
    Document,
    DocumentCreate,
    DocumentUpdate,
    VectorizeRequest,
    VectorizeResponse,
    VectorRetrieveRequest,
    VectorRetrieveResult,
)
from app.schemas.response import ApiResponse, PaginatedResponse
from app.schemas.system_config import DocProcessorConfig

router = APIRouter()
logger = logging.getLogger(__name__)


# ============ 辅助函数 ============


def can_vectorize(document: DocumentModel) -> bool:
    """检查文档是否可以向量化"""
    return document.vector_status in (
        VectorStatus.NONE,
        VectorStatus.FAILED,
        VectorStatus.COMPLETED,
        None,
    )


# ============ 向量化后台任务 ============


async def process_vectorization_task(document_id: int):
    """
    处理文档向量化任务（异步后台任务）
    流程：pending -> processing -> [add to vector store] -> completed
    """
    import time

    task_start_time = time.time()
    logger.info(f"🔄 [Task] 开始处理向量化任务 | DocID: {document_id}")

    # 创建新的数据库会话
    async with AsyncSessionLocal() as db:
        try:
            # 检查文档是否存在且状态为 pending
            document = await crud_document.get(db, id=document_id)
            if not document:
                logger.warning(f"⚠️ 文档 {document_id} 不存在，跳过向量化")
                return

            if document.vector_status != VectorStatus.PENDING:
                logger.warning(
                    f"⚠️ 文档 {document_id} 状态不为 pending ({document.vector_status})，跳过向量化"
                )
                return

            # 使用租户上下文进行后续操作
            from app.core.infra.tenant import temporary_tenant_context

            with temporary_tenant_context(document.tenant_id):
                # 更新为 processing 状态
                await crud_document.update_vector_status(
                    db, document_id=document_id, status=VectorStatus.PROCESSING
                )

                # 获取文档内容
                if not document.content:
                    logger.warning(f"⚠️ 文档 {document_id} 内容为空，无法向量化")
                    await crud_document.update_vector_status(
                        db,
                        document_id=document_id,
                        status=VectorStatus.FAILED,
                        error="文档内容为空",
                    )
                    return

                # 准备 LangChain 文档对象

                from app.core.vector.vector_store import VectorStoreManager

                # 初始化向量存储管理器 (此处会自动识别 tenant_id)
                vector_store = await VectorStoreManager.get_instance()

                # 1. 准备元数据
                base_metadata = {
                    "source": "document",
                    "id": str(document.id),
                    "title": document.title,
                    "author": document.author,
                    "site_id": document.site_id,
                    "collection_id": document.collection_id,
                    "tenant_id": document.tenant_id,
                }

                # 2. 文本切片
                from langchain_text_splitters import RecursiveCharacterTextSplitter

                text_splitter = RecursiveCharacterTextSplitter(
                    chunk_size=1000,
                    chunk_overlap=200,
                    length_function=len,
                )

                # 使用 create_documents 自动处理切片
                chunks = text_splitter.create_documents(
                    texts=[document.content], metadatas=[base_metadata]
                )

                logger.info(
                    f"📄 文档 {document_id} (租户: {document.tenant_id}) 已切分为 {len(chunks)} 个片段"
                )

                # 3. 生成确定性 ID (uuid5)
                # 引入 uuid 和 NAMESPACE
                import uuid

                from app.core.common.utils import NAMESPACE_CATWIKI

                chunk_ids = []
                for i, chunk in enumerate(chunks):
                    # 为每个 chunk 生成唯一的确定性 ID: doc_{id}_chunk_{i}
                    chunk_id_str = f"{document.id}_chunk_{i}"
                    chunk_uuid = str(uuid.uuid5(NAMESPACE_CATWIKI, chunk_id_str))
                    chunk_ids.append(chunk_uuid)

                    # 确保 metadata 中包含 id
                    chunk.metadata["id"] = str(document.id)
                    chunk.metadata["chunk_index"] = i

                # 4. 清理旧数据 (使用 delete_by_metadata)
                await vector_store.delete_by_metadata(key="id", value=str(document.id))

                # 5. 添加新向量
                if chunks:
                    await vector_store.add_documents(documents=chunks, ids=chunk_ids)

                # 更新为 completed 状态
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


@router.get(
    "", response_model=ApiResponse[PaginatedResponse[Document]], operation_id="listAdminDocuments"
)
async def list_documents(
    page: int = 1,
    size: int = 10,
    site_id: int | None = Query(None, description="站点ID"),
    collection_id: int | None = Query(None, description="合集ID"),
    status: str | None = Query(None, description="状态过滤: published, draft"),
    vector_status: str | None = Query(
        None, description="向量化状态过滤: none, pending, processing, completed, failed"
    ),
    keyword: str | None = Query(None, description="搜索关键词"),
    order_by: str | None = Query(None, description="排序字段: views, updated_at"),
    order_dir: str | None = Query("desc", description="排序方向: asc, desc"),
    exclude_content: bool = Query(True, description="是否排除文档内容（用于列表展示，提升性能）"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[PaginatedResponse[Document]]:
    """获取文档列表（分页）"""

    paginator = Paginator(page=page, size=size, total=0)  # total 稍后设置

    # 统一查询逻辑
    if collection_id:
        # 获取合集及其所有子合集的ID列表
        collection_ids = await crud_collection.get_descendant_ids(db, collection_id=collection_id)
    else:
        collection_ids = None

    documents = await crud_document.list(
        db,
        site_id=site_id,
        collection_ids=collection_ids,
        status=status,
        vector_status=vector_status,
        keyword=keyword,
        skip=paginator.skip,
        limit=paginator.size,
        order_by=order_by,
        order_dir=order_dir,
    )
    paginator.total = await crud_document.count(
        db,
        site_id=site_id,
        collection_ids=collection_ids,
        status=status,
        vector_status=vector_status,
        keyword=keyword,
    )

    # 批量加载所有需要的collection信息（优化N+1查询）
    collection_ids = list(set([doc.collection_id for doc in documents if doc.collection_id]))
    collection_map = await build_collection_map(db, crud_collection, collection_ids)

    # 为每个文档添加合集信息
    documents_with_collection = []
    for doc in documents:
        doc_dict = await enrich_document_dict(
            doc, db, crud_collection, collection_map=collection_map
        )
        # 处理 exclude_content 逻辑
        if exclude_content:
            doc_dict["content"] = None
        documents_with_collection.append(doc_dict)

    return ApiResponse.ok(
        data=PaginatedResponse(
            list=documents_with_collection,
            pagination=paginator.to_pagination_info(),
        ),
        msg="获取成功",
    )


@router.get("/{document_id}", response_model=ApiResponse[Document], operation_id="getAdminDocument")
async def get_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[Document]:
    """获取文档详情（管理后台查看，不增加浏览量）"""
    document = await crud_document.get_with_related_site(db, id=document_id)

    if not document:
        raise NotFoundException(detail=f"文档 {document_id} 不存在")

    # 构建文档字典，添加关联的合集信息
    document_dict = await enrich_document_dict(
        document, db, crud_collection, include_site_name=True
    )

    return ApiResponse.ok(data=document_dict, msg="获取成功")


@router.post(
    "",
    response_model=ApiResponse[Document],
    status_code=status.HTTP_201_CREATED,
    operation_id="createAdminDocument",
)
async def create_document(
    document_in: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[Document]:
    """创建文档"""
    # 验证站点存在
    site = await crud_site.get(db, id=document_in.site_id)
    if not site:
        raise BadRequestException(detail=f"站点 {document_in.site_id} 不存在")

    # 创建文档（CRUD 层会自动计算阅读时间）
    document = await crud_document.create(db, obj_in=document_in)

    # 更新站点文章计数
    await crud_site.increment_article_count(db, site_id=document_in.site_id)

    # 构建文档字典，添加关联的合集信息
    document_dict = await enrich_document_dict(document, db, crud_collection)

    return ApiResponse.ok(data=document_dict, msg="创建成功")


@router.post(
    "/import",
    response_model=ApiResponse[Document],
    status_code=status.HTTP_201_CREATED,
    operation_id="importDocument",
)
async def import_document(
    file: UploadFile = File(...),
    site_id: int = Form(...),
    collection_id: int = Form(...),
    processor_type: str = Form("MinerU"),
    ocr_enabled: bool = Form(False),
    extract_images: bool = Form(False),
    extract_tables: bool = Form(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[Document]:
    """
    导入文档 (上传 -> 解析 -> 创建)
    """
    # 1. 验证输入
    site = await crud_site.get(db, id=site_id)
    if not site:
        raise BadRequestException(detail=f"站点 {site_id} 不存在")

    # 验证上传文件类型 (简单验证后缀)
    filename = file.filename or ""
    suffix = Path(filename).suffix.lower()
    if suffix not in [".pdf", ".jpg", ".jpeg", ".png"]:
        raise BadRequestException(detail="目前仅支持 PDF 和图片文件")

    # 2. 保存上传文件到临时目录
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = Path(tmp.name)
    except Exception as e:
        logger.error(f"保存上传文件失败: {e}")
        raise BadRequestException(detail="文件上传失败")

    try:
        # 3. 获取解析器配置
        # 先获取当前租户是否允许使用平台资源
        active_tenant_id = get_current_tenant()
        platform_fallback_allowed = False
        if active_tenant_id:
            from app.crud.tenant import crud_tenant

            tenant = await crud_tenant.get(db, id=active_tenant_id)
            if tenant and "doc_processors" in (tenant.platform_resources_allowed or []):
                platform_fallback_allowed = True

        # 获取当前租户的配置
        doc_processor_config = await crud_system_config.get_by_key(
            db, config_key="doc_processor_config", tenant_id=active_tenant_id
        )

        processors = []
        if doc_processor_config:
            processors = doc_processor_config.config_value.get("processors", [])

        # 找到指定的处理器配置
        target_processor_config = None
        for p in processors:
            if p.get("type") == processor_type or p.get("name") == processor_type:
                target_processor_config = p
                break

        # 如果在租户配置中没找到，且允许降级到平台，则查找平台配置
        if not target_processor_config and platform_fallback_allowed:
            platform_config = await crud_system_config.get_by_key(
                db, config_key="doc_processor_config", tenant_id=None
            )
            if platform_config:
                platform_processors = platform_config.config_value.get("processors", [])
                for p in platform_processors:
                    if p.get("type") == processor_type or p.get("name") == processor_type:
                        target_processor_config = p
                        break

        if not target_processor_config:
            # 如果还是找不到指定类型，尝试使用租户或平台（如果允许）的第一个可用的
            if processors:
                target_processor_config = processors[0]
            elif platform_fallback_allowed:
                platform_config = await crud_system_config.get_by_key(
                    db, config_key="doc_processor_config", tenant_id=None
                )
                if platform_config and platform_config.config_value.get("processors"):
                    target_processor_config = platform_config.config_value.get("processors")[0]

            if not target_processor_config:
                raise BadRequestException(
                    detail=f"未找到类型为 {processor_type} 的文档处理器配置，请联系管理员"
                )

        # 覆盖设置 (如果支持)
        if "config" not in target_processor_config:
            target_processor_config["config"] = {}

        # 注入用户在上传时指定的临时配置
        target_processor_config["config"]["is_ocr"] = ocr_enabled
        target_processor_config["config"]["extract_images"] = extract_images
        target_processor_config["config"]["extract_tables"] = extract_tables

        # 4. 初始化解析器并执行解析
        try:
            # 转换为 Schema 对象
            processor_config_obj = DocProcessorConfig(**target_processor_config)
            processor = DocProcessorFactory.create(processor_config_obj)

            logger.info(f"🚀 开始解析文档: {filename} using {processor_type} (OCR={ocr_enabled})")
            start_time = time.time()

            # 执行解析
            result = await processor.process(tmp_path)

            elapsed = time.time() - start_time
            logger.info(
                f"✅ 文档解析完成 ({elapsed:.2f}s). Markdown length: {len(result.markdown)}"
            )

        except ValueError as e:
            raise BadRequestException(detail=str(e))
        except Exception as e:
            logger.error(f"文档解析失败: {e}", exc_info=True)
            raise BadRequestException(detail=f"文档解析失败: {str(e)}")

        # 5. 创建文档
        document_in = DocumentCreate(
            title=filename.replace(suffix, ""),  # 默认使用文件名作为标题
            content=result.markdown,
            site_id=site_id,
            collection_id=collection_id,
            author=current_user.name or current_user.email,  # 默认为当前用户
            status=DocumentStatus.DRAFT,  # 默认为草稿，让用户确认
        )

        document = await crud_document.create(db, obj_in=document_in)

        # 更新站点文章计数
        await crud_site.increment_article_count(db, site_id=site_id)

        # 构建返回
        document_dict = await enrich_document_dict(document, db, crud_collection)
        return ApiResponse.ok(data=document_dict, msg="文档导入成功")

    finally:
        # 清理临时文件
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except Exception as e:
                logger.warning(f"清理临时文件失败: {tmp_path}, {e}")


@router.put(
    "/{document_id}", response_model=ApiResponse[Document], operation_id="updateAdminDocument"
)
async def update_document(
    document_id: int,
    document_in: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[Document]:
    """更新文档"""
    document = await crud_document.get(db, id=document_id)
    if not document:
        raise NotFoundException(detail=f"文档 {document_id} 不存在")

    # 更新文档（CRUD 层会自动计算阅读时间）
    document = await crud_document.update(db, db_obj=document, obj_in=document_in)

    # 构建文档字典，添加关联的合集信息
    document_dict = await enrich_document_dict(document, db, crud_collection)

    return ApiResponse.ok(data=document_dict, msg="更新成功")


@router.delete(
    "/{document_id}", response_model=ApiResponse[None], operation_id="deleteAdminDocument"
)
async def delete_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[None]:
    """删除文档"""
    document = await crud_document.get(db, id=document_id)
    if not document:
        raise NotFoundException(detail=f"文档 {document_id} 不存在")

    site_id = document.site_id

    # 尝试删除向量数据（如果有）
    try:
        from app.core.vector.vector_store import VectorStoreManager

        vector_store = await VectorStoreManager.get_instance()
        await vector_store.delete_by_metadata(key="id", value=str(document_id))
    except Exception as e:
        logger.warning(f"删除文档向量失败: {e}")

    await crud_document.delete(db, id=document_id)

    # 更新站点文章计数
    await crud_site.decrement_article_count(db, site_id=site_id)

    return ApiResponse.ok(msg="删除成功")


# ============ 向量化相关接口 ============


async def _dispatch_vectorization_tasks(
    db: AsyncSession,
    background_tasks: BackgroundTasks,
    document_ids: list[int],
) -> tuple[list[int], int]:
    """
    统一处理向量化任务分发
    Returns:
        (success_ids, failed_count)
    """
    # 批量获取文档
    documents = await crud_document.get_multi(db, ids=document_ids)
    document_map = {doc.id: doc for doc in documents}

    success_ids = []
    failed_count = 0

    # 筛选可向量化的文档
    for doc_id in document_ids:
        document = document_map.get(doc_id)
        if document and can_vectorize(document):
            success_ids.append(doc_id)
        else:
            failed_count += 1

    if not success_ids:
        return [], failed_count

    # 1. 批量更新状态为 PENDING
    await crud_document.batch_update_vector_status(
        db, document_ids=success_ids, status=VectorStatus.PENDING
    )

    # 2. 检查向量服务可用性
    try:
        from app.core.vector.vector_store import VectorStoreManager

        # 获取实例并强制检查初始化状态
        vector_store = await VectorStoreManager.get_instance()
        await vector_store._ensure_initialized(force=True)

    except (ValueError, Exception) as e:
        error_msg = str(e)
        logger.error(f"Vector store check failed: {e}")
        # 回滚状态为 FAILED
        await crud_document.batch_update_vector_status(
            db,
            document_ids=success_ids,
            status=VectorStatus.FAILED,
            error=f"向量服务不可用: {error_msg}",
        )
        # 抛出异常中断流程
        raise BadRequestException(detail=f"向量服务暂不可用: {error_msg}")

    # 3. 分发后台任务
    for doc_id in success_ids:
        background_tasks.add_task(process_vectorization_task, doc_id)

    return success_ids, failed_count


@router.post(
    ":batchVectorize",
    response_model=ApiResponse[VectorizeResponse],
    operation_id="batchVectorizeAdminDocuments",
)
async def vectorize_documents(
    request: VectorizeRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[VectorizeResponse]:
    """批量向量化文档（将文档状态设置为 pending，并启动向量化后台任务）"""
    if not request.document_ids:
        raise BadRequestException(detail="文档ID列表不能为空")

    success_ids, failed_count = await _dispatch_vectorization_tasks(
        db, background_tasks, request.document_ids
    )

    return ApiResponse.ok(
        data=VectorizeResponse(
            success_count=len(success_ids), failed_count=failed_count, document_ids=success_ids
        ),
        msg=f"已将 {len(success_ids)} 个文档加入学习队列",
    )


@router.post(
    "/{document_id}:vectorize",
    response_model=ApiResponse[Document],
    operation_id="vectorizeAdminDocument",
)
async def vectorize_single_document(
    document_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[Document]:
    """向量化单个文档（会启动向量化后台任务）"""
    # 检查文档是否存在 (保持原有 404 逻辑)
    document = await crud_document.get(db, id=document_id)
    if not document:
        raise NotFoundException(detail=f"文档 {document_id} 不存在")

    # 复用批量处理逻辑
    try:
        success_ids, _ = await _dispatch_vectorization_tasks(db, background_tasks, [document_id])
    except BadRequestException as e:
        # 捕获服务不可用异常，直接抛出
        raise e

    if not success_ids:
        # 说明不可向量化 (can_vectorize 返回 False)
        raise BadRequestException(detail=f"文档当前状态为 {document.vector_status}，无法重新学习")

    # 重新获取文档以返回最新状态
    document = await crud_document.get(db, id=document_id)
    document_dict = await enrich_document_dict(document, db, crud_collection)

    return ApiResponse.ok(data=document_dict, msg="已加入学习队列")


@router.post(
    "/{document_id}:removeVector",
    response_model=ApiResponse[Document],
    operation_id="removeAdminDocumentVector",
)
async def remove_document_vector(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[Document]:
    """移除文档向量（从向量库删除并重置状态为 none）"""
    document = await crud_document.get(db, id=document_id)
    if not document:
        raise NotFoundException(detail=f"文档 {document_id} 不存在")

    # 尝试从向量库删除数据
    try:
        from app.core.vector.vector_store import VectorStoreManager

        vector_store = await VectorStoreManager.get_instance()
        # 使用 delete_by_metadata 确保删除该文档关联的所有 chunk
        await vector_store.delete_by_metadata(key="id", value=str(document_id))
    except Exception as e:
        logger.warning(f"删除向量数据失败: {e}")

    # 更新状态为 none
    document = await crud_document.update_vector_status(
        db, document_id=document_id, status=VectorStatus.NONE
    )

    document_dict = await enrich_document_dict(document, db, crud_collection)

    return ApiResponse.ok(data=document_dict, msg="已移除向量数据")


@router.get(
    "/{document_id}/chunks",
    response_model=ApiResponse[list[dict]],
    operation_id="getAdminDocumentChunks",
)
async def get_document_chunks(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[list[dict]]:
    """获取文档的向量切片信息"""
    logger.info(f"🔍 [Chunks] Requesting chunks for document_id: {document_id}")
    document = await crud_document.get(db, id=document_id)
    if not document:
        logger.warning(f"⚠️ [Chunks] Document {document_id} not found")
        raise NotFoundException(detail=f"文档 {document_id} 不存在")

    chunks = []
    try:
        from app.core.vector.vector_store import VectorStoreManager

        vector_store = await VectorStoreManager.get_instance()
        chunks = await vector_store.get_chunks_by_metadata(key="id", value=str(document_id))
        logger.info(f"✅ [Chunks] Found {len(chunks)} chunks for document {document_id}")
    except Exception as e:
        logger.error(f"❌ [Chunks] Failed to get chunks: {e}", exc_info=True)
        # 不抛出异常，返回空列表

    return ApiResponse.ok(data=chunks, msg="获取成功")


@router.post(
    "/retrieve", response_model=ApiResponse[VectorRetrieveResult], operation_id="retrieveDocuments"
)
async def retrieve_vectors(
    request: VectorRetrieveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[VectorRetrieveResult]:
    """
    语义检索向量数据库 (delegates to RAGService)
    """
    try:
        from app.services.rag import RAGService

        # 转换过滤器格式 (Schema 应该兼容，但为了保险起见，明确这里是 VectorRetrieveRequest.filter -> VectorRetrieveFilter)
        # 实际上 Pydantic 模型是一致的

        results = await RAGService.retrieve(
            query=request.query,
            k=request.k,
            threshold=request.threshold,
            filter=request.filter,
            enable_rerank=request.enable_rerank,
            rerank_k=request.rerank_k,
        )

        return ApiResponse.ok(data=VectorRetrieveResult(list=results), msg="检索成功")

    except Exception as e:
        logger.error(f"检索失败: {e}", exc_info=True)
        return ApiResponse.ok(data=VectorRetrieveResult(list=[]), msg=f"检索失败: {str(e)}")
