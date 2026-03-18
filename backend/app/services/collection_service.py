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

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.common.utils import Paginator
from app.core.web.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
)
from app.crud import crud_collection, crud_document, crud_site
from app.db.database import get_db
from app.db.transaction import transactional
from app.models.collection import Collection as CollectionModel
from app.schemas.collection import (
    CollectionCreate,
    CollectionTree,
    CollectionUpdate,
)

logger = logging.getLogger(__name__)


class CollectionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @transactional()
    async def get_collection_tree(
        self,
        site_id: int,
        show_type: str | None = None,
        tenant_id: int | None = None,
        status: str | None = None,
    ) -> list[CollectionTree]:
        """
        获取合集树形结构（优化版：批量加载文档，避免N+1查询）
        """
        include_documents = show_type != "collection"

        # 优化：如果需要包含文档，一次性批量查询所有文档
        documents_by_collection = {}
        if include_documents:
            all_documents = await crud_document.list(
                self.db, site_id=site_id, tenant_id=tenant_id, status=status, skip=0, limit=None
            )
            for doc in all_documents:
                cid = doc.collection_id
                if cid not in documents_by_collection:
                    documents_by_collection[cid] = []
                documents_by_collection[cid].append(doc)

        async def build_tree(parent_id: int | None = None) -> list[CollectionTree]:
            collections = await crud_collection.list(
                self.db, site_id=site_id, tenant_id=tenant_id, parent_id=parent_id
            )
            tree = []
            for collection in collections:
                children = await build_tree(collection.id)

                if include_documents and collection.id in documents_by_collection:
                    for doc in documents_by_collection[collection.id]:
                        children.append(
                            CollectionTree(
                                id=doc.id,
                                title=doc.title,
                                type="document",
                                children=None,
                                status=doc.status,
                                views=doc.views,
                                tags=doc.tags,
                                collection_id=doc.collection_id,
                            )
                        )

                tree.append(
                    CollectionTree(
                        id=collection.id,
                        title=collection.title,
                        type="collection",
                        children=children if children else None,
                    )
                )
            return tree

        return await build_tree()

    @transactional()
    async def list_collections(
        self,
        site_id: int,
        tenant_id: int | None = None,
        parent_id: int | None = None,
        page: int = 1,
        size: int = 20,
    ) -> tuple[list[CollectionModel], Paginator]:
        """获取合集列表（带分页）"""
        total = await crud_collection.count(
            self.db, site_id=site_id, tenant_id=tenant_id, parent_id=parent_id
        )
        paginator = Paginator(page=page, size=size, total=total)
        collections = await crud_collection.list(
            self.db,
            site_id=site_id,
            tenant_id=tenant_id,
            parent_id=parent_id,
            skip=paginator.skip,
            limit=paginator.size,
        )
        return collections, paginator

    @transactional()
    async def get_collection(
        self, collection_id: int, tenant_id: int | None = None
    ) -> CollectionModel:
        """获取合集详情"""
        collection = await crud_collection.get(self.db, id=collection_id)
        if not collection:
            raise NotFoundException(detail=f"合集 {collection_id} 不存在")
        if tenant_id is not None and collection.tenant_id != tenant_id:
            raise ForbiddenException(detail="无权访问该租户的合集")
        return collection

    @transactional()
    async def create_collection(
        self,
        collection_in: CollectionCreate,
        tenant_id: int | None = None,
    ) -> CollectionModel:
        """
        创建合集（带一致性校验）
        """
        site = await crud_site.get(self.db, id=collection_in.site_id)
        if not site:
            raise BadRequestException(detail=f"站点 {collection_in.site_id} 不存在")

        if collection_in.parent_id:
            parent = await self.get_collection(
                collection_id=collection_in.parent_id, tenant_id=tenant_id
            )
            if parent.site_id != collection_in.site_id:
                raise BadRequestException(detail="父合集必须属于同一站点")

        # 确保包含 tenant_id
        obj_in_dict = collection_in.model_dump()
        if tenant_id is not None:
            obj_in_dict["tenant_id"] = tenant_id

        return await crud_collection.create(self.db, obj_in=obj_in_dict)

    @transactional()
    async def update_collection(
        self,
        collection_id: int,
        collection_in: CollectionUpdate,
        tenant_id: int | None = None,
    ) -> CollectionModel:
        """
        更新合集（带一致性校验）
        """
        collection = await self.get_collection(collection_id=collection_id, tenant_id=tenant_id)

        if collection_in.parent_id:
            if collection_in.parent_id == collection_id:
                raise BadRequestException(detail="不能将合集设置为自己的子合集")

            parent = await self.get_collection(
                collection_id=collection_in.parent_id, tenant_id=tenant_id
            )
            if parent.site_id != collection.site_id:
                raise BadRequestException(detail="父合集必须属于同一站点")

        return await crud_collection.update(self.db, db_obj=collection, obj_in=collection_in)

    @transactional()
    async def delete_collection(self, collection_id: int, tenant_id: int | None = None) -> None:
        """
        删除合集（带级联检查）
        """
        _ = await self.get_collection(collection_id=collection_id, tenant_id=tenant_id)

        collection_ids = await crud_collection.get_descendant_ids(
            self.db, collection_id=collection_id
        )
        documents = await crud_document.list(
            self.db, collection_ids=collection_ids, skip=0, limit=1
        )
        if documents:
            raise BadRequestException(detail="无法删除合集，该合集下还有文档。")

        children = await crud_collection.list(self.db, parent_id=collection_id)
        if children:
            raise BadRequestException(detail="无法删除合集，该合集下还有子合集。")

        await crud_collection.delete(self.db, id=collection_id)

    @transactional()
    async def move_collection(
        self,
        collection_id: int,
        target_parent_id: int | None,
        target_position: int,
        tenant_id: int | None = None,
    ) -> CollectionModel:
        """
        移动合集到新位置（带一致性重排逻辑）
        """
        collection = await self.get_collection(collection_id=collection_id, tenant_id=tenant_id)

        site_id = collection.site_id

        if target_parent_id is not None:
            if target_parent_id == collection_id:
                raise BadRequestException(detail="不能将合集移动到自己下面")

            target_parent = await self.get_collection(
                collection_id=target_parent_id, tenant_id=tenant_id
            )
            if target_parent.site_id != site_id:
                raise BadRequestException(detail="目标父合集必须属于同一站点")

            descendant_ids = await crud_collection.get_descendant_ids(
                self.db, collection_id=collection_id
            )
            if target_parent_id in descendant_ids:
                raise BadRequestException(detail="不能将合集移动到自己的后代节点下")

        siblings = await crud_collection.list(self.db, site_id=site_id, parent_id=target_parent_id)
        siblings = [s for s in siblings if s.id != collection_id]

        if target_position > len(siblings):
            target_position = len(siblings)

        # 执行移动排队逻辑并手动提交
        collection.parent_id = target_parent_id
        self.db.add(collection)

        siblings.insert(target_position, collection)
        for index, sibling in enumerate(siblings):
            if sibling.order != index:
                sibling.order = index
                self.db.add(sibling)

        # 自动处理提交
        return collection


def get_collection_service(
    db: AsyncSession = Depends(get_db),
) -> CollectionService:
    """获取 CollectionService 实例的依赖注入函数"""
    return CollectionService(db)
