# RustFS 使用指南

## 概述

RustFS 是一个 S3 兼容的对象存储服务。本项目集成了 RustFS，提供文件上传、下载、删除等功能。

## 配置

在 `.env` 文件中配置 RustFS 相关参数：

```bash
# RustFS 对象存储配置
RUSTFS_ENDPOINT=localhost:9000
RUSTFS_ACCESS_KEY=rustfsadmin
RUSTFS_SECRET_KEY=rustfsadmin
RUSTFS_BUCKET_NAME=catwiki
RUSTFS_USE_SSL=false
```

## 在代码中使用

### 方式 1: 直接导入服务实例

```python
from app.core.rustfs import get_rustfs_service

# 获取服务实例
rustfs = get_rustfs_service()

# 检查服务是否可用
if rustfs.is_available():
    # 上传文件
    with open("example.txt", "rb") as f:
        rustfs.upload_file(
            object_name="files/example.txt",
            file_data=f,
            file_size=os.path.getsize("example.txt"),
            content_type="text/plain"
        )
```

### 方式 2: 使用依赖注入（推荐）

```python
from fastapi import APIRouter, Depends
from app.core.deps import get_rustfs
from app.core.rustfs import RustFSService

router = APIRouter()

@router.post("/upload")
async def upload_file(
    file: UploadFile,
    rustfs: RustFSService = Depends(get_rustfs),
):
    """上传文件到 RustFS"""
    if not rustfs.is_available():
        raise HTTPException(status_code=503, detail="对象存储服务不可用")
    
    # 读取文件内容
    content = await file.read()
    file_size = len(content)
    
    # 上传到 RustFS
    success = rustfs.upload_file(
        object_name=f"uploads/{file.filename}",
        file_data=io.BytesIO(content),
        file_size=file_size,
        content_type=file.content_type or "application/octet-stream",
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="文件上传失败")
    
    return {"message": "文件上传成功", "filename": file.filename}
```

## API 方法

### upload_file()
上传文件到 RustFS

```python
rustfs.upload_file(
    object_name="path/to/file.txt",  # 对象名称（路径）
    file_data=file_stream,           # 文件数据流
    file_size=1024,                  # 文件大小（字节）
    content_type="text/plain",       # 文件类型
    metadata={"key": "value"}        # 可选的元数据
)
```

### download_file()
从 RustFS 下载文件

```python
data = rustfs.download_file("path/to/file.txt")
if data:
    with open("local_file.txt", "wb") as f:
        f.write(data)
```

### delete_file()
删除文件

```python
success = rustfs.delete_file("path/to/file.txt")
```

### file_exists()
检查文件是否存在

```python
exists = rustfs.file_exists("path/to/file.txt")
```

### get_file_info()
获取文件信息

```python
info = rustfs.get_file_info("path/to/file.txt")
# 返回: {"size": 1024, "content_type": "text/plain", "last_modified": ..., ...}
```

### list_files()
列出文件

```python
files = rustfs.list_files(prefix="uploads/", recursive=True)
for file in files:
    print(f"{file['object_name']} - {file['size']} bytes")
```

### get_presigned_url()
获取预签名 URL（用于临时访问）

```python
from datetime import timedelta

url = rustfs.get_presigned_url(
    object_name="path/to/file.txt",
    expires=timedelta(hours=1)  # 1小时后过期
)
```

### copy_file()
复制文件

```python
success = rustfs.copy_file(
    source_name="path/to/source.txt",
    dest_name="path/to/destination.txt"
)
```

## 完整示例：文件上传接口

