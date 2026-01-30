from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.core.utils import Paginator, build_collection_map, enrich_document_dict
from app.crud import crud_collection, crud_document
from app.db.database import get_db
from app.schemas import ApiResponse, PaginatedResponse
from app.schemas.document import Document

router = APIRouter()


@router.get("", response_model=ApiResponse[PaginatedResponse[Document]], operation_id="listClientDocuments")
async def list_published_documents(
    page: int = 1,
    size: int = 10,
    site_id: int | None = Query(None, description="站点ID"),
    collection_id: int | None = Query(None, description="合集ID"),
    keyword: str | None = Query(None, description="搜索关键词"),
    exclude_content: bool = Query(True, description="是否排除文档内容（用于列表展示，提升性能）"),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[PaginatedResponse[Document]]:
    """获取已发布文档列表（客户端）"""

    paginator = Paginator(page=page, size=size, total=0)

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
        status="published",
        keyword=keyword,
        skip=paginator.skip,
        limit=paginator.size
    )
    paginator.total = await crud_document.count(
        db, 
        site_id=site_id, 
        collection_ids=collection_ids, 
        status="published",
        keyword=keyword
    )

    # 批量加载所有需要的collection信息（优化N+1查询）
    collection_ids = list(set([doc.collection_id for doc in documents if doc.collection_id]))
    collection_map = await build_collection_map(db, crud_collection, collection_ids)

    # 为每个文档添加合集信息
    documents_with_collection = []
    for doc in documents:
        # 使用工具函数构建文档字典
        doc_dict = await enrich_document_dict(
            doc, db, crud_collection,
            include_site_name=False,
            collection_map=collection_map
        )
        # 处理 exclude_content 逻辑
        if exclude_content:
            doc_dict['content'] = None

        documents_with_collection.append(doc_dict)

    return ApiResponse.ok(
        data=PaginatedResponse(
            list=documents_with_collection,
            pagination=paginator.to_pagination_info(),
        ),
        msg="获取成功"
    )


@router.get("/{document_id}", response_model=ApiResponse[Document], operation_id="getClientDocument")
async def get_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[Document]:
    """获取文档详情（客户端，自动增加浏览量）"""
    # 自动增加浏览量
    document = await crud_document.increment_views(db, document_id=document_id)

    if not document:
        raise NotFoundException(detail=f"文档 {document_id} 不存在")

    # 只返回已发布的文档
    if document.status != "published":
        raise NotFoundException(detail=f"文档 {document_id} 不存在")

    # 构建文档字典，添加关联信息
    document_dict = await enrich_document_dict(document, db, crud_collection, include_site_name=True)

    return ApiResponse.ok(data=document_dict, msg="获取成功")
