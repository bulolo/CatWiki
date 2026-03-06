# CatWiki API 结构说明

CatWiki API 采用分层结构，分为 **Admin API**（管理后台使用，带权限控制）和 **Client API**（对外展现使用，只读筛选）。

## 基础信息

- **Admin API 前缀**: `/admin/v1`
- **Client API 前缀**: `/v1`
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

#### Admin API (`/admin/v1/sites`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/` | 获取站点列表（分页） | `page`, `size`, `status` (可选) |
| `GET` | `/{site_id}` | 获取站点详情 | - |
| `GET` | `:bySlug/{slug}` | 通过 slug 标识获取站点详情 | - |
| `POST` | `/` | 创建站点 | `SiteCreate` (name, slug, description 等) |
| `PUT` | `/{site_id}` | 更新站点 | `SiteUpdate` |
| `DELETE` | `/{site_id}` | 删除站点（级联删除关联数据） | - |

**特性**:
- 支持按 `status` 筛选（`active`/`inactive`）
- 创建/更新时自动检查名称和 slug 唯一性
- 删除时级联删除所有关联的合集、文档等数据及向量库数据

#### Client API (`/v1/sites`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/` | 获取激活的站点列表（分页） | `page`, `size`, `tenant_slug` (可选), `keyword` (可选) |
| `GET` | `/{site_id}` | 获取站点详情 | - |
| `GET` | `:bySlug/{slug}` | 通过 slug 标识获取站点详情 | - |

**特性**:
- 仅返回 `status="active"` 的站点
- 不传 `tenant_slug`：返回所有租户的站点（站点广场场景）
- 传 `tenant_slug`：仅返回该租户下的站点
- 详情接口有 10 秒缓存
- 自动脱敏，过滤敏感数据

---

### 2. 文档管理 (Documents)

#### Admin API (`/admin/v1/documents`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/` | 获取文档列表（分页） | `page`, `size`, `site_id`, `collection_id`, `status`, `vector_status`, `keyword`, `order_by`, `order_dir`, `exclude_content` |
| `GET` | `/{document_id}` | 获取文档详情 | - |
| `POST` | `/` | 创建文档 | `DocumentCreate` |
| `POST` | `/import` | 导入文档（上传→解析→创建） | `file`, `site_id`, `collection_id`, `processor_type`, `ocr_enabled`, `extract_images`, `extract_tables` |
| `PUT` | `/{document_id}` | 更新文档 | `DocumentUpdate` |
| `DELETE` | `/{document_id}` | 删除文档（同步清理向量库） | - |
| `POST` | `:batchVectorize` | 批量向量化文档 | `VectorizeRequest` (document_ids) |
| `POST` | `/{document_id}:vectorize` | 向量化单个文档 | - |
| `POST` | `/{document_id}:removeVector` | 移除文档向量（从向量库删除并重置状态） | - |
| `GET` | `/{document_id}/chunks` | 获取文档的向量切片信息 | - |
| `POST` | `/retrieve` | 语义检索向量数据库 | `VectorRetrieveRequest` (query, k, threshold, filter, enable_rerank, rerank_k) |

**特性**:
- 支持多条件筛选：站点、合集、状态、向量状态、关键词搜索
- 支持按多字段排序（`created_at`, `updated_at`, `views` 等）
- 向量化状态：`none`, `pending`, `processing`, `completed`, `failed`
- 删除文档时自动从向量库中移除
- 自定义动作使用 `:action` 冒号风格
- 导入支持 PDF 和图片文件，可选 OCR 和图表提取

#### Client API (`/v1/documents`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/` | 获取已发布文档列表（分页） | `page`, `size`, `tenant_slug` (可选), `site_id`, `collection_id`, `keyword`, `exclude_content` |
| `GET` | `/{document_id}` | 获取文档详情（自动增加浏览量） | - |

**特性**:
- 仅返回 `status="published"` 的文档
- 支持关键词搜索（标题、内容）
- `exclude_content=true` 可排除文档内容，提升列表性能
- 批量加载合集信息，避免 N+1 查询

---

### 3. 合集管理 (Collections)

#### Admin API (`/admin/v1/collections`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/` | 获取合集列表 | `parent_id` (可选，获取指定父合集下的子合集), `site_id` (通过 `get_valid_site` 依赖项) |
| `GET` | `:tree` | 获取合集树形结构 | `type` (可选：`collection` 仅显示合集，不指定则包含文档), `site_id` (通过 `get_valid_site` 依赖项) |
| `GET` | `/{collection_id}` | 获取合集详情 | - |
| `POST` | `/` | 创建合集 | `CollectionCreate` |
| `PUT` | `/{collection_id}` | 更新合集 | `CollectionUpdate` |
| `DELETE` | `/{collection_id}` | 删除合集 | - |
| `POST` | `/{collection_id}:move` | 移动合集到新位置 | `MoveCollectionRequest` (target_parent_id, target_position) |

