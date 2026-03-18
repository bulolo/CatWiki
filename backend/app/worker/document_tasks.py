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
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import AsyncSessionLocal
from app.db.transaction import transactional

logger = logging.getLogger(__name__)


@transactional()
async def _do_import_parsing(
    db: AsyncSession, ctx: dict, task_id: int, override_file_path: Path | None = None
):
    """执行导入解析的库操作"""
    from app.core.doc_processor import DocProcessorFactory
    from app.crud.document import crud_document
    from app.crud.site import crud_site
    from app.crud.task import crud_task
    from app.models.document import DocumentStatus, VectorStatus
    from app.schemas.document import DocumentCreate
    from app.schemas.system_config import DocProcessorConfig
    from app.services.task_service import TaskService

    task = await crud_task.get(db, id=task_id)
    if not task:
        logger.error(f"❌ [Job:{ctx['job_id']}] 任务 {task_id} 不存在")
        return

    tenant_id = task.tenant_id
    payload = task.payload
    filename = payload.get("filename", "未知文件")

    logger.info(
        f"🚀 [Job:{ctx['job_id']}] [Tenant:{tenant_id}] 开始解析任务 {task_id} | 文件: {filename}"
    )

    try:
        await TaskService.update_progress(db, task_id, 10.0)

        processor_config_dict = payload.get("processor_config")
        processor_config_obj = DocProcessorConfig(**processor_config_dict)
        processor = DocProcessorFactory.create(processor_config_obj)

        # 优先使用传入的覆盖路径（通常是从云端下载的临时文件）
        file_path = override_file_path or Path(payload.get("file_path"))
        logger.info(
            f"⏳ [Job:{ctx['job_id']}] 正在解析内容: {filename} (格式: {processor_config_obj.type})"
        )

        # [✨ 关键补齐]：将前端传递的 OCR 等参数透传给底层处理器
        # 即使前端没传，我们也给个默认 False
        process_kwargs = {
            "ocr_enabled": payload.get("ocr_enabled", False),
            "extract_images": payload.get("extract_images", False),
            "extract_tables": payload.get("extract_tables", False),
        }

        await TaskService.update_progress(db, task_id, 30.0)
        result = await processor.process(file_path, **process_kwargs)
        await TaskService.update_progress(db, task_id, 70.0)

        document_in = DocumentCreate(
            title=payload.get("original_filename", filename).rsplit(".", 1)[0],
            content=result.markdown,
            site_id=payload.get("site_id"),
            tenant_id=payload.get("tenant_id"),
            collection_id=payload.get("collection_id"),
            author=payload.get("author"),
            status=DocumentStatus.DRAFT,
        )

        document = await crud_document.create(db, obj_in=document_in)
        await crud_site.increment_article_count(db, site_id=payload.get("site_id"))
        await crud_document.update_vector_status(
            db, document_id=document.id, status=VectorStatus.NONE
        )

        await TaskService.complete(
            db,
            task_id,
            result={
                "msg": "解析成功，请手动触发开始学习",
                "document_id": document.id,
                "title": document.title,
            },
        )
        logger.info(
            f"✅ [Job:{ctx['job_id']}] 任务 {task_id} 解析完成 | 文档 ID: {document.id} | 状态: 待手动触发向量化"
        )
        return task

    except Exception as e:
        logger.error(f"❌ [Job:{ctx['job_id']}] 任务 {task_id} 解析失败: {e}", exc_info=True)
        await TaskService.fail(db, task_id, str(e))
        raise e


