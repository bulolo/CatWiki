"""
文件管理接口
提供文件上传、下载、删除等功能
"""
import io
import urllib.parse
import uuid
from datetime import timedelta

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import Response

from app.core.config import settings
from app.core.deps import get_current_active_user, get_rustfs
from app.core.exceptions import (
    BadRequestException,
    DatabaseException,
    NotFoundException,
    ServiceUnavailableException,
)
from app.core.rustfs import RustFSService
from app.models.user import User
from app.schemas import ApiResponse

router = APIRouter()


def validate_file_extension(filename: str | None) -> str:
    """验证文件扩展名并返回"""
    if not filename or "." not in filename:
        return ""
    ext = filename.rsplit(".", 1)[-1].lower()
    if ext not in settings.allowed_extensions_set:
        raise BadRequestException(
            detail=f"不支持的文件类型: .{ext}，允许的类型: {settings.UPLOAD_ALLOWED_EXTENSIONS}"
        )
    return ext


def safe_metadata_value(value: str) -> str:
    """
    确保元数据值只包含 ASCII 字符
    S3 元数据只支持 US-ASCII 编码
    """
    try:
        # 尝试编码为 ASCII，如果失败则 URL 编码
        value.encode('ascii')
        return value
    except UnicodeEncodeError:
        # URL 编码非 ASCII 字符
        return urllib.parse.quote(value)


