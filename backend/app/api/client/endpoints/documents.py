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

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request

from app.core.common.i18n import _
from app.schemas.document import Document
from app.schemas.response import ApiResponse, PaginatedResponse
from app.services.document_service import DocumentService, get_document_service

router = APIRouter()


@router.get(
    "", response_model=ApiResponse[PaginatedResponse[Document]], operation_id="listClientDocuments"
)
async def list_published_documents(
    page: int = 1,
    size: int = 10,
    is_pager: int = Query(1, description="是否分页，0=返回全部，1=分页"),
    site_id: int | None = Query(None, description="站点ID"),
    collection_id: int | None = Query(None, description="合集ID"),
    keyword: str | None = Query(None, description="搜索关键词"),
    exclude_content: bool = Query(True, description="是否排除文档内容（用于列表展示，提升性能）"),
    order_by: str | None = Query(None, description="排序字段"),
    order_dir: str = Query("desc", description="排序方向"),
    include_site_info: bool = Query(False, description="是否包含站点信息"),
    tenant_id: int | None = Query(None, description="租户ID"),
    service: DocumentService = Depends(get_document_service),
) -> ApiResponse[PaginatedResponse[Document]]:
    """获取已发布文档列表（客户端）"""
    enriched_docs, paginator = await service.list_documents(
        page,
        size,
        site_id,
        collection_id,
        status="published",
        vector_status=None,
        keyword=keyword,
        order_by=order_by,
        order_dir=order_dir,
        exclude_content=exclude_content,
        tenant_id=tenant_id,
        include_site=include_site_info,
        is_pager=is_pager,
    )
    return ApiResponse.ok(
        data=PaginatedResponse(
            list=enriched_docs,
            pagination=paginator.to_pagination_info(),
        ),
        msg=_("api.success.get"),
    )


@router.get(
    "/{document_id}", response_model=ApiResponse[Document], operation_id="getClientDocument"
)
async def get_document(
    document_id: int,
    request: Request,
    background_tasks: BackgroundTasks,
    service: DocumentService = Depends(get_document_service),
) -> ApiResponse[Document]:
    """获取文档详情（客户端，自动增加浏览量并记录浏览事件）"""
    # 提取访客信息
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    referer = request.headers.get("referer")

    document_dict = await service.get_client_document(
        document_id, ip_address, user_agent, referer, background_tasks
    )
    return ApiResponse.ok(data=document_dict, msg=_("api.success.get"))
