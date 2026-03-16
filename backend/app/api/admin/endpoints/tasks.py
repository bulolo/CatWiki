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

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.web.deps import get_current_user_with_tenant, get_effective_tenant_id
from app.core.web.exceptions import NotFoundException
from app.crud.task import crud_task
from app.db.database import get_db
from app.models.user import User
from app.schemas.response import ApiResponse, PaginatedResponse
from app.schemas.task import Task as TaskSchema

router = APIRouter()


@router.get("", response_model=ApiResponse[PaginatedResponse[TaskSchema]])
async def list_tasks(
    page: int = 1,
    size: int = 20,
    site_id: int | None = Query(None, description="站点ID"),
    db: AsyncSession = Depends(get_db),
    tenant_id: int | None = Depends(get_effective_tenant_id),
    current_user: User = Depends(get_current_user_with_tenant),
):
    """获取异步任务列表"""
    skip = (page - 1) * size
    tasks = await crud_task.get_multi_by_tenant(
        db, tenant_id=tenant_id, site_id=site_id, skip=skip, limit=size
    )

    # 这里简略处理分页真相
    return ApiResponse.ok(data=PaginatedResponse(list=tasks))


@router.get("/{task_id}", response_model=ApiResponse[TaskSchema])
async def get_task_status(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    tenant_id: int | None = Depends(get_effective_tenant_id),
    current_user: User = Depends(get_current_user_with_tenant),
):
    """获取单个任务详情和状态"""
    task = await crud_task.get(db, id=task_id)
    if not task:
        raise NotFoundException(detail="任务未找到")

    if tenant_id is not None and task.tenant_id != tenant_id:
        raise NotFoundException(detail="任务未找到")

    return ApiResponse.ok(data=task)
