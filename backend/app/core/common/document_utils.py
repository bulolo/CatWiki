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
文档处理工具函数
"""

from sqlalchemy.ext.asyncio import AsyncSession


async def build_collection_map(
    db: AsyncSession, crud_collection, collection_ids: list[int]
) -> dict[int, dict]:
    """
    批量构建 collection 映射（包含祖先和路径信息），用于优化 N+1 查询

    Args:
        db: 数据库会话
        crud_collection: 合集 CRUD 实例
        collection_ids: 合集ID列表

    Returns:
        collection_id -> collection_info 的映射字典
    """
    if not collection_ids:
        return {}

    from sqlalchemy import select

    # 批量查询所有collection
    result = await db.execute(
        select(crud_collection.model).where(crud_collection.model.id.in_(collection_ids))
    )
    collections = list(result.scalars())

    # 构建collection映射，包含祖先和路径信息
    collections_map = {}
    for coll in collections:
        collections_map[coll.id] = {
            "id": coll.id,
            "title": coll.title,
            "parent_id": coll.parent_id,
            "ancestors": await crud_collection.get_ancestors(db, collection_id=coll.id),
            "path": await crud_collection.get_path(db, collection_id=coll.id),
        }

    return collections_map


async def enrich_document_dict(
    document,
    db: AsyncSession,
    crud_collection,
    include_site_name: bool = False,
    collection_map: dict[int, dict] | None = None,
) -> dict:
    """
    丰富文档字典，添加关联的合集信息和站点名称

    Args:
        document: 文档模型实例
        db: 数据库会话
        crud_collection: 合集 CRUD 实例
        include_site_name: 是否包含站点名称
        collection_map: 预加载的合集映射（用于优化性能）

    Returns:
        包含合集信息的文档字典
    """
    # 使用 __dict__.copy() 或手动构建字典
    if hasattr(document, "__dict__"):
        doc_dict = document.__dict__.copy()
    else:
        # 手动构建字典（适用于已序列化的对象）
        doc_dict = {
            "id": document.id,
            "title": document.title,
            "summary": getattr(document, "summary", None),
            "cover_image": getattr(document, "cover_image", None),
            "site_id": document.site_id,
            "collection_id": getattr(document, "collection_id", None),
            "category": getattr(document, "category", None),
            "author": getattr(document, "author", None),
            "status": getattr(document, "status", None),
            "tags": getattr(document, "tags", None),
            "views": getattr(document, "views", 0),
            "reading_time": getattr(document, "reading_time", None),
            "created_at": getattr(document, "created_at", None),
            "updated_at": getattr(document, "updated_at", None),
            "content": getattr(document, "content", None),
        }

    # 添加站点名称
    if include_site_name and hasattr(document, "site") and document.site:
        doc_dict["site_name"] = document.site.name

    # 添加合集对象
    collection_id = doc_dict.get("collection_id")
    if collection_id:
        # 优先使用预加载的 collection_map（性能优化）
        if collection_map and collection_id in collection_map:
            doc_dict["collection"] = collection_map[collection_id]
        else:
            # 回退到单独查询
            collection = await crud_collection.get(db, id=collection_id)
            if collection:
                doc_dict["collection"] = {
                    "id": collection.id,
                    "title": collection.title,
                    "parent_id": collection.parent_id,
                    "ancestors": await crud_collection.get_ancestors(
                        db, collection_id=collection_id
                    ),
                    "path": await crud_collection.get_path(db, collection_id=collection_id),
                }
            else:
                doc_dict["collection"] = None
    else:
        doc_dict["collection"] = None

    return doc_dict
