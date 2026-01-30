"""
RustFS 对象存储服务
提供 S3 兼容的对象存储功能
"""
import logging
from datetime import timedelta
from typing import BinaryIO

try:
    from minio import Minio
    from minio.commonconfig import CopySource
    from minio.error import S3Error
except ImportError:
    Minio = None
    S3Error = None
    CopySource = None

from app.core.config import settings

logger = logging.getLogger(__name__)


class RustFSService:
    """RustFS 对象存储服务"""

    def __init__(self):
        """初始化 RustFS 客户端"""
        if Minio is None:
            logger.warning("minio 包未安装，RustFS 服务不可用")
            self.client = None
            self.bucket_name = None
            self.public_url = None
            return

        try:
            self.client = Minio(
                endpoint=settings.RUSTFS_ENDPOINT,
                access_key=settings.RUSTFS_ACCESS_KEY,
                secret_key=settings.RUSTFS_SECRET_KEY,
                secure=settings.RUSTFS_USE_SSL,
            )
            self.bucket_name = settings.RUSTFS_BUCKET_NAME
            self.public_url = settings.RUSTFS_PUBLIC_URL
            logger.info(f"RustFS 客户端初始化成功: {settings.RUSTFS_ENDPOINT}")
            logger.info(f"RustFS 公共访问地址: {self.public_url}")
        except Exception as e:
            logger.error(f"RustFS 客户端初始化失败: {e}")
            self.client = None
            self.bucket_name = None
            self.public_url = None

    def is_available(self) -> bool:
        """检查 RustFS 服务是否可用"""
        return self.client is not None and self.bucket_name is not None

    def ensure_bucket_exists(self) -> bool:
        """确保存储桶存在，如果不存在则创建"""
        if not self.is_available():
            logger.warning("RustFS 服务不可用")
            return False

        try:
            if not self.client.bucket_exists(self.bucket_name):
                self.client.make_bucket(self.bucket_name)
                logger.info(f"创建存储桶: {self.bucket_name}")
            return True
        except S3Error as e:
            logger.error(f"检查/创建存储桶失败: {e}")
            return False

    def upload_file(
        self,
        object_name: str,
        file_data: BinaryIO,
        file_size: int,
        content_type: str = "application/octet-stream",
        metadata: dict | None = None,
    ) -> bool:
        """
        上传文件到 RustFS

        Args:
            object_name: 对象名称（路径）
            file_data: 文件数据流
            file_size: 文件大小（字节）
            content_type: 文件类型
            metadata: 文件元数据

        Returns:
            是否上传成功
        """
        if not self.is_available():
            logger.warning("RustFS 服务不可用")
            return False

        try:
            self.client.put_object(
                bucket_name=self.bucket_name,
                object_name=object_name,
                data=file_data,
                length=file_size,
                content_type=content_type,
                metadata=metadata,
            )
            logger.info(f"文件上传成功: {object_name}")
            return True
        except S3Error as e:
            logger.error(f"文件上传失败: {e}")
            return False

    def download_file(self, object_name: str) -> bytes | None:
        """
        从 RustFS 下载文件

        Args:
            object_name: 对象名称（路径）

        Returns:
            文件数据，如果失败返回 None
        """
        if not self.is_available():
            logger.warning("RustFS 服务不可用")
            return None

        try:
            response = self.client.get_object(self.bucket_name, object_name)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as e:
            logger.error(f"文件下载失败: {e}")
            return None

    def delete_file(self, object_name: str) -> bool:
        """
        从 RustFS 删除文件

        Args:
            object_name: 对象名称（路径）

        Returns:
            是否删除成功
        """
        if not self.is_available():
            logger.warning("RustFS 服务不可用")
            return False

        try:
            self.client.remove_object(self.bucket_name, object_name)
            logger.info(f"文件删除成功: {object_name}")
            return True
        except S3Error as e:
            logger.error(f"文件删除失败: {e}")
            return False

    def file_exists(self, object_name: str) -> bool:
        """
        检查文件是否存在

        Args:
            object_name: 对象名称（路径）

        Returns:
            文件是否存在
        """
        if not self.is_available():
            return False

        try:
            self.client.stat_object(self.bucket_name, object_name)
            return True
        except S3Error:
            return False

    def get_file_info(self, object_name: str) -> dict | None:
        """
        获取文件信息

        Args:
            object_name: 对象名称（路径）

        Returns:
            文件信息字典，包含 size, content_type, last_modified 等
        """
        if not self.is_available():
            return None

        try:
            stat = self.client.stat_object(self.bucket_name, object_name)
            return {
                "size": stat.size,
                "content_type": stat.content_type,
                "last_modified": stat.last_modified,
                "etag": stat.etag,
                "metadata": stat.metadata,
            }
        except S3Error as e:
            logger.error(f"获取文件信息失败: {e}")
            return None

    def list_files(self, prefix: str = "", recursive: bool = True) -> list[dict]:
        """
        列出文件

        Args:
            prefix: 对象名称前缀（路径）
            recursive: 是否递归列出子目录

        Returns:
            文件列表
        """
        if not self.is_available():
            return []

        try:
            objects = self.client.list_objects(
                self.bucket_name,
                prefix=prefix,
                recursive=recursive,
            )

            files = []
            for obj in objects:
                files.append({
                    "object_name": obj.object_name,
                    "size": obj.size,
                    "last_modified": obj.last_modified,
                    "etag": obj.etag,
                    "content_type": obj.content_type,
                })

            return files
        except S3Error as e:
            logger.error(f"列出文件失败: {e}")
            return []

    def get_presigned_url(
        self,
        object_name: str,
        expires: timedelta = timedelta(hours=1),
    ) -> str | None:
        """
        获取预签名 URL（用于临时访问）

        Args:
            object_name: 对象名称（路径）
            expires: 过期时间

        Returns:
            预签名 URL（使用公共访问地址）
        """
        if not self.is_available():
            return None

        try:
            url = self.client.presigned_get_object(
                self.bucket_name,
                object_name,
                expires=expires,
            )

            # 如果配置了公共访问地址，替换内部 endpoint
            if self.public_url:
                # 提取 URL 的路径和查询参数部分
                # 例如：http://rustfs:9000/bucket/file.jpg?X-Amz-...
                # 替换为：http://files.yourdomain.com/bucket/file.jpg?X-Amz-...
                import urllib.parse
                parsed = urllib.parse.urlparse(url)

                # 构建新的 URL，使用公共地址
                public_parsed = urllib.parse.urlparse(self.public_url)
                new_url = urllib.parse.urlunparse((
                    public_parsed.scheme,
                    public_parsed.netloc,
                    parsed.path,
                    parsed.params,
                    parsed.query,
                    parsed.fragment
                ))
                return new_url

            return url
        except S3Error as e:
            logger.error(f"获取预签名 URL 失败: {e}")
            return None

    def get_public_url(self, object_name: str, use_presigned: bool = False, expires: timedelta = timedelta(hours=1)) -> str | None:
        """
        获取文件的访问 URL

        Args:
            object_name: 对象名称（路径）
            use_presigned: 是否使用预签名 URL（默认 False，使用直接公共 URL）
            expires: 预签名 URL 过期时间（仅当 use_presigned=True 时有效）

        Returns:
            文件访问 URL
        """
        if not self.is_available():
            return None

        # 如果需要预签名 URL
        if use_presigned:
            return self.get_presigned_url(object_name, expires)

        # 返回直接公共 URL（用于公开存储桶）
        if self.public_url:
            # 使用公共地址构建 URL
            return f"{self.public_url.rstrip('/')}/{self.bucket_name}/{object_name}"
        else:
            # 回退到内部地址
            protocol = "https" if settings.RUSTFS_USE_SSL else "http"
            return f"{protocol}://{settings.RUSTFS_ENDPOINT}/{self.bucket_name}/{object_name}"

    def copy_file(self, source_name: str, dest_name: str) -> bool:
        """
        复制文件

        Args:
            source_name: 源对象名称
            dest_name: 目标对象名称

        Returns:
            是否复制成功
        """
        if not self.is_available():
            return False

        try:
            self.client.copy_object(
                self.bucket_name,
                dest_name,
                CopySource(self.bucket_name, source_name),
            )
            logger.info(f"文件复制成功: {source_name} -> {dest_name}")
            return True
        except S3Error as e:
            logger.error(f"文件复制失败: {e}")
            return False


# 全局 RustFS 服务实例
rustfs_service: RustFSService | None = None


def get_rustfs_service() -> RustFSService:
    """获取 RustFS 服务实例"""
    global rustfs_service
    if rustfs_service is None:
        rustfs_service = RustFSService()
    return rustfs_service


def init_rustfs() -> bool:
    """初始化 RustFS 服务"""
    service = get_rustfs_service()
    if service.is_available():
        success = service.ensure_bucket_exists()
        if success:
            logger.info("RustFS 服务初始化成功")
        return success
    else:
        logger.warning("RustFS 服务初始化跳过（服务不可用）")
        return False

