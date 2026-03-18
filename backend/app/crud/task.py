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


from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.base import CRUDBase
from app.models.task import Task, TaskStatus
from app.schemas.task import Task as TaskSchema
from app.schemas.task import TaskCreate


class CRUDTask(CRUDBase[Task, TaskCreate, TaskSchema]):
    """任务 CRUD 操作"""

    async def get_multi_by_tenant(
        self,
        db: AsyncSession,
        *,
        tenant_id: int,
        site_id: int | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Task]:
        """获取租户的任务列表"""
        stmt = select(Task).filter(Task.tenant_id == tenant_id)
        if site_id:
            stmt = stmt.filter(Task.site_id == site_id)

        stmt = stmt.order_by(Task.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(stmt)
        return result.scalars().all()

    async def update_status(
        self,
        db: AsyncSession,
        *,
        task_id: int,
        status: TaskStatus,
        progress: float | None = None,
        result: dict | None = None,
        error: str | None = None,
        auto_commit: bool = False,
    ) -> Task | None:
        """更新任务状态"""
        update_data = {"status": status.value if isinstance(status, TaskStatus) else status}
        if progress is not None:
            update_data["progress"] = progress
        if result is not None:
            update_data["result"] = result
        if error is not None:
            update_data["error"] = error

        stmt = update(Task).where(Task.id == task_id).values(**update_data).returning(Task)
        try:
            res = await db.execute(stmt)
            task = res.scalar_one_or_none()
            if task and auto_commit:
                await db.commit()
            elif not auto_commit:
                await db.flush()
            return task
        except Exception:
            if auto_commit:
                await db.rollback()
            raise


crud_task = CRUDTask(Task)
