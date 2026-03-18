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

from arq import create_pool
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.queue.redis import redis_settings
from app.crud.task import crud_task
from app.db.transaction import transactional
from app.models.task import Task, TaskStatus, TaskType
from app.schemas.task import TaskCreate

logger = logging.getLogger(__name__)


class TaskService:
    """后台任务管理服务"""

    _redis_pool = None

    @classmethod
    async def get_redis_pool(cls):
        if cls._redis_pool is None:
            cls._redis_pool = await create_pool(redis_settings)
        return cls._redis_pool

    @classmethod
    @transactional()
    async def enqueue_task(
        cls,
        db: AsyncSession,
        *,
        task_type: TaskType,
        tenant_id: int,
        created_by: str,
        payload: dict,
        site_id: int | None = None,
    ) -> Task:
        """创建一个任务记录并在事务提交后推入 Arq 队列"""
        # 1. 创建数据库记录
        task_in = TaskCreate(
            task_type=task_type.value,
            tenant_id=tenant_id,
            site_id=site_id,
            created_by=created_by,
            payload=payload,
            status=TaskStatus.PENDING.value,
            progress=0.0,
        )
        task = await crud_task.create(db, obj_in=task_in)

        # 2. 注册提交后回调，确保 Worker 启动时能查到数据
        from app.db.transaction import on_commit

        on_commit(db, cls._perform_enqueue, db, task.id, task_type)

        return task

    @classmethod
    async def _perform_enqueue(cls, db: AsyncSession, task_id: int, task_type: TaskType):
        """实际执行 Arq 队列推入（在主事务提交后运行）"""
        logger.info(f"📤 开始异步推入 arq 队列: {task_type} | TaskID: {task_id}")
        try:
            func_name = f"process_{task_type.value}"
            pool = await cls.get_redis_pool()

            # 推入队列
            job = await pool.enqueue_job(func_name, task_id)
            logger.info(f"📝 arq 任务推送成功 | JobID: {job.job_id}")

            # 开启新事务更新 Job ID
            await cls._update_job_id(db, task_id, job.job_id)

            logger.info(f"✅ 任务已推入队列: {task_type} | ID: {task_id} | JobID: {job.job_id}")
        except Exception as e:
            logger.error(f"❌ 异步推入队列记录 {task_id} 失败: {e}", exc_info=True)
            # 推送失败时，反向更新任务状态为 FAILED，避免一直卡在 PENDING
            try:
                await cls.fail(db, task_id, f"分发队列失败: {str(e)}")
            except Exception as fe:
                logger.error(f"⚠️ 更新任务失败状态也遭遇异常 (Task={task_id}): {fe}")

    @classmethod
    @transactional()
    async def _update_job_id(cls, db: AsyncSession, task_id: int, job_id: str):
        """在新事务中更新 Job ID"""
        logger.info(f"✍️ 正在更新 Task={task_id} 的 JobID={job_id}")
        task = await crud_task.get(db, id=task_id)
        if task:
            await crud_task.update(db, db_obj=task, obj_in={"job_id": job_id})

    @classmethod
    @transactional()
    async def update_progress(cls, db: AsyncSession, task_id: int, progress: float):
        """更新任务进度"""
        await crud_task.update_status(
            db, task_id=task_id, status=TaskStatus.RUNNING, progress=progress
        )

    @classmethod
    @transactional()
    async def complete(cls, db: AsyncSession, task_id: int, result: dict | None = None):
        """标记任务完成"""
        await crud_task.update_status(
            db, task_id=task_id, status=TaskStatus.COMPLETED, progress=100.0, result=result
        )

    @classmethod
    @transactional()
    async def fail(cls, db: AsyncSession, task_id: int, error: str):
        """标记任务失败"""
        await crud_task.update_status(db, task_id=task_id, status=TaskStatus.FAILED, error=error)

    @classmethod
    async def close(cls):
        """关闭连接池"""
        if cls._redis_pool is not None:
            await cls._redis_pool.close()
            cls._redis_pool = None
            logger.info("✅ TaskService 队列连接池已关闭")