@router.post(":upload", response_model=ApiResponse[dict], operation_id="uploadAdminFile")
async def upload_file(
    file: UploadFile = File(..., description="要上传的文件"),
    folder: str = Query("uploads", description="存储文件夹"),
    rustfs: RustFSService = Depends(get_rustfs),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[dict]:
    """
    上传文件到 RustFS

    Args:
        file: 上传的文件
        folder: 存储文件夹路径（默认: uploads）
        rustfs: RustFS 服务实例
        current_user: 当前登录用户

    Returns:
        上传成功后的文件信息
    """
    # 检查服务是否可用
    if not rustfs.is_available():
        raise ServiceUnavailableException(detail="对象存储服务不可用")

    # 验证文件扩展名
    file_ext = validate_file_extension(file.filename)

    unique_filename = f"{uuid.uuid4()}.{file_ext}" if file_ext else str(uuid.uuid4())
    object_name = f"{folder.strip('/')}/{unique_filename}"

    # 读取文件内容
    content = await file.read()
    file_size = len(content)

    # 检查文件大小
    if file_size > settings.UPLOAD_MAX_SIZE:
        raise BadRequestException(
            detail=f"文件大小超过限制（最大 {settings.UPLOAD_MAX_SIZE // 1024 // 1024}MB）"
        )

    # 上传到 RustFS
    success = rustfs.upload_file(
        object_name=object_name,
        file_data=io.BytesIO(content),
        file_size=file_size,
        content_type=file.content_type or "application/octet-stream",
        metadata={
            "original_filename": safe_metadata_value(file.filename or "unknown"),
            "uploaded_by_id": str(current_user.id),
            "uploaded_by_email": safe_metadata_value(current_user.email),
        }
    )

    if not success:
        raise DatabaseException(detail="文件上传失败")

    # 获取文件 URL（公开存储桶使用直接 URL，私有存储桶使用预签名 URL）
    url = rustfs.get_public_url(object_name, use_presigned=False)

    return ApiResponse.ok(
        data={
            "object_name": object_name,
            "original_filename": file.filename,
            "size": file_size,
            "content_type": file.content_type,
            "url": url,
        },
        msg="文件上传成功"
    )


@router.post(":batchUpload", response_model=ApiResponse[dict], operation_id="batchUploadAdminFiles")
async def upload_multiple_files(
    files: list[UploadFile] = File(..., description="要上传的多个文件"),
    folder: str = Query("uploads", description="存储文件夹"),
    rustfs: RustFSService = Depends(get_rustfs),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[dict]:
    """
    批量上传文件到 RustFS

    Args:
        files: 上传的多个文件
        folder: 存储文件夹路径
        rustfs: RustFS 服务实例
        current_user: 当前登录用户

    Returns:
        上传结果列表
    """
    # 检查服务是否可用
    if not rustfs.is_available():
        raise ServiceUnavailableException(detail="对象存储服务不可用")

    results = []
    errors = []

    for file in files:
        try:
            # 验证文件扩展名
            try:
                file_ext = validate_file_extension(file.filename)
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
                errors.append({
                    "filename": file.filename,
                    "error": f"文件大小超过限制（最大 {settings.UPLOAD_MAX_SIZE // 1024 // 1024}MB）"
                })
                continue

            # 上传到 RustFS
            success = rustfs.upload_file(
                object_name=object_name,
                file_data=io.BytesIO(content),
                file_size=file_size,
                content_type=file.content_type or "application/octet-stream",
                metadata={
                    "original_filename": safe_metadata_value(file.filename or "unknown"),
                    "uploaded_by_id": str(current_user.id),
                    "uploaded_by_email": safe_metadata_value(current_user.email),
                }
            )

            if success:
                url = rustfs.get_public_url(object_name, use_presigned=False)
                results.append({
                    "object_name": object_name,
                    "original_filename": file.filename,
                    "size": file_size,
                    "content_type": file.content_type,
                    "url": url,
                })
            else:
                errors.append({
                    "filename": file.filename,
                    "error": "上传失败"
                })
        except Exception as e:
            errors.append({
                "filename": file.filename,
                "error": str(e)
            })

    return ApiResponse.ok(
        data={
            "success_count": len(results),
            "error_count": len(errors),
            "results": results,
            "errors": errors,
        },
        msg=f"批量上传完成，成功 {len(results)} 个，失败 {len(errors)} 个"
    )


@router.get("/{object_name:path}:download", operation_id="downloadAdminFile")
async def download_file(
    object_name: str,
    rustfs: RustFSService = Depends(get_rustfs),
    current_user: User = Depends(get_current_active_user),
):
    """
    下载文件

    Args:
        object_name: 文件对象名称（路径）
        rustfs: RustFS 服务实例
        current_user: 当前登录用户

    Returns:
        文件内容
    """
    if not rustfs.is_available():
        raise ServiceUnavailableException(detail="对象存储服务不可用")

    # 检查文件是否存在
    if not rustfs.file_exists(object_name):
        raise NotFoundException(detail="文件不存在")

    # 下载文件
    data = rustfs.download_file(object_name)
    if data is None:
        raise DatabaseException(detail="文件下载失败")

    # 获取文件信息
    info = rustfs.get_file_info(object_name)
    content_type = info.get("content_type", "application/octet-stream") if info else "application/octet-stream"

    # 从元数据中获取原始文件名，如果没有则使用对象名
    filename = object_name.split("/")[-1]
    if info and info.get("metadata"):
        filename = info["metadata"].get("original_filename", filename)

    return Response(
        content=data,
        media_type=content_type,
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.delete("/{object_name:path}", response_model=ApiResponse[None], operation_id="deleteAdminFile")
async def delete_file(
    object_name: str,
    rustfs: RustFSService = Depends(get_rustfs),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[None]:
    """
    删除文件

    Args:
        object_name: 文件对象名称（路径）
        rustfs: RustFS 服务实例
        current_user: 当前登录用户

    Returns:
        删除结果
    """
    if not rustfs.is_available():
        raise ServiceUnavailableException(detail="对象存储服务不可用")

    # 检查文件是否存在
    if not rustfs.file_exists(object_name):
        raise NotFoundException(detail="文件不存在")

    # 删除文件
    success = rustfs.delete_file(object_name)
    if not success:
        raise DatabaseException(detail="文件删除失败")

    return ApiResponse.ok(msg="文件删除成功")


@router.get(":list", response_model=ApiResponse[dict], operation_id="listAdminFiles")
async def list_files(
    prefix: str = Query("", description="文件路径前缀"),
    recursive: bool = Query(True, description="是否递归列出"),
    rustfs: RustFSService = Depends(get_rustfs),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[dict]:
    """
    列出文件

    Args:
        prefix: 文件路径前缀（用于过滤）
        recursive: 是否递归列出子目录
        rustfs: RustFS 服务实例
        current_user: 当前登录用户

    Returns:
        文件列表
    """
    if not rustfs.is_available():
        raise ServiceUnavailableException(detail="对象存储服务不可用")

    files = rustfs.list_files(prefix=prefix, recursive=recursive)

    # 为每个文件添加 URL，并确保可序列化
    serializable_files = []
    for file in files:
        file_data = {
            "object_name": file.get("object_name"),
            "size": file.get("size"),
            "last_modified": file.get("last_modified").isoformat() if file.get("last_modified") else None,
            "etag": file.get("etag"),
            "content_type": file.get("content_type"),
            "url": rustfs.get_public_url(file["object_name"], use_presigned=False)
        }
        serializable_files.append(file_data)

    return ApiResponse.ok(
        data={
            "total": len(serializable_files),
            "files": serializable_files,
        },
        msg="获取成功"
    )


@router.get("/{object_name:path}:info", response_model=ApiResponse[dict], operation_id="getAdminFileInfo")
async def get_file_info(
    object_name: str,
    rustfs: RustFSService = Depends(get_rustfs),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[dict]:
    """
    获取文件信息

    Args:
        object_name: 文件对象名称（路径）
        rustfs: RustFS 服务实例
        current_user: 当前登录用户

    Returns:
        文件详细信息
    """
    if not rustfs.is_available():
        raise ServiceUnavailableException(detail="对象存储服务不可用")

    # 检查文件是否存在
    if not rustfs.file_exists(object_name):
        raise NotFoundException(detail="文件不存在")

    # 获取文件信息
    info = rustfs.get_file_info(object_name)
    if info is None:
        raise DatabaseException(detail="获取文件信息失败")

    # 添加文件 URL
    url = rustfs.get_public_url(object_name, use_presigned=False)

    # 构建可序列化的响应数据
    response_data = {
        "object_name": object_name,
        "size": info.get("size"),
        "content_type": info.get("content_type"),
        "last_modified": info.get("last_modified").isoformat() if info.get("last_modified") else None,
        "etag": info.get("etag"),
        "metadata": dict(info.get("metadata", {})) if info.get("metadata") else {},
        "url": url,
    }

    return ApiResponse.ok(data=response_data, msg="获取成功")


@router.get("/{object_name:path}:presignedUrl", response_model=ApiResponse[dict], operation_id="getAdminPresignedUrl")
async def get_presigned_url(
    object_name: str,
    expires_hours: int = Query(1, ge=1, le=168, description="URL 有效期（小时）"),
    rustfs: RustFSService = Depends(get_rustfs),
    current_user: User = Depends(get_current_active_user),
) -> ApiResponse[dict]:
    """
    获取文件的预签名 URL（用于临时访问私有文件）

    注意：如果存储桶是公开的，可以直接使用 /info 接口返回的 url

    Args:
        object_name: 文件对象名称（路径）
        expires_hours: URL 有效期（小时，默认 1 小时，最长 7 天）
        rustfs: RustFS 服务实例
        current_user: 当前登录用户

    Returns:
        预签名 URL
    """
    if not rustfs.is_available():
        raise ServiceUnavailableException(detail="对象存储服务不可用")

    # 检查文件是否存在
    if not rustfs.file_exists(object_name):
        raise NotFoundException(detail="文件不存在")

    # 生成预签名 URL
    url = rustfs.get_public_url(object_name, use_presigned=True, expires=timedelta(hours=expires_hours))

    if url is None:
        raise DatabaseException(detail="生成预签名 URL 失败")

    return ApiResponse.ok(
        data={
            "object_name": object_name,
            "url": url,
            "expires_hours": expires_hours,
        },
        msg="获取成功"
    )