**特性**:
- 支持树形结构组织
- 移动接口自动重新计算排序
- 批量加载文档，避免 N+1 查询
- 删除时检查是否有子合集或关联文档

#### Client API (`/v1/collections`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `:tree` | 获取合集树形结构 | `site_id` (必填), `include_documents` (是否包含文档节点) |

**特性**:
- 仅返回已发布的合集和文档
- 批量预加载文档，优化性能

---

### 4. 文件管理 (Files)

CatWiki 接入 RustFS/MinIO 存储，支持标准对象存储操作。

#### Admin API (`/admin/v1/files`)

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

#### Client API (`/v1/files`)

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

**仅 Admin API** (`/admin/v1/users`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/` | 获取用户列表（分页） | `page`, `size`, `role`, `status`, `search`, `site_id`, `order_by`, `order_dir` |
| `GET` | `/{user_id}` | 获取用户详情 | - |
| `POST` | `/` | 创建用户 | `UserCreate` |
| `POST` | `:invite` | 邀请用户（返回临时密码） | `UserInvite` |
| `PUT` | `/{user_id}` | 更新用户信息（支持更新角色、状态、站点等） | `UserUpdate` |
| `PUT` | `/{user_id}/password` | 更新用户密码 | `UserUpdatePassword` |
| `POST` | `/{user_id}:resetPassword` | 重置用户密码（生成临时密码） | - |
| `DELETE` | `/{user_id}` | 删除用户 | - |
| `POST` | `:login` | 用户登录 | `UserLogin` (email, password) |

**特性**:
- 角色类型：`admin` (平台管理员), `tenant_admin` (租户管理员), `site_admin` (站点管理员)
- 状态类型：`active`, `inactive`, `pending`
- 支持邀请机制，自动生成临时密码
- 登录返回 JWT Token
- 支持按角色、状态、搜索关键词 (`search`)、站点 ID 筛选
- 权限层级控制：不同角色有不同的查看/操作范围

---

### 6. 系统配置 (System Config)

**仅 Admin API** (`/admin/v1/system-configs`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/ai-config` | 获取 AI 模型配置 | `scope` (platform/tenant，默认 tenant) |
| `PUT` | `/ai-config` | 更新 AI 模型配置 | `AIConfigUpdate`, `scope` |
| `POST` | `/ai-config/test-connection` | 测试模型连接 | `TestConnectionRequest`, `scope` |
| `GET` | `/doc-processor` | 获取文档处理服务配置 | `scope` |
| `PUT` | `/doc-processor` | 更新文档处理服务配置 | `DocProcessorsUpdate`, `scope` |
| `POST` | `/doc-processor/test-connection` | 测试文档处理服务连接 | `TestDocProcessorRequest`, `scope` |
| `DELETE` | `/{config_key}` | 删除指定配置 | `scope` |

**配置类型**:
- **AI 配置**: 包含 `chat` (LLM 模型)、`embedding` (向量模型)、`rerank` (重排序模型)、`vl` (视觉模型) 四个独立模块
- **文档处理服务**: 支持 MinerU 等文档解析器
- 企业版支持 `scope` 参数区分平台级和租户级配置

---

### 7. 统计信息 (Stats)

**仅 Admin API** (`/admin/v1/stats`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `:siteStats` | 获取站点统计数据 | `site_id` (必填) |

**返回数据**:
- `total_documents`: 文档总数
- `total_views`: 总访问次数
- `views_today`: 今日浏览量
- `unique_ips_today`: 今日独立IP数
- `total_unique_ips`: 历史独立IP总数
- `total_chat_sessions`: 累计会话总数
- `total_chat_messages`: 累计消息总数
- `active_chat_users`: 活跃AI用户数
- `new_sessions_today`: 今日新增会话
- `new_messages_today`: 今日新增消息
- `daily_trends`: 最近7天趋势数据
- `recent_sessions`: 最近对话记录

---

### 8. 缓存管理 (Cache)

**仅 Admin API** (`/admin/v1/cache`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `:stats` | 获取缓存统计信息 | - |
| `POST` | `:clear` | 清空所有缓存 | - |

**特性**:
- 查看缓存命中率
- 一键清空所有缓存

---

### 9. 会话记录 (Chat Sessions)

**Client API** (`/v1/chat`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/sessions` | 获取会话列表 | `tenant_slug` (可选), `site_id`, `member_id`, `keyword`, `page`, `size` |
| `GET` | `/sessions/{thread_id}` | 获取会话详情 | - |
| `GET` | `/sessions/{thread_id}/messages` | 获取会话历史消息 | - |
| `DELETE` | `/sessions/{thread_id}` | 删除会话（同步删除历史） | - |

**特性**:
- 支持 `keyword` 搜索（标题或内容）
- 支持按 `member_id` 过滤（String类型）
- 删除接口会同步清理 LangGraph Checkpointer 历史

---

### 10. AI 对话 (Chat Completions)

**Client API** (`/v1/chat`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `POST` | `/completions` | 创建聊天补全 (OpenAI 兼容接口) | `ChatCompletionRequest` |

**特性**:
- 兼容 OpenAI Chat API 格式
- 支持流式 (SSE) 和非流式响应
- 自动集成 RAG 检索

---

### 11. 机器人 Webhook (Bot)

**Client API** (`/v1/bot`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/wecom-smart` | 企业微信智能机器人 URL 验证 | `msg_signature`, `timestamp`, `nonce`, `echostr`, `site_id` |
| `POST` | `/wecom-smart` | 企业微信智能机器人消息回调 | `msg_signature`, `timestamp`, `nonce`, `site_id` |
| `GET` | `/wecom-kefu` | 企业微信客服 URL 验证 | `msg_signature`, `timestamp`, `nonce`, `echostr`, `site_id` |
| `POST` | `/wecom-kefu` | 企业微信客服消息回调 | `msg_signature`, `timestamp`, `nonce`, `site_id` |
| `GET` | `/wecom-app` | 企业微信应用 URL 验证 | `msg_signature`, `timestamp`, `nonce`, `echostr`, `site_id` |
| `POST` | `/wecom-app` | 企业微信应用消息回调 | `msg_signature`, `timestamp`, `nonce`, `site_id` |

**特性**:
- 支持多种企业微信集成方式
- 自动根据站点配置路由消息

---

### 12. 租户管理 (Tenants)

#### 基础版 (CE)

**Admin API** (`/admin/v1/tenants`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/current` | 获取当前活跃租户 | - |

#### 企业版 (EE) 👑

**Admin API** (`/admin/v1/tenants`) - [企业版专属]

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `GET` | `/` | 获取租户列表 (系统管理员) | `page`, `size` |
| `POST` | `/` | 创建租户 | `TenantCreateRequest` (含管理员信息) |
| `GET` | `/{tenant_id}` | 获取租户详情 | - |
| `PUT` | `/{tenant_id}` | 更新租户信息 | `TenantUpdate` |
| `DELETE` | `/{tenant_id}` | 级联删除租户所有数据 | - |

**特性**:
- **权限隔离**：创建、删除等操作仅限 `ADMIN` (系统管理员) 权限。
- **级联清理**：删除租户将通过 `TenantService` 同步清理其下属的所有站点、合集、文档、用户配置以及向量库索引。
- **物理隔离**：相关管理接口和业务逻辑完全存放在 `app/ee` 目录下，在社区版构建中会被物理移除。

#### EE Bot API 👑

**Client API** (`/v1/bot`) - [企业版专属]

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| `POST` | `/chat/completions` | 站点专用聊天补全 (OpenAI 兼容) | `ChatCompletionRequest`, `Authorization: Bearer <api_key>` |
| `GET` | `/models` | 列出可用模型 | `Authorization` (可选) |

**特性**:
- 通过 API Key 认证，绑定到具体站点
- 自动注入站点过滤器，实现站点级数据隔离
- 检查站点状态和 API Bot 是否启用

---

### 13. 健康检查 (Health)

#### Admin API (`/admin/v1/health`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|---------|------|
| `GET` | `/` | 增强健康检查（数据库 + RustFS 存储） | - |

**返回状态**: `healthy` / `degraded` / `unhealthy`

#### Client API (`/v1/health`)

| 方法 | 路径 | 说明 | 参数 |
|------|------|---------|------|
| `GET` | `/` | 基础健康检查（数据库） | - |

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
1. **权限控制**: 所有 Admin API 都需要通过 `get_current_user_with_tenant` 进行身份验证，强制租户视图。
2. **状态过滤**: Client API 自动过滤，仅返回 `status="active"` 的站点和 `status="published"` 的文档。
3. **隔离策略**: Client API 采用参数化隔离（如 `site_id`），不再依赖强制性的 `X-Tenant-Slug` Header，支持跨租户的站点广场模式。
4. **向量状态**: 只有 `vector_status="completed"` 的文档才会被 AI 检索引用。
5. **性能优化**: 
   - Client API 的 `GET /documents` 建议使用 `exclude_content=true` 加速列表加载。
   - 树形结构接口已优化，批量加载数据避免 N+1 查询。
6. **缓存策略**: Client API 的站点详情接口有 10 秒缓存。
7. **文件存储**: 支持 RustFS/MinIO，上传时自动生成唯一文件名并保存原始文件名到元数据。
8. **API 风格**: 自定义操作使用冒号风格 (`:action`)，符合 Google API Design Guide。
9. **多租户配置**: 系统配置接口支持 `scope` 参数（`platform`/`tenant`），区分平台级和租户级配置。
