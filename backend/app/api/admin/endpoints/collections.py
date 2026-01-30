"""
合集管理 API 端点
"""
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_active_user, get_valid_site
from app.core.exceptions import BadRequestException, NotFoundException
from app.crud import crud_collection, crud_document, crud_site
from app.db.database import get_db
from app.models.site import Site
from app.models.user import User
from app.schemas import ApiResponse
from app.schemas.collection import (
    Collection,
    CollectionCreate,
    CollectionTree,
    CollectionUpdate,
    MoveCollectionRequest,
)

router = APIRouter()


@router.get("", response_model=ApiResponse[list[Collection]], operation_id="listAdminCollections")
async def list_collections(
    parent_id: int | None = Query(None, description="父合集ID，为空则获取根合集"),
    db: AsyncSession = Depends(get_db),
    site: Site = Depends(get_valid_site),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[list[Collection]]:
    """获取合集列表"""
    # 获取合集列表（parent_id=None 获取根合集，否则获取子合集）
    collections = await crud_collection.list(db, site_id=site.id, parent_id=parent_id)

    return ApiResponse.ok(data=collections, msg="获取成功")


@router.get(":tree", response_model=ApiResponse[list[CollectionTree]], operation_id="getAdminCollectionTree")
async def get_collection_tree(
    type: str | None = Query(None, description="树节点类型：不指定则显示合集和文档，'collection'则只显示合集"),
    db: AsyncSession = Depends(get_db),
    site: Site = Depends(get_valid_site),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[list[CollectionTree]]:
    """获取合集树形结构（优化版：批量加载文档，避免N+1查询）"""

    # 是否包含文档节点
    include_documents = type != "collection"

    # 优化：如果需要包含文档，一次性批量查询所有文档（避免N+1查询）
    documents_by_collection = {}
    if include_documents:
        # 获取站点下所有文档（用于树形展示，不限制数量，不加载content字段）
        all_documents = await crud_document.list(
            db, site_id=site.id, skip=0, limit=None
        )

        # 按 collection_id 分组
        for doc in all_documents:
            collection_id = doc.collection_id
            if collection_id not in documents_by_collection:
                documents_by_collection[collection_id] = []
            documents_by_collection[collection_id].append(doc)

    async def build_tree(parent_id: int | None = None) -> list[CollectionTree]:
        """递归构建合集树"""
        collections = await crud_collection.list(db, site_id=site.id, parent_id=parent_id)

        tree = []
        for collection in collections:
            # 递归获取子合集
            children = await build_tree(collection.id)

            # 如果需要包含文档，从预加载的字典中获取（性能优化）
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


@router.get("/{collection_id}", response_model=ApiResponse[Collection], operation_id="getAdminCollection")
async def get_collection(
    collection_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[Collection]:
    """获取合集详情"""
    collection = await crud_collection.get(db, id=collection_id)
    if not collection:
        raise NotFoundException(detail=f"合集 {collection_id} 不存在")

    return ApiResponse.ok(data=collection, msg="获取成功")


@router.post("", response_model=ApiResponse[Collection], status_code=status.HTTP_201_CREATED, operation_id="createAdminCollection")
async def create_collection(
    collection_in: CollectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[Collection]:
    """创建合集"""
    # 验证站点存在
    site = await crud_site.get(db, id=collection_in.site_id)
    if not site:
        raise BadRequestException(detail=f"站点 {collection_in.site_id} 不存在")

    # 验证父合集存在（如果有）
    if collection_in.parent_id:
        parent = await crud_collection.get(db, id=collection_in.parent_id)
        if not parent:
            raise BadRequestException(detail=f"父合集 {collection_in.parent_id} 不存在")
        if parent.site_id != collection_in.site_id:
            raise BadRequestException(detail="父合集必须属于同一站点")

    collection = await crud_collection.create(db, obj_in=collection_in)
    return ApiResponse.ok(data=collection, msg="创建成功")


@router.put("/{collection_id}", response_model=ApiResponse[Collection], operation_id="updateAdminCollection")
async def update_collection(
    collection_id: int,
    collection_in: CollectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[Collection]:
    """更新合集"""
    collection = await crud_collection.get(db, id=collection_id)
    if not collection:
        raise NotFoundException(detail=f"合集 {collection_id} 不存在")

    # 验证父合集（如果修改了）
    if collection_in.parent_id:
        if collection_in.parent_id == collection_id:
            raise BadRequestException(detail="不能将合集设置为自己的子合集")

        parent = await crud_collection.get(db, id=collection_in.parent_id)
        if not parent:
            raise BadRequestException(detail=f"父合集 {collection_in.parent_id} 不存在")
        if parent.site_id != collection.site_id:
            raise BadRequestException(detail="父合集必须属于同一站点")

    collection = await crud_collection.update(db, db_obj=collection, obj_in=collection_in)
    return ApiResponse.ok(data=collection, msg="更新成功")


@router.delete("/{collection_id}", response_model=ApiResponse[None], operation_id="deleteAdminCollection")
async def delete_collection(
    collection_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[None]:
    """删除合集"""
    collection = await crud_collection.get(db, id=collection_id)
    if not collection:
        raise NotFoundException(detail=f"合集 {collection_id} 不存在")

    # 检查该合集及其所有子合集下是否有文档
    collection_ids = await crud_collection.get_descendant_ids(db, collection_id=collection_id)
    documents = await crud_document.list(db, collection_ids=collection_ids, skip=0, limit=1)

    if documents:
        raise BadRequestException(
            detail=f"无法删除合集，该合集下还有 {len(documents)} 个文档。请先删除或移动这些文档。"
        )

    # 检查是否有子合集
    children = await crud_collection.list(db, parent_id=collection_id)
    if children:
        raise BadRequestException(
            detail=f"无法删除合集，该合集下还有 {len(children)} 个子合集。请先删除这些子合集。"
        )

    await crud_collection.delete(db, id=collection_id)
    return ApiResponse.ok(msg="删除成功")


@router.post("/{collection_id}:move", response_model=ApiResponse[Collection], operation_id="moveAdminCollection")
async def move_collection(
    collection_id: int,
    move_request: MoveCollectionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[Collection]:
    """
    移动合集到新位置

    这个接口会：
    1. 更新合集的 parent_id
    2. 重新计算目标父级下所有合集的 order，确保顺序连续
    """
    # 验证合集存在
    collection = await crud_collection.get(db, id=collection_id)
    if not collection:
        raise NotFoundException(detail=f"合集 {collection_id} 不存在")

    site_id = collection.site_id
    target_parent_id = move_request.target_parent_id
    target_position = move_request.target_position

    # 验证目标父级存在（如果不是根级别）
    if target_parent_id is not None:
        # 不能移动到自己下面
        if target_parent_id == collection_id:
            raise BadRequestException(detail="不能将合集移动到自己下面")

        # 验证目标父级存在
        target_parent = await crud_collection.get(db, id=target_parent_id)
        if not target_parent:
            raise BadRequestException(detail=f"目标父合集 {target_parent_id} 不存在")

        # 验证目标父级属于同一站点
        if target_parent.site_id != site_id:
            raise BadRequestException(detail="目标父合集必须属于同一站点")

        # 验证不是移动到自己的后代节点
        descendant_ids = await crud_collection.get_descendant_ids(db, collection_id=collection_id)
        if target_parent_id in descendant_ids:
            raise BadRequestException(detail="不能将合集移动到自己的后代节点下")

    # 获取目标父级下的所有同级合集（不包括当前移动的合集）
    siblings = await crud_collection.list(db, site_id=site_id, parent_id=target_parent_id)

    # 过滤掉当前移动的合集
    siblings = [s for s in siblings if s.id != collection_id]

    # 确保 target_position 不超出范围
    if target_position > len(siblings):
        target_position = len(siblings)

    # 更新当前合集的 parent_id
    collection.parent_id = target_parent_id
    db.add(collection)
    await db.commit()
    await db.refresh(collection)

    # 将当前合集插入到指定位置
    siblings.insert(target_position, collection)

    # 重新计算所有同级合集的 order（确保连续：0, 1, 2, 3, ...）
    for index, sibling in enumerate(siblings):
        if sibling.order != index:
            sibling.order = index
            db.add(sibling)

    await db.commit()
    await db.refresh(collection)

    return ApiResponse.ok(data=collection, msg="移动成功")
