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
数据源存储层

封装 minio S3 协议操作，向上提供统一接口供 service 和 worker 复用。
对 internal 类型使用系统 RustFS 凭据；对 s3 类型使用配置中的凭据。
"""

import logging
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from fastapi import UploadFile
from minio import Minio
from minio.error import S3Error

from app.core.infra.config import settings
from app.core.web.exceptions import BadRequestException
from app.models.data_source import DataSource
from app.schemas.data_source import S3FileItem
from app.services.data_source.constants import is_supported_for_import
from app.services.data_source.paths import (
    compute_browse_prefix,
    get_internal_root_prefix,
    is_within_base,
)

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class StorageContext:
    """绑定到具体数据源的存储访问上下文"""

    client: Minio
    bucket: str
    base: str  # 数据源根路径前缀（可能含或不含尾斜杠）


def resolve_context(ds: DataSource) -> StorageContext:
    """根据数据源类型构造 minio 客户端 + bucket + base 前缀"""
    if ds.type == "internal":
        client = Minio(
            endpoint=settings.RUSTFS_ENDPOINT,
            access_key=settings.RUSTFS_ACCESS_KEY,
            secret_key=settings.RUSTFS_SECRET_KEY,
            secure=settings.RUSTFS_USE_SSL,
        )
        return StorageContext(
            client=client,
            bucket=settings.RUSTFS_BUCKET_NAME,
            base=get_internal_root_prefix(ds.config or {}),
        )

    config = ds.config or {}
    client = Minio(
        endpoint=config["endpoint"],
        access_key=config["access_key"],
        secret_key=config["secret_key"],
        secure=config.get("use_ssl", True),
    )
    return StorageContext(
        client=client,
        bucket=config["bucket_name"],
        base=config.get("root_prefix", ""),
    )


def list_objects(ds: DataSource, prefix: str = "") -> list[S3FileItem]:
    """列出数据源指定路径下的文件和目录（非递归，只展示支持导入的格式）"""
    ctx = resolve_context(ds)
    query_prefix = compute_browse_prefix(ctx.base, prefix)

    try:
        raw = ctx.client.list_objects(ctx.bucket, prefix=query_prefix, recursive=False)
    except S3Error as e:
        raise BadRequestException(detail=f"浏览失败: {e}")

    items: list[S3FileItem] = []
    prefix_stripped = query_prefix.rstrip("/") + "/" if query_prefix else ""

    for o in raw:
        object_name: str = o.object_name
        last_modified = o.last_modified.isoformat() if o.last_modified else None

        # minio 用尾斜杠表示目录
        if object_name.endswith("/"):
            dir_name = object_name[len(prefix_stripped) :].rstrip("/")
            if not dir_name:
                continue
            items.append(
                S3FileItem(
                    name=dir_name,
                    path=object_name,
                    type="dir",
                    size=None,
                    last_modified=None,
                )
            )
            continue

        rel = object_name[len(prefix_stripped) :]
        if not is_supported_for_import(rel):
            continue
        items.append(
            S3FileItem(
                name=rel,
                path=object_name,
                type="file",
                size=o.size,
                last_modified=last_modified,
            )
        )

    # 目录在前，文件在后，组内按名称排序
    items.sort(key=lambda x: (x.type == "file", x.name))
    return items


async def upload_object(ds: DataSource, file: UploadFile, prefix: str = "") -> dict:
    """上传文件到数据源指定路径，返回 {key, name, size}"""
    ctx = resolve_context(ds)

    safe_filename = Path(file.filename or "").name
    if not safe_filename:
        raise BadRequestException(detail="无效的文件名")

    dir_prefix = compute_browse_prefix(ctx.base, prefix)
    target_key = (dir_prefix.rstrip("/") + "/" + safe_filename).lstrip("/")

    if not is_within_base(target_key, ctx.base):
        raise BadRequestException(detail="不允许上传到该路径")

    contents = await file.read()
    try:
        ctx.client.put_object(
            bucket_name=ctx.bucket,
            object_name=target_key,
            data=BytesIO(contents),
            length=len(contents),
            content_type=file.content_type or "application/octet-stream",
        )
    except S3Error as e:
        logger.error(f"❌ [DataSource] 上传失败 ds={ds.id} key={target_key}: {e}")
        raise BadRequestException(detail=f"上传文件失败: {e}")

    logger.info(f"📤 [DataSource] 已上传 ds={ds.id} key={target_key} size={len(contents)}")
    return {"key": target_key, "name": safe_filename, "size": len(contents)}


def delete_object(ds: DataSource, key: str) -> None:
    """删除数据源中指定 key 的文件"""
    if not key:
        raise BadRequestException(detail="缺少文件路径")

    ctx = resolve_context(ds)
    if not is_within_base(key, ctx.base):
        raise BadRequestException(detail="不允许删除该路径下的文件")

    try:
        ctx.client.remove_object(bucket_name=ctx.bucket, object_name=key)
    except S3Error as e:
        logger.error(f"❌ [DataSource] 删除失败 ds={ds.id} key={key}: {e}")
        raise BadRequestException(detail=f"删除文件失败: {e}")

    logger.info(f"🗑️ [DataSource] 已删除 ds={ds.id} key={key}")


def download_object(ds: DataSource, key: str) -> bytes | None:
    """从数据源下载文件，失败返回 None（供 worker 复用，不抛异常）"""
    ctx = resolve_context(ds)
    try:
        response = ctx.client.get_object(ctx.bucket, key)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()
    except S3Error as e:
        logger.error(f"❌ [DataSource] 下载失败 ds={ds.id} key={key}: {e}")
        return None
