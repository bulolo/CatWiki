"""
客户端文件接口
提供文件下载和访问功能（只读）
"""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from app.core.deps import get_rustfs
from app.core.exceptions import (
    DatabaseException,
    NotFoundException,
    ServiceUnavailableException,
)
from app.core.rustfs import RustFSService
from app.schemas import ApiResponse

router = APIRouter()


@router.get("/{object_name:path}:download", operation_id="downloadClientFile")
async def download_file(
    object_name: str,
    rustfs: RustFSService = Depends(get_rustfs),
):
    """
    下载文件（客户端）

    Args:
        object_name: 文件对象名称（路径）
        rustfs: RustFS 服务实例

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

    # 从元数据中获取原始文件名
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


@router.get("/{object_name:path}:info", response_model=ApiResponse[dict], operation_id="getClientFileInfo")
async def get_file_info(
    object_name: str,
    rustfs: RustFSService = Depends(get_rustfs),
) -> ApiResponse[dict]:
    """
    获取文件信息（客户端）

    Args:
        object_name: 文件对象名称（路径）
        rustfs: RustFS 服务实例

    Returns:
        文件基本信息（不包含敏感元数据）
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

    # 只返回基本信息，不包含敏感元数据
    safe_info = {
        "object_name": object_name,
        "size": info.get("size"),
        "content_type": info.get("content_type"),
        "last_modified": info.get("last_modified").isoformat() if info.get("last_modified") else None,
    }

    return ApiResponse.ok(data=safe_info, msg="获取成功")


@router.get("/{object_name:path}:presignedUrl", response_model=ApiResponse[dict], operation_id="getClientPresignedUrl")
async def get_presigned_url(
    object_name: str,
    expires_hours: int = Query(1, ge=1, le=24, description="URL 有效期（小时，最长 24 小时）"),
    rustfs: RustFSService = Depends(get_rustfs),
) -> ApiResponse[dict]:
    """
    获取文件的访问 URL（客户端）

    注意：如果存储桶是公开的，返回直接 URL；否则返回预签名 URL

    Args:
        object_name: 文件对象名称（路径）
        expires_hours: 预签名 URL 有效期（小时，默认 1 小时，最长 24 小时）
        rustfs: RustFS 服务实例

    Returns:
        文件访问 URL
    """
    if not rustfs.is_available():
        raise ServiceUnavailableException(detail="对象存储服务不可用")

    # 检查文件是否存在
    if not rustfs.file_exists(object_name):
        raise NotFoundException(detail="文件不存在")

    # 生成 URL（公开存储桶使用直接 URL）
    url = rustfs.get_public_url(object_name, use_presigned=False)

    if url is None:
        raise DatabaseException(detail="生成 URL 失败")

    return ApiResponse.ok(
        data={
            "object_name": object_name,
            "url": url,
        },
        msg="获取成功"
    )