```python
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from app.core.deps import get_rustfs
from app.core.rustfs import RustFSService
import io
import uuid

router = APIRouter()

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    rustfs: RustFSService = Depends(get_rustfs),
):
    """上传文件到 RustFS"""
    # 检查服务是否可用
    if not rustfs.is_available():
        raise HTTPException(
            status_code=503,
            detail="对象存储服务不可用"
        )
    
    # 生成唯一文件名
    file_ext = file.filename.split(".")[-1] if "." in file.filename else ""
    unique_filename = f"{uuid.uuid4()}.{file_ext}" if file_ext else str(uuid.uuid4())
    object_name = f"uploads/{unique_filename}"
    
    # 读取文件内容
    content = await file.read()
    file_size = len(content)
    
    # 上传到 RustFS
    success = rustfs.upload_file(
        object_name=object_name,
        file_data=io.BytesIO(content),
        file_size=file_size,
        content_type=file.content_type or "application/octet-stream",
        metadata={
            "original_filename": file.filename,
        }
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="文件上传失败")
    
    # 获取预签名 URL
    from datetime import timedelta
    url = rustfs.get_presigned_url(object_name, expires=timedelta(days=7))
    
    return {
        "message": "文件上传成功",
        "object_name": object_name,
        "original_filename": file.filename,
        "size": file_size,
        "url": url,
    }

@router.get("/download/{object_name:path}")
async def download_file(
    object_name: str,
    rustfs: RustFSService = Depends(get_rustfs),
):
    """下载文件"""
    if not rustfs.is_available():
        raise HTTPException(status_code=503, detail="对象存储服务不可用")
    
    # 检查文件是否存在
    if not rustfs.file_exists(object_name):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 下载文件
    data = rustfs.download_file(object_name)
    if data is None:
        raise HTTPException(status_code=500, detail="文件下载失败")
    
    # 获取文件信息
    info = rustfs.get_file_info(object_name)
    
    from fastapi.responses import Response
    return Response(
        content=data,
        media_type=info.get("content_type", "application/octet-stream"),
        headers={
            "Content-Disposition": f"attachment; filename={object_name.split('/')[-1]}"
        }
    )

@router.delete("/delete/{object_name:path}")
async def delete_file(
    object_name: str,
    rustfs: RustFSService = Depends(get_rustfs),
):
    """删除文件"""
    if not rustfs.is_available():
        raise HTTPException(status_code=503, detail="对象存储服务不可用")
    
    # 检查文件是否存在
    if not rustfs.file_exists(object_name):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 删除文件
    success = rustfs.delete_file(object_name)
    if not success:
        raise HTTPException(status_code=500, detail="文件删除失败")
    
    return {"message": "文件删除成功"}

@router.get("/list")
async def list_files(
    prefix: str = "",
    rustfs: RustFSService = Depends(get_rustfs),
):
    """列出文件"""
    if not rustfs.is_available():
        raise HTTPException(status_code=503, detail="对象存储服务不可用")
    
    files = rustfs.list_files(prefix=prefix, recursive=True)
    
    return {
        "total": len(files),
        "files": files,
    }
```

## 注意事项

1. **服务可用性检查**：在使用 RustFS 服务前，务必先调用 `is_available()` 检查服务是否可用
2. **错误处理**：所有方法都会返回操作结果（布尔值或数据），需要根据返回值判断操作是否成功
3. **文件路径**：`object_name` 参数就是文件在 RustFS 中的完整路径，支持使用 `/` 分隔的目录结构
4. **预签名 URL**：用于临时访问文件，无需认证。URL 会在指定时间后过期
5. **元数据**：可以为上传的文件添加自定义元数据，方便后续查询和管理

## 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `RUSTFS_ENDPOINT` | RustFS 服务地址 | `localhost:9000` |
| `RUSTFS_ACCESS_KEY` | 访问密钥 | `rustfsadmin` |
| `RUSTFS_SECRET_KEY` | 密钥 | `rustfsadmin` |
| `RUSTFS_BUCKET_NAME` | 存储桶名称 | `catwiki` |
| `RUSTFS_USE_SSL` | 是否使用 SSL | `false` |

## 初始化

应用启动时会自动初始化 RustFS 服务：
1. 创建 RustFS 客户端连接
2. 检查存储桶是否存在
3. 如果存储桶不存在，自动创建

如果初始化失败（如 RustFS 服务未启动），应用仍会继续启动，但 RustFS 相关功能将不可用。

