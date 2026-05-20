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

import io
import logging
import urllib.parse
import uuid
from datetime import timedelta

from fastapi import Depends, UploadFile

from app.core.common.i18n import _
from app.core.common.pagination import Paginator
from app.core.infra.config import settings
from app.core.infra.rustfs import RustFSService, get_rustfs_service
from app.core.web.exceptions import (
    BadRequestException,
    DatabaseException,
    NotFoundException,
    ServiceUnavailableException,
)
from app.models.user import User

logger = logging.getLogger(__name__)


class FileService:
    def __init__(self, rustfs: RustFSService):
        self.rustfs = rustfs

    def ensure_valid_extension(self, filename: str | None) -> str:
        """验证文件扩展名并返回"""
        if not filename or "." not in filename:
            return ""
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext not in settings.allowed_extensions_set:
            raise BadRequestException(
                detail=f"不支持的文件类型: .{ext}，允许的类型: {settings.UPLOAD_ALLOWED_EXTENSIONS}"
            )
        return ext

    @staticmethod
    def safe_metadata_value(value: str) -> str:
        """确保元数据值只包含 ASCII 字符"""
        try:
            value.encode("ascii")
            return value
        except UnicodeEncodeError:
            return urllib.parse.quote(value)

    async def upload_file(self, file: UploadFile, folder: str, current_user: User) -> dict:
        """上传单个文件"""
        if not self.rustfs.is_available():
            raise ServiceUnavailableException(detail=_("file.storage_unavailable"))

        file_ext = self.ensure_valid_extension(file.filename)
        unique_filename = f"{uuid.uuid4()}.{file_ext}" if file_ext else str(uuid.uuid4())
        object_name = f"{folder.strip('/')}/{unique_filename}"

        content = await file.read()
        file_size = len(content)

        if file_size > settings.UPLOAD_MAX_SIZE:
            raise BadRequestException(
                detail=f"文件大小超过限制（最大 {settings.UPLOAD_MAX_SIZE // 1024 // 1024}MB）"
            )

        success = self.rustfs.upload_file(
            object_name=object_name,
            file_data=io.BytesIO(content),
            file_size=file_size,
            content_type=file.content_type or "application/octet-stream",
            metadata={
                "original_filename": self.safe_metadata_value(file.filename or "unknown"),
                "uploaded_by_id": str(current_user.id),
                "uploaded_by_email": self.safe_metadata_value(current_user.email),
            },
        )

        if not success:
            raise DatabaseException(detail=_("file.upload_failed"))

        url = self.rustfs.get_public_url(object_name, use_presigned=False)

        return {
            "object_name": object_name,
            "original_filename": file.filename,
            "size": file_size,
            "content_type": file.content_type,
            "url": url,
        }

    async def batch_upload_files(
        self, files: list[UploadFile], folder: str, current_user: User
    ) -> dict:
        """批量上传文件"""
        if not self.rustfs.is_available():
            raise ServiceUnavailableException(detail=_("file.storage_unavailable"))

        results = []
        errors = []

        for file in files:
            try:
                # 验证文件扩展名
                try:
                    file_ext = self.ensure_valid_extension(file.filename)
                except BadRequestException as e:
                    errors.append({"filename": file.filename, "error": e.detail})
                    continue

                unique_filename = f"{uuid.uuid4()}.{file_ext}" if file_ext else str(uuid.uuid4())
                object_name = f"{folder.strip('/')}/{unique_filename}"

                # 读取文件内容
                content = await file.read()
                file_size = len(content)

                # 检查文件大小
                if file_size > settings.UPLOAD_MAX_SIZE:
                    errors.append(
                        {
                            "filename": file.filename,
                            "error": f"文件大小超过限制（最大 {settings.UPLOAD_MAX_SIZE // 1024 // 1024}MB）",
                        }
                    )
                    continue

                # 上传到 RustFS
                success = self.rustfs.upload_file(
                    object_name=object_name,
                    file_data=io.BytesIO(content),
                    file_size=file_size,
                    content_type=file.content_type or "application/octet-stream",
                    metadata={
                        "original_filename": self.safe_metadata_value(file.filename or "unknown"),
                        "uploaded_by_id": str(current_user.id),
                        "uploaded_by_email": self.safe_metadata_value(current_user.email),
                    },
                )

                if success:
                    url = self.rustfs.get_public_url(object_name, use_presigned=False)
                    results.append(
                        {
                            "object_name": object_name,
                            "original_filename": file.filename,
                            "size": file_size,
                            "content_type": file.content_type,
                            "url": url,
                        }
                    )
                else:
                    errors.append({"filename": file.filename, "error": "上传失败"})
            except Exception as e:
                errors.append({"filename": file.filename, "error": str(e)})

        return {
            "success_count": len(results),
            "error_count": len(errors),
            "results": results,
            "errors": errors,
        }

    async def download_file(self, object_name: str) -> tuple[bytes, str, str]:
        """下载文件并返回内容、Content-Type 和文件名"""
        if not self.rustfs.is_available():
            raise ServiceUnavailableException(detail=_("file.storage_unavailable"))

        if not self.rustfs.file_exists(object_name):
            raise NotFoundException(detail=_("file.not_found"))

        data = self.rustfs.download_file(object_name)
        if data is None:
            raise DatabaseException(detail=_("file.download_failed"))

        info = self.rustfs.get_file_info(object_name)
        content_type = (
            info.get("content_type", "application/octet-stream")
            if info
            else "application/octet-stream"
        )

        filename = object_name.split("/")[-1]
        if info and info.get("metadata"):
            filename = info["metadata"].get("original_filename", filename)

        return data, content_type, filename

    async def delete_file(self, object_name: str) -> bool:
        """删除文件"""
        if not self.rustfs.is_available():
            raise ServiceUnavailableException(detail=_("file.storage_unavailable"))

        if not self.rustfs.file_exists(object_name):
            raise NotFoundException(detail=_("file.not_found"))

        success = self.rustfs.delete_file(object_name)
        if not success:
            raise DatabaseException(detail=_("file.delete_failed"))
        return True

    async def list_files(
        self,
        prefix: str = "",
        recursive: bool = True,
        page: int = 1,
        size: int = 20,
        is_pager: int = 1,
    ) -> tuple[list[dict], Paginator]:
        """列出文件（带分页）"""
        if not self.rustfs.is_available():
            raise ServiceUnavailableException(detail=_("file.storage_unavailable"))

        all_files = self.rustfs.list_files(prefix=prefix, recursive=recursive)
        total = len(all_files)
        paginator = Paginator(page=page, size=size, total=total, is_pager=is_pager)

        # 手动切片（RustFS 当前不支持原生的 offset/limit）
        if paginator.size is not None:
            paged_files = all_files[paginator.skip : paginator.skip + paginator.size]
        else:
            paged_files = all_files

        serializable_files = []
        for file in paged_files:
            file_data = {
                "object_name": file.get("object_name"),
                "size": file.get("size"),
                "last_modified": file.get("last_modified").isoformat()
                if file.get("last_modified")
                else None,
                "etag": file.get("etag"),
                "content_type": file.get("content_type"),
                "url": self.rustfs.get_public_url(file["object_name"], use_presigned=False),
            }
            serializable_files.append(file_data)

        return serializable_files, paginator

    async def get_file_info(self, object_name: str) -> dict:
        """获取文件信息"""
        if not self.rustfs.is_available():
            raise ServiceUnavailableException(detail=_("file.storage_unavailable"))

        if not self.rustfs.file_exists(object_name):
            raise NotFoundException(detail=_("file.not_found"))

        info = self.rustfs.get_file_info(object_name)
        if info is None:
            raise DatabaseException(detail=_("file.info_failed"))

        url = self.rustfs.get_public_url(object_name, use_presigned=False)

        return {
            "object_name": object_name,
            "size": info.get("size"),
            "content_type": info.get("content_type"),
            "last_modified": info.get("last_modified").isoformat()
            if info.get("last_modified")
            else None,
            "etag": info.get("etag"),
            "metadata": dict(info.get("metadata", {})) if info.get("metadata") else {},
            "url": url,
        }

    async def get_client_file_info(self, object_name: str) -> dict:
        """获取文件信息（面向客户端，排除敏感元数据）"""
        info = await self.get_file_info(object_name)
        # 排除上传者信息等敏感元数据
        if "metadata" in info:
            info["metadata"].pop("uploaded_by_id", None)
            info["metadata"].pop("uploaded_by_email", None)
        return info

    async def get_public_url(self, object_name: str) -> str:
        """获取公开访问 URL"""
        if not self.rustfs.is_available():
            raise ServiceUnavailableException(detail=_("file.storage_unavailable"))
        return self.rustfs.get_public_url(object_name, use_presigned=False)

    async def get_presigned_url(self, object_name: str, expires_hours: int = 1) -> str:
        """获取预签名 URL"""
        if not self.rustfs.is_available():
            raise ServiceUnavailableException(detail=_("file.storage_unavailable"))

        if not self.rustfs.file_exists(object_name):
            raise NotFoundException(detail=_("file.not_found"))

        url = self.rustfs.get_public_url(
            object_name, use_presigned=True, expires=timedelta(hours=expires_hours)
        )

        if url is None:
            raise DatabaseException(detail=_("file.presign_failed"))
        return url


def get_file_service(rustfs: RustFSService = Depends(get_rustfs_service)) -> FileService:
    """获取 FileService 实例的依赖注入函数"""
    return FileService(rustfs)
