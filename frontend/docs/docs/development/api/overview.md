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

## API 设计规范

CatWiki API 遵循 [Google API Design Guide](https://cloud.google.com/apis/design)，对于自定义操作（非标准 CRUD）采用**冒号风格** (`:action`)：

- **标准 CRUD 操作**: 使用常规 REST 路径
  - `GET /resources` → 列表
  - `GET /resources/{id}` → 详情
  - `POST /resources` → 创建
  - `PUT /resources/{id}` → 更新
  - `DELETE /resources/{id}` → 删除

- **自定义操作**: 使用冒号风格
  - 集合级操作: `POST /resources:action` (如 `:batchVectorize`)
  - 资源级操作: `POST /resources/{id}:action` (如 `/{id}:vectorize`)

---

## 核心 API 概览

### 1. 站点管理 (Sites)

#### Admin API (`/admin/api/v1/sites`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/` | 获取站点列表（分页） | `page`, `size`, `status` (可选) |
| `GET` | `/{site_id}` | 获取站点详情 | - |
| `GET` | `:byDomain/{domain}` | 通过域名获取站点详情 | - |
| `POST` | `/` | 创建站点 | `SiteCreate` (name, domain, description 等) |
| `PUT` | `/{site_id}` | 更新站点 | `SiteUpdate` |
| `DELETE` | `/{site_id}` | 删除站点（级联删除关联数据） | - |

**特性**:
- 支持按 `status` 筛选（`active`/`inactive`）
- 创建/更新时自动检查名称和域名唯一性
- 删除时级联删除所有关联的合集、文档等数据

#### Client API (`/api/v1/sites`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/` | 获取激活的站点列表（分页） | `page`, `size` |
| `GET` | `/{site_id}` | 获取站点详情 | - |
| `GET` | `:byDomain/{domain}` | 通过域名获取站点详情 | - |

**特性**:
- 仅返回 `status="active"` 的站点
- 详情接口有 10 分钟缓存

---

### 2. 文档管理 (Documents)

#### Admin API (`/admin/api/v1/documents`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/` | 获取文档列表（分页） | `page`, `size`, `site_id`, `collection_id`, `status`, `vector_status`, `keyword`, `order_by`, `order_dir`, `exclude_content` |
| `GET` | `/{document_id}` | 获取文档详情 | - |
| `POST` | `/` | 创建文档 | `DocumentCreate` |
| `PUT` | `/{document_id}` | 更新文档 | `DocumentUpdate` |
| `DELETE` | `/{document_id}` | 删除文档（同步清理向量库） | - |
| `POST` | `:batchVectorize` | 批量向量化文档 | `VectorizeRequest` (document_ids) |
| `POST` | `/{document_id}:vectorize` | 向量化单个文档 | - |
| `POST` | `/{document_id}:removeVector` | 移除文档向量（从向量库删除并重置状态） | - |

**特性**:
- 支持多条件筛选：站点、合集、状态、向量状态、关键词搜索
- 支持按多字段排序（`created_at`, `updated_at`, `views` 等）
- 向量化状态：`none`, `pending`, `processing`, `completed`, `failed`
- 删除文档时自动从向量库中移除
- 自定义动作使用 `:action` 冒号风格

#### Client API (`/api/v1/documents`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/` | 获取已发布文档列表（分页） | `page`, `size`, `site_id`, `collection_id`, `keyword`, `exclude_content` (默认: true) |
| `GET` | `/{document_id}` | 获取文档详情（自动增加浏览量） | - |

**特性**:
- 仅返回 `status="published"` 的文档
- 支持关键词搜索（标题、内容）
- `exclude_content=true` 可排除文档内容，提升列表性能
- 批量加载合集信息，避免 N+1 查询

---

### 3. 合集管理 (Collections)

#### Admin API (`/admin/api/v1/collections`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/` | 获取合集列表 | `parent_id` (可选，获取指定父合集下的子合集) |
| `GET` | `:tree` | 获取合集树形结构 | `type` (可选：`collection` 仅显示合集，不指定则包含文档) |
| `GET` | `/{collection_id}` | 获取合集详情 | - |
| `POST` | `/` | 创建合集 | `CollectionCreate` |
| `PUT` | `/{collection_id}` | 更新合集 | `CollectionUpdate` |
| `DELETE` | `/{collection_id}` | 删除合集 | - |
| `POST` | `/{collection_id}:move` | 移动合集到新位置 | `MoveCollectionRequest` (new_parent_id, new_order) |

**特性**:
- 支持树形结构组织
- 移动接口自动重新计算排序
- 批量加载文档，避免 N+1 查询
- 删除时检查是否有子合集或关联文档

#### Client API (`/api/v1/collections`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `:tree` | 获取合集树形结构 | `site_id` (必填), `include_documents` (是否包含文档节点) |

**特性**:
- 仅返回已发布的合集和文档
- 批量预加载文档，优化性能

---

### 4. 文件管理 (Files)

CatWiki 接入 RustFS/MinIO 存储，支持标准对象存储操作。

#### Admin API (`/admin/api/v1/files`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `POST` | `:upload` | 单文件上传 | `file`, `folder` (默认: uploads) |
| `POST` | `:batchUpload` | 批量上传文件 | `files`, `folder` |
| `GET` | `/{object_name}:download` | 下载文件 | - |
| `GET` | `:list` | 列出存储文件 | `prefix`, `recursive` |
| `GET` | `/{object_name}:info` | 获取文件详细信息 | - |
| `GET` | `/{object_name}:presignedUrl` | 获取预签名 URL | `expires_hours` (1-168 小时) |
| `DELETE` | `/{object_name}` | 删除文件 | - |

**特性**:
- 支持单文件和批量上传
- 自动生成唯一文件名（UUID）
- 保存原始文件名到元数据
- 支持获取预签名 URL（有效期 1-168 小时）

#### Client API (`/api/v1/files`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/{object_name}:download` | 下载文件 | - |
| `GET` | `/{object_name}:info` | 获取文件基本信息 | - |
| `GET` | `/{object_name}:presignedUrl` | 获取访问 URL | `expires_hours` (1-24 小时) |

**特性**:
- 只读访问
- 公开存储桶返回直接 URL，私有存储桶返回预签名 URL
- 预签名 URL 有效期最长 24 小时

---

### 5. 用户管理 (Users)

**仅 Admin API** (`/admin/api/v1/users`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/` | 获取用户列表（分页） | `page`, `size`, `role`, `status`, `keyword`, `order_by`, `order_dir` |
| `GET` | `/{user_id}` | 获取用户详情 | - |
| `POST` | `/` | 创建用户 | `UserCreate` |
| `POST` | `:invite` | 邀请用户（返回临时密码） | `UserInvite` |
| `PUT` | `/{user_id}` | 更新用户信息（支持更新角色、状态、站点等） | `UserUpdate` |
| `PUT` | `/{user_id}/password` | 更新用户密码 | `UserUpdatePassword` |
| `POST` | `/{user_id}:resetPassword` | 重置用户密码（生成临时密码） | - |
| `DELETE` | `/{user_id}` | 删除用户 | - |
| `POST` | `:login` | 用户登录 | `UserLogin` (email, password) |

**特性**:
- 角色类型：`admin`, `site_admin`, `editor`
- 状态类型：`active`, `inactive`, `pending`
- 支持邀请机制，自动生成临时密码
- 登录返回 JWT Token
- 支持按角色、状态、关键词筛选

---

### 6. 系统配置 (System Config)

**仅 Admin API** (`/admin/api/v1/system-configs`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/ai-config` | 获取 AI 模型配置 | - |
| `PUT` | `/ai-config` | 更新 AI 模型配置 | `AIConfigUpdate` |
| `GET` | `/bot-config` | 获取机器人配置 | - |
| `PUT` | `/bot-config` | 更新机器人配置 | `BotConfigUpdate` |
| `GET` | `/` | 获取所有配置 | - |
| `DELETE` | `/{config_key}` | 删除指定配置 | - |

**配置类型**:
- **AI 配置**: LLM 模型、Embedding 模型、自动/手动模式
- **机器人配置**: 网页挂件、API 接口、微信公众号

---

### 7. 统计信息 (Stats)

**仅 Admin API** (`/admin/api/v1/stats`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `:siteStats` | 获取站点统计数据 | `site_id` (必填) |

**返回数据**:
- `total_documents`: 文档总数
- `total_views`: 总访问次数

---

### 8. 缓存管理 (Cache)

**仅 Admin API** (`/admin/api/v1/cache`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `:stats` | 获取缓存统计信息 | - |
| `POST` | `:clear` | 清空所有缓存 | - |

**特性**:
- 查看缓存命中率
- 一键清空所有缓存

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
1. **权限控制**: 所有 Admin API 都需要通过 `get_current_active_user` 进行身份验证
2. **状态过滤**: Client API 自动过滤，仅返回 `status="active"` 的站点和 `status="published"` 的文档
3. **向量状态**: 只有 `vector_status="completed"` 的文档才会被 AI 检索引用
4. **性能优化**: 
   - Client API 的 `GET /documents` 建议使用 `exclude_content=true` 加速列表加载
   - 树形结构接口已优化，批量加载数据避免 N+1 查询
5. **缓存策略**: Client API 的站点详情接口有 10 分钟缓存
6. **文件存储**: 支持 RustFS/MinIO，上传时自动生成唯一文件名并保存原始文件名到元数据
7. **API 风格**: 自定义操作使用冒号风格 (`:action`)，符合 Google API Design Guide
