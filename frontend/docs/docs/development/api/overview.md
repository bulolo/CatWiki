# CatWiki API 结构说明

CatWiki API 采用分层结构，分为 **Admin API**（管理后台使用，带权限控制）和 **Client API**（对外展现使用，只读筛选）。

## 基础信息

- **Admin API 前缀**: `/admin/api/v1`
- **Client API 前缀**: `/api/v1`
- **默认文档地址**: `/docs` (FastAPI Swagger)
- **OpenAPI 配置**:
  - 管理后台: `/openapi-admin.json`
  - 客户端: `/openapi-client.json`

---

## 核心 API 概览

### 1. 站点管理 (Sites)

| 功能 | Admin API (前缀 `/admin/api/v1/sites`) | Client API (前缀 `/api/v1/sites`) |
|------|-----------|------------|
| 列表查询 | `GET /` (支持分页、`status` 筛选) | `GET /` (仅返回已激活站点) |
| 详情查询 | `GET /{id}` | `GET /{id}` 或 `GET /by-domain/{domain}` |
| 创建站点 | `POST /` | - |
| 更新站点 | `PUT /{id}` | - |
| 删除站点 | `DELETE /{id}` (级联删除) | - |

---

### 2. 文档管理 (Documents)

| 功能 | Admin API (前缀 `/admin/api/v1/documents`) | Client API (前缀 `/api/v1/documents`) |
|------|-----------|------------|
| 列表查询 | `GET /` (含草稿、搜索、状态筛选、向量状态过滤) | `GET /` (仅已发布、搜索、支持排除内容) |
| 详情查询 | `GET /{id}` (支持可选增加浏览量) | `GET /{id}` (自动增加浏览量) |
| 创建/修改 | `POST /`, `PUT /{id}` | - |
| 删除文档 | `DELETE /{id}` (同步清理向量库) | - |
| **知识库自动化** | `POST /vectorize` (批量)、`POST /{id}/vectorize` (单篇) | - |
| **学习状态** | `GET /vector-status/{status}`, `DELETE /{id}/vectorize` (取消) | - |

---

### 3. 合集与树 (Collections)

| 功能 | Admin API (前缀 `/admin/api/v1/collections`) | Client API (前缀 `/api/v1/collections`) |
|------|-----------|------------|
| 列表/树 | `GET /` (简单列表)、`GET /tree` (完整树，含文档) | `GET /tree` (仅已发布内容) |
| 组织架构 | `POST /`, `PUT /{id}`, `DELETE /{id}` | - |
| 移动节点 | `POST /{id}/move` (动态调整排序与父子关系) | - |

---

### 4. 文件管理 (Files)

CatWiki 接入 RustFS/MinIO 存储，支持标准对象存储操作。

- **Admin API (`/admin/api/v1/files`)**: 
    - `POST /upload`: 单文件上传
    - `POST /upload-multiple`: 批量上传
    - `GET /list`: 列出存储文件
    - `GET /info/{path}`: 获取详细元数据
    - `DELETE /{path}`: 删除文件
- **Client API (`/api/v1/files`)**: 
    - `GET /download/{path}`: 下载/访问
    - `GET /presigned-url/{path}`: 获取访问连接

---

### 5. 系统与管理 (Admin Only)

仅限管理后台使用，路径前缀均为 `/admin/api/v1`：

- **用户管理 (`/users`)**: 完整用户的 CRUD、邀请机制、密码重置、登录 (`/login`)。
- **配置中心 (`/system-configs`)**: 
    - `GET/PUT /ai-config`: LLM 模型与 Embedding 配置。
    - `GET/PUT /bot-config`: 微信、Web 挂件、API 机器人配置。
- **统计信息 (`/stats`)**: `GET /site-stats` 站点全局数据统计。
- **缓存管理 (`/cache`)**: `GET /stats` 查看缓存命中，`POST /clear` 全局清理。

---

## 前端 SDK 集成

后端提供自动化的 SDK 生成脚本，确保前端类型安全。

### 更新 SDK
当后端 Models 或 Endpoints 变更后，在项目根目录下运行：
```bash
make gen-sdk
```

### 目录结构
- **Admin SDK**: `frontend/admin/src/lib/sdk`
- **Client SDK**: `frontend/client/lib/sdk`

---

## 开发提示
1. **状态过滤**: Client API 会自动强制站点满足 `status="active"`，且文档满足 `status="published"`。
2. **向量状态**: 只有状态为 `completed` 的文档才会被 AI 检索引用。
3. **性能**: `GET /documents` 列表接口建议在 Client 端使用 `exclude_content=true` 以加速首屏加载。
