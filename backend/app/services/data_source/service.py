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
数据源服务层（业务编排）

职责：
- 数据源记录的 CRUD + 多租户校验
- 浏览/上传/删除文件（委托给 storage 层）
- 把数据源中的文件入队为导入任务（与文档/任务模块协作）
"""

import logging
from pathlib import Path

from fastapi import Depends, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.infra.config import settings
from app.core.infra.tenant import get_current_tenant
from app.core.web.exceptions import BadRequestException, NotFoundException
from app.crud.data_source import crud_data_source
from app.db.database import get_db
from app.db.transaction import transactional
from app.models.data_source import DataSource
from app.schemas.data_source import (
    DataSourceCreate,
    DataSourceImportRequest,
    DataSourceUpdate,
    S3FileItem,
    UploadedFile,
)
from app.services.data_source import storage
from app.services.data_source.constants import is_supported_for_import
from app.services.data_source.paths import get_internal_root_prefix

logger = logging.getLogger(__name__)

_REQUIRED_S3_CONFIG_KEYS = {"endpoint", "bucket_name", "access_key", "secret_key"}
_MASKED_SECRET = "****"


def _active_tenant(tenant_id: int | None) -> int | None:
    """取当前上下文租户 ID，回退到调用方传入的 tenant_id"""
    return get_current_tenant() or tenant_id


def _mask_secret(config: dict | None) -> dict:
    """隐藏 secret_key，用于响应返回"""
    if not config or "secret_key" not in config:
        return config or {}
    return {**config, "secret_key": _MASKED_SECRET}


def _serialize(ds: DataSource) -> dict:
    """统一序列化数据源记录，对 internal 注入运行时配置，对 s3 屏蔽密钥"""
    d = ds.to_dict()
    if ds.type == "internal":
        d["config"] = {
            "endpoint": settings.RUSTFS_ENDPOINT,
            "bucket_name": settings.RUSTFS_BUCKET_NAME,
            # 展示实际浏览路径（EE 下含租户前缀），user_root_prefix 保留原始设置供编辑
            "root_prefix": get_internal_root_prefix(ds.config or {}),
            "user_root_prefix": (ds.config or {}).get("root_prefix", ""),
        }
    else:
        d["config"] = _mask_secret(ds.config)
    return d


class DataSourceService:
    """数据源业务编排"""

    def __init__(self, db: AsyncSession):
        self.db = db

    # ---------- CRUD ----------

    async def list_data_sources(self, tenant_id: int | None) -> list[dict]:
        effective = _active_tenant(tenant_id)
        sources = await crud_data_source.list_by_tenant(self.db, tenant_id=effective)
        return [_serialize(s) for s in sources]

    @transactional()
    async def create_data_source(self, data_in: DataSourceCreate, tenant_id: int | None) -> dict:
        if data_in.type == "s3":
            missing = _REQUIRED_S3_CONFIG_KEYS - set(data_in.config.keys())
            if missing:
                raise BadRequestException(
                    detail=f"外部 S3 缺少必填配置: {', '.join(sorted(missing))}"
                )

        obj = await crud_data_source.create(
            self.db,
            obj_in={
                "name": data_in.name,
                "type": data_in.type,
                "description": data_in.description,
                "config": data_in.config,
                "tenant_id": _active_tenant(tenant_id),
            },
        )
        return _serialize(obj)

    @transactional()
    async def update_data_source(
        self, ds_id: int, data_in: DataSourceUpdate, tenant_id: int | None
    ) -> dict:
        obj = await self._get_owned(ds_id, _active_tenant(tenant_id))
        update_data = data_in.model_dump(exclude_unset=True)

        # 只更新部分 config 字段时合并而非替换；同时保留真实 secret_key
        if update_data.get("config") is not None:
            existing = obj.config or {}
            incoming = update_data["config"]
            if incoming.get("secret_key") == _MASKED_SECRET:
                incoming["secret_key"] = existing.get("secret_key", "")
            update_data["config"] = {**existing, **incoming}

        obj = await crud_data_source.update(self.db, db_obj=obj, obj_in=update_data)
        return _serialize(obj)

    @transactional()
    async def delete_data_source(self, ds_id: int, tenant_id: int | None) -> None:
        await self._get_owned(ds_id, _active_tenant(tenant_id))
        await crud_data_source.delete(self.db, id=ds_id)

    # ---------- 文件操作 ----------

    async def browse(self, ds_id: int, tenant_id: int | None, prefix: str = "") -> list[S3FileItem]:
        ds = await self._get_owned(ds_id, _active_tenant(tenant_id))
        return storage.list_objects(ds, prefix)

    async def upload_file(
        self,
        ds_id: int,
        tenant_id: int | None,
        file: UploadFile,
        prefix: str = "",
    ) -> UploadedFile:
        ds = await self._get_owned(ds_id, _active_tenant(tenant_id))
        result = await storage.upload_object(ds, file, prefix)
        return UploadedFile(**result)

    async def delete_file(self, ds_id: int, tenant_id: int | None, key: str) -> None:
        ds = await self._get_owned(ds_id, _active_tenant(tenant_id))
        storage.delete_object(ds, key)

    # ---------- 导入到知识库 ----------

    async def import_files(
        self,
        ds_id: int,
        tenant_id: int | None,
        req: DataSourceImportRequest,
        current_username: str,
    ) -> list[dict]:
        """把数据源中选中的文件入队为解析任务，返回 task dict 列表"""
        from app.crud.document import crud_document
        from app.models.task import TaskType
        from app.services.task_service import TaskService

        active_tenant_id = _active_tenant(tenant_id)
        await self._get_owned(ds_id, active_tenant_id)

        processor_config = await self._resolve_processor_config(
            active_tenant_id, req.processor_type
        )

        tasks: list[dict] = []
        for key in req.keys:
            filename = Path(key).name
            if not is_supported_for_import(filename):
                logger.warning(f"[DataSource] 跳过不支持的格式: {key}")
                continue

            stem = Path(filename).stem
            if req.duplicate_strategy == "skip":
                existing = await crud_document.get_by_title_collection(
                    self.db,
                    title=stem,
                    collection_id=req.collection_id,
                    tenant_id=active_tenant_id,
                )
                if existing:
                    logger.info(f"[DataSource] 跳过重复文档: {stem}")
                    continue

            task = await TaskService.enqueue_task(
                db=self.db,
                task_type=TaskType.IMPORT_PARSING,
                payload={
                    "data_source_id": ds_id,
                    "object_name": key,
                    "filename": filename,
                    "original_filename": filename,
                    "site_id": req.site_id,
                    "collection_id": req.collection_id,
                    "tenant_id": active_tenant_id,
                    "author": current_username,
                    "processor_config": processor_config,
                    "ocr_enabled": req.ocr_enabled,
                    "extract_images": req.extract_images,
                    "extract_tables": req.extract_tables,
                    "generate_summary": req.generate_summary,
                    "generate_tags": req.generate_tags,
                    "auto_vectorize": req.auto_vectorize,
                    # 数据源中的原始文件不删除
                    "delete_after_processing": False,
                },
                tenant_id=active_tenant_id,
                site_id=req.site_id,
                created_by=current_username,
            )
            tasks.append(task.to_dict() if hasattr(task, "to_dict") else {"id": task.id})

        return tasks

    # ---------- 内部工具 ----------

    async def _resolve_processor_config(self, tenant_id: int | None, processor_type: str) -> dict:
        from app.services.system_config import SystemConfigService

        config_svc = SystemConfigService(self.db)
        config_list = await config_svc.get_doc_processor_config(
            tenant_id, scope="tenant", mask=False
        )
        target = next(
            (p for p in config_list.get("processors", []) if p["type"] == processor_type),
            None,
        )
        if not target:
            raise BadRequestException(detail=f"解析器配置不存在: {processor_type}")
        return target

    async def _get_owned(self, ds_id: int, tenant_id: int | None) -> DataSource:
        obj = await crud_data_source.get(self.db, id=ds_id)
        if not obj or obj.tenant_id != tenant_id:
            raise NotFoundException(detail=f"数据源 {ds_id} 不存在")
        return obj


def get_data_source_service(db: AsyncSession = Depends(get_db)) -> DataSourceService:
    return DataSourceService(db)
