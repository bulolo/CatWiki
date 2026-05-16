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

"""数据源管理 API 端点"""

import logging

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile

from app.core.web.deps import get_current_user_with_tenant
from app.models.user import User
from app.schemas.data_source import (
    DataSource,
    DataSourceCreate,
    DataSourceImportRequest,
    DataSourceUpdate,
    S3FileItem,
    UploadedFile,
)
from app.schemas.response import ApiResponse
from app.services.data_source import DataSourceService, get_data_source_service

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("", response_model=ApiResponse[list[DataSource]], operation_id="listDataSources")
async def list_data_sources(
    service: DataSourceService = Depends(get_data_source_service),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[list[DataSource]]:
    items = await service.list_data_sources(tenant_id=current_user.tenant_id)
    return ApiResponse.ok(data=items)


@router.post("", response_model=ApiResponse[DataSource], operation_id="createDataSource")
async def create_data_source(
    data_in: DataSourceCreate,
    service: DataSourceService = Depends(get_data_source_service),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[DataSource]:
    item = await service.create_data_source(data_in, tenant_id=current_user.tenant_id)
    return ApiResponse.ok(data=item)


@router.put("/{ds_id}", response_model=ApiResponse[DataSource], operation_id="updateDataSource")
async def update_data_source(
    ds_id: int,
    data_in: DataSourceUpdate,
    service: DataSourceService = Depends(get_data_source_service),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[DataSource]:
    item = await service.update_data_source(ds_id, data_in, tenant_id=current_user.tenant_id)
    return ApiResponse.ok(data=item)


@router.delete("/{ds_id}", response_model=ApiResponse[None], operation_id="deleteDataSource")
async def delete_data_source(
    ds_id: int,
    service: DataSourceService = Depends(get_data_source_service),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[None]:
    await service.delete_data_source(ds_id, tenant_id=current_user.tenant_id)
    return ApiResponse.ok(data=None)


@router.get(
    "/{ds_id}/browse",
    response_model=ApiResponse[list[S3FileItem]],
    operation_id="browseDataSource",
)
async def browse_data_source(
    ds_id: int,
    prefix: str = Query(default="", description="浏览路径前缀"),
    service: DataSourceService = Depends(get_data_source_service),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[list[S3FileItem]]:
    items = await service.browse(ds_id, tenant_id=current_user.tenant_id, prefix=prefix)
    return ApiResponse.ok(data=items)


@router.post(
    "/{ds_id}/upload",
    response_model=ApiResponse[UploadedFile],
    operation_id="uploadToDataSource",
)
async def upload_to_data_source(
    ds_id: int,
    file: UploadFile = File(...),
    prefix: str = Form(default=""),
    service: DataSourceService = Depends(get_data_source_service),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[UploadedFile]:
    result = await service.upload_file(
        ds_id=ds_id, tenant_id=current_user.tenant_id, file=file, prefix=prefix
    )
    return ApiResponse.ok(data=result, msg="上传成功")


@router.delete(
    "/{ds_id}/files",
    response_model=ApiResponse[None],
    operation_id="deleteDataSourceFile",
)
async def delete_data_source_file(
    ds_id: int,
    key: str = Query(..., description="完整文件路径"),
    service: DataSourceService = Depends(get_data_source_service),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[None]:
    await service.delete_file(ds_id=ds_id, tenant_id=current_user.tenant_id, key=key)
    return ApiResponse.ok(data=None, msg="删除成功")


@router.post(
    "/{ds_id}/import",
    response_model=ApiResponse[list[dict]],
    operation_id="importFromDataSource",
)
async def import_from_data_source(
    ds_id: int,
    req: DataSourceImportRequest,
    service: DataSourceService = Depends(get_data_source_service),
    current_user: User = Depends(get_current_user_with_tenant),
) -> ApiResponse[list[dict]]:
    tasks = await service.import_files(
        ds_id=ds_id,
        tenant_id=current_user.tenant_id,
        req=req,
        current_username=current_user.name or current_user.email,
    )
    return ApiResponse.ok(data=tasks, msg=f"已创建 {len(tasks)} 个导入任务")
