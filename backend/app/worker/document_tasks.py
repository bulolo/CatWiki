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


async def _get_tenant_slug(db: AsyncSession, tenant_id: int | None) -> str | None:
    """查询租户 slug，用于存储路径隔离上下文"""
    if not tenant_id:
        return None
    try:
        from app.crud.tenant import crud_tenant

        tenant = await crud_tenant.get(db, id=tenant_id)
        return tenant.slug if tenant else None
    except Exception:
        return None


async def _download_file_for_task(payload: dict, object_name: str) -> bytes | None:
    """根据任务 payload 下载文件：优先走数据源配置，回退到系统 RustFS"""
    data_source_id = payload.get("data_source_id")

    if data_source_id:
        from app.crud.data_source import crud_data_source
        from app.services.data_source import storage

        try:
            async with AsyncSessionLocal() as db:
                ds = await crud_data_source.get(db, id=data_source_id)
        except Exception as e:
            logger.error(f"❌ 获取数据源配置失败: {e}")
            return None

        if ds:
            return storage.download_object(ds, object_name)

    # 默认：从系统内置 RustFS 下载
    from app.core.infra.rustfs import get_rustfs_service

    return get_rustfs_service().download_file(object_name)


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

        # 优先使用传入的覆盖路径（通常是从云端下载的临时文件）
        file_path = override_file_path or Path(payload.get("file_path"))

        process_kwargs = {
            "ocr_enabled": payload.get("ocr_enabled", False),
            "extract_images": payload.get("extract_images", False),
            "extract_tables": payload.get("extract_tables", True),
        }

        # 纯文本文件（.md/.markdown/.mdx/.txt）原文即可入库，跳过外部解析器
        from app.services.data_source.constants import is_native_text

        if is_native_text(file_path.name):
            logger.info(f"⏳ [Job:{ctx['job_id']}] 纯文本直接导入: {filename} ({file_path.suffix})")
            await TaskService.update_progress(db, task_id, 50.0)
            markdown_content = file_path.read_text(encoding="utf-8")
            processor_type = "native"
            processor_name = f"text-passthrough({file_path.suffix.lstrip('.')})"
        else:
            processor_config_dict = payload.get("processor_config")
            processor_config_obj = DocProcessorConfig(**processor_config_dict)
            processor = DocProcessorFactory.create(processor_config_obj)
            logger.info(
                f"⏳ [Job:{ctx['job_id']}] 正在解析内容: {filename} "
                f"(格式: {processor_config_obj.type})"
            )
            await TaskService.update_progress(db, task_id, 30.0)
            result = await processor.process(file_path, **process_kwargs)
            markdown_content = result.markdown
            processor_type = processor_config_obj.type
            processor_name = processor_config_obj.name

        await TaskService.update_progress(db, task_id, 70.0)

        parse_meta = {
            "processor_type": processor_type,
            "processor_name": processor_name,
            "original_filename": payload.get("original_filename", filename),
            "s3_object_name": payload.get("object_name"),  # 云端暂存路径（任务完成后已删除）
            "worker_local_path": str(file_path),  # Worker 本地临时路径（任务完成后已删除）
            "ocr_enabled": process_kwargs["ocr_enabled"],
            "extract_images": process_kwargs["extract_images"],
            "extract_tables": process_kwargs["extract_tables"],
        }

        document_in = DocumentCreate(
            title=payload.get("original_filename", filename).rsplit(".", 1)[0],
            content=markdown_content,
            site_id=payload.get("site_id"),
            tenant_id=payload.get("tenant_id"),
            collection_id=payload.get("collection_id"),
            author=payload.get("author"),
            status=DocumentStatus.DRAFT,
            parse_meta=parse_meta,
        )

        document = await crud_document.create(db, obj_in=document_in)
        await crud_site.increment_article_count(db, site_id=payload.get("site_id"))

        # 若开启自动向量化：状态设为 PENDING，向量化 worker 才会处理
        # 否则保持 NONE，等用户手动触发
        auto_vectorize = payload.get("auto_vectorize", False)
        await crud_document.update_vector_status(
            db,
            document_id=document.id,
            status=VectorStatus.PENDING if auto_vectorize else VectorStatus.NONE,
        )

        # AI 自动生成摘要 / 标签（可选，失败不影响导入结果）
        generate_summary = payload.get("generate_summary", False)
        generate_tags = payload.get("generate_tags", False)
        if (generate_summary or generate_tags) and document.content:
            try:
                from app.services.document_service import DocumentService
                from app.services.site_service import SiteService
                from app.services.system_config_service import SystemConfigService

                fields = []
                if generate_summary:
                    fields.append("summary")
                if generate_tags:
                    fields.append("tags")

                doc_svc = DocumentService(db, SiteService(db), SystemConfigService(db))
                ai_result = await doc_svc.ai_generate_fields(
                    content=document.content[:6000], fields=fields
                )
                update_data: dict = {}
                if generate_summary and ai_result.get("summary"):
                    update_data["summary"] = ai_result["summary"]
                if generate_tags and ai_result.get("tags"):
                    update_data["tags"] = ai_result["tags"]
                if update_data:
                    await crud_document.update(db, db_obj=document, obj_in=update_data)
                    logger.info(
                        f"✨ [Job:{ctx['job_id']}] AI 生成完成 | 文档 ID: {document.id} | 字段: {list(update_data.keys())}"
                    )
            except Exception as e:
                logger.warning(f"⚠️ [Job:{ctx['job_id']}] AI 生成失败（不影响导入）: {e}")

        # 自动向量化：解析成功后链一个 VECTORIZE 任务（vector_status 上面已置为 PENDING）
        vectorize_task_id: int | None = None
        if auto_vectorize:
            from app.models.task import TaskType

            vec_task = await TaskService.enqueue_task(
                db=db,
                task_type=TaskType.VECTORIZE,
                payload={"document_id": document.id},
                tenant_id=payload.get("tenant_id"),
                site_id=payload.get("site_id"),
                created_by=payload.get("author") or "system",
            )
            vectorize_task_id = vec_task.id
            logger.info(
                f"🧠 [Job:{ctx['job_id']}] 已链接向量化任务 | 文档 ID: {document.id} | "
                f"VectorizeTask: {vectorize_task_id}"
            )

        await TaskService.complete(
            db,
            task_id,
            result={
                "msg": "解析成功，已自动触发向量化"
                if auto_vectorize
                else "解析成功，请手动触发开始学习",
                "document_id": document.id,
                "title": document.title,
                "vectorize_task_id": vectorize_task_id,
            },
        )
        logger.info(
            f"✅ [Job:{ctx['job_id']}] 任务 {task_id} 解析完成 | 文档 ID: {document.id} | "
            f"{'自动向量化已入队' if auto_vectorize else '待手动触发向量化'}"
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
        tenant_slug = await _get_tenant_slug(db, task.tenant_id)

        # 把 finally 需要的字段提前拷出来，避免事务回滚后再访问 ORM 属性
        # 触发懒加载（异步会话回滚后会进入坏的 greenlet 上下文）
        payload = dict(task.payload or {})
        object_name = payload.get("object_name")
        legacy_file_path = payload.get("file_path")
        delete_after = payload.get("delete_after_processing", True)

        with temporary_tenant_context(task.tenant_id, slug=tenant_slug):
            local_tmp_path = None
            try:
                # 2. 下载文件到本地临时路径
                if object_name:
                    data = await _download_file_for_task(payload, object_name)
                    if not data:
                        raise Exception(f"无法下载文件: {object_name}")

                    tmp_dir = Path("/tmp/catwiki_worker_imports")
                    tmp_dir.mkdir(parents=True, exist_ok=True)
                    local_tmp_path = tmp_dir / f"task_{task_id}_{Path(object_name).name}"

                    with open(local_tmp_path, "wb") as f:
                        f.write(data)
                    logger.info(f"📥 已下载文件至本地: {local_tmp_path}")

                # 3. 执行核心业务逻辑
                await _do_import_parsing(db, ctx, task_id, override_file_path=local_tmp_path)

            finally:
                # 4. 清理本地临时文件（始终执行）
                if local_tmp_path and local_tmp_path.exists():
                    try:
                        local_tmp_path.unlink()
                        logger.debug(f"🗑️ 已清理本地临时文件: {local_tmp_path}")
                    except Exception as e:
                        logger.warning(f"⚠️ 清理本地临时文件失败: {e}")

                if legacy_file_path:
                    try:
                        p = Path(legacy_file_path)
                        if p.exists():
                            p.unlink()
                    except Exception:
                        pass

                # 只删除临时暂存文件，来自数据源的原始文件不删除
                if delete_after and object_name:
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

        tenant_slug = await _get_tenant_slug(db, task.tenant_id)
        with temporary_tenant_context(task.tenant_id, slug=tenant_slug):
            await _do_vectorize(db, ctx, task_id)