async def process_import_parsing(ctx, task_id: int):
    """文档导入解析后台任务 (支持云端存储下载)"""
    from app.core.infra.rustfs import get_rustfs_service
    from app.core.infra.tenant import temporary_tenant_context
    from app.crud.task import crud_task

    async with AsyncSessionLocal() as db:
        # 1. 预先获取任务以查询存储位置和租户信息
        task = await crud_task.get(db, id=task_id)
        if not task:
            logger.error(f"❌ 任务 {task_id} 不存在，终止处理")
            return

        # [✨ 关键修复]：进入任务所属的租户上下文
        # 确保 RustFS 的有效路径 (_get_effective_path) 与上传时一致
        with temporary_tenant_context(task.tenant_id):
            object_name = task.payload.get("object_name")
            legacy_file_path = task.payload.get("file_path")
            local_tmp_path = None

            try:
                # 2. 如果是云端存储，先下载到本地临时空间供解析器读取
                if object_name:
                    rustfs = get_rustfs_service()
                    data = rustfs.download_file(object_name)
                    if not data:
                        raise Exception(f"无法从存储服务下载文件: {object_name}")

                    # 创建 Worker 本地临时目录
                    tmp_dir = Path("/tmp/catwiki_worker_imports")
                    tmp_dir.mkdir(parents=True, exist_ok=True)
                    local_tmp_path = tmp_dir / f"task_{task_id}_{Path(object_name).name}"

                    with open(local_tmp_path, "wb") as f:
                        f.write(data)
                    logger.info(f"📥 已从云端下载文件至本地处理: {local_tmp_path}")

                # 3. 执行核心业务逻辑
                await _do_import_parsing(db, ctx, task_id, override_file_path=local_tmp_path)

            finally:
                # 4. 无论成功失败，必须清理全部暂存数据
                if local_tmp_path and local_tmp_path.exists():
                    try:
                        local_tmp_path.unlink()
                        logger.debug(f"🗑️ 已清理 Worker 本地临时文件: {local_tmp_path}")
                    except Exception as e:
                        logger.warning(f"⚠️ 清理本地临时文件失败: {e}")

                if legacy_file_path:
                    try:
                        p = Path(legacy_file_path)
                        if p.exists():
                            p.unlink()
                            logger.debug(f"🗑️ 已清理 Backend 遗留本地文件: {p}")
                    except Exception:
                        pass

                if object_name:
                    try:
                        get_rustfs_service().delete_file(object_name)
                        logger.debug(f"🗑️ 已清理云端暂存文件: {object_name}")
                    except Exception as e:
                        logger.warning(f"⚠️ 清理云端暂存文件失败: {e}")


@transactional()
async def _do_vectorize(db: AsyncSession, ctx: dict, task_id: int):
    """执行向量化的库操作 (已在顶层包裹租户上下文)"""
    from app.crud.task import crud_task
    from app.services.document_service import DocumentService
    from app.services.task_service import TaskService

    task = await crud_task.get(db, id=task_id)
    if not task:
        logger.error(f"❌ [Job:{ctx['job_id']}] 任务 {task_id} 不存在")
        return

    doc_id = task.payload.get("document_id")
    logger.info(
        f"🔄 [Job:{ctx['job_id']}] [Tenant:{task.tenant_id}] 开始向量化任务 {task_id} | 文档: {doc_id}"
    )

    try:
        await TaskService.update_progress(db, task_id, 10.0)
        await DocumentService.process_vectorization_task(db, doc_id)
        await TaskService.complete(db, task_id, result={"msg": "向量化完成"})
        logger.info(f"✅ [Job:{ctx['job_id']}] 任务 {task_id} 向量化成功 | 文档 ID: {doc_id}")
    except Exception as e:
        logger.error(f"❌ [Job:{ctx['job_id']}] 任务 {task_id} 向量化失败: {e}", exc_info=True)
        await TaskService.fail(db, task_id, str(e))
        raise e


async def process_vectorize(ctx, task_id: int):
    """文档向量化后台任务 (带租户上下文保护)"""
    from app.core.infra.tenant import temporary_tenant_context
    from app.crud.task import crud_task

    async with AsyncSessionLocal() as db:
        task = await crud_task.get(db, id=task_id)
        if not task:
            return

        with temporary_tenant_context(task.tenant_id):
            await _do_vectorize(db, ctx, task_id)
