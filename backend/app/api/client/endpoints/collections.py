from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException
from app.crud import crud_collection, crud_site
from app.db.database import get_db
from app.schemas import ApiResponse
from app.schemas.collection import CollectionTree

router = APIRouter()


@router.get(":tree", response_model=ApiResponse[list[CollectionTree]], operation_id="getClientCollectionTree")
async def get_collection_tree(
    site_id: int = Query(..., description="站点ID"),
    include_documents: bool = Query(False, description="是否包含文档节点"),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[list[CollectionTree]]:
    """获取合集树形结构（客户端）"""
    # 验证站点存在
    site = await crud_site.get(db, id=site_id)
    if not site:
        raise BadRequestException(detail=f"站点 {site_id} 不存在")

    # 如果需要包含文档，批量加载所有已发布文档（避免N+1查询）
    from app.crud import crud_document
    documents_by_collection = {}
    if include_documents:
        # 获取站点下所有已发布文档（用于树形展示，不限制数量）
        all_documents = await crud_document.list(
            db,
            site_id=site_id,
            status="published",
            skip=0,
            limit=None
        )
        published_docs = all_documents

        # 按 collection_id 分组
        for doc in published_docs:
            if doc.collection_id not in documents_by_collection:
                documents_by_collection[doc.collection_id] = []
            documents_by_collection[doc.collection_id].append(doc)

    async def build_tree(parent_id: int | None = None) -> list[CollectionTree]:
        """递归构建合集树"""
        collections = await crud_collection.list(db, site_id=site_id, parent_id=parent_id)

        tree = []
        for collection in collections:
            # 递归获取子合集
            children = await build_tree(collection.id)

            # 如果需要包含文档，从预加载的字典中获取
            if include_documents and collection.id in documents_by_collection:
                documents = documents_by_collection[collection.id]

                # 将文档转换为树节点
                for doc in documents:
                    children.append(CollectionTree(
                        id=doc.id,
                        title=doc.title,
                        type="document",
                        children=None,
                        status=doc.status,
                        views=doc.views,
                        tags=doc.tags,
                        collection_id=doc.collection_id
                    ))

            tree.append(CollectionTree(
                id=collection.id,
                title=collection.title,
                type="collection",
                children=children if children else None
            ))
        return tree

    tree = await build_tree()
    return ApiResponse.ok(data=tree, msg="获取成功")
