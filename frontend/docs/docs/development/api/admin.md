# Admin API

Admin API 提供完整的 CRUD 操作和管理功能，需要身份认证。

## 🔐 认证

所有 Admin API 都需要 JWT Token 认证。

### 获取 Token

```typescript
const response = await apiClient.adminUsers.loginAdmin({
  requestBody: {
    email: "admin@catwiki.cn",
    password: "admin123"
  }
})

const token = response.data.token
```

### 使用 Token

```typescript
// 在请求头中添加 Token
headers: {
  'Authorization': `Bearer ${token}`
}
```

---

---

## 📚 API 端点

> [!IMPORTANT]
> **关于路径中的冒号 (`:`)**
> 本项目遵循 Google API 设计指南中的自定义方法规范。诸如 `:tree`, `:move`, `:upload` 等后缀是直接加在资源路径后的动作标识，**中间没有斜杠**。
> - ✅ 正确：`/admin/v1/collections:tree`
> - ❌ 错误：`/admin/v1/collections/tree`

### 用户管理

- `POST /admin/v1/users:login` - 用户登录（返回 JWT Token）
- `POST /admin/v1/users:invite` - 邀请用户（自动生成临时密码，返回 `{user, password}`）
- `GET /admin/v1/users` - 获取用户列表（支持 `is_pager`、`role`、`status`、`search`、`site_id` 等过滤）
- `GET /admin/v1/users/{id}` - 获取用户详情
- `POST /admin/v1/users` - 创建用户（密码最小 8 位）
- `PUT /admin/v1/users/{id}` - 更新用户
- `PUT /admin/v1/users/{id}/password` - 修改密码（需提供 old_password）
- `POST /admin/v1/users/{id}:resetPassword` - 重置密码（管理员操作，返回 `{user, password}`）
- `DELETE /admin/v1/users/{id}` - 删除用户

### 站点管理

- `GET /admin/v1/sites` - 获取站点列表（支持 `is_pager`、`status` 过滤）
- `GET /admin/v1/sites/{id}` - 获取站点详情
- `GET /admin/v1/sites:bySlug/{slug}` - 通过 slug 获取站点
- `POST /admin/v1/sites` - 创建站点
- `PUT /admin/v1/sites/{id}` - 更新站点
- `DELETE /admin/v1/sites/{id}` - 删除站点（级联删除合集、文档、向量数据）

#### EE 站点扩展 👑 (企业版专属)

- `GET /admin/v1/sites/{id}/ee-config` - 获取站点 EE 配置（访问控制 + API Bot）
- `PATCH /admin/v1/sites/{id}/ee-config` - 更新站点 EE 配置（`SiteEEConfigUpdate`：access + api_bot）
- `GET /admin/v1/sites/{id}/analytics` - 获取数据分析概览（`days` 参数，1-90，默认7）
- `GET /admin/v1/sites/{id}/chat-sessions` - 获取站点 AI 对话会话列表（审计，支持 `keyword`/`page`/`size`）
- `GET /admin/v1/sites/{id}/chat-sessions/{thread_id}/messages` - 获取对话完整记录（审计）
- `DELETE /admin/v1/sites/{id}/chat-sessions/{thread_id}` - 删除对话记录

### 文档管理

- `GET /admin/v1/documents` - 获取文档列表（支持 `is_pager`、`site_id`、`collection_id`、`status`、`vector_status`、`keyword`、`order_by`/`order_dir`、`exclude_content`）
- `GET /admin/v1/documents/{id}` - 获取文档详情
- `POST /admin/v1/documents` - 创建文档
- `POST /admin/v1/documents/import` - 导入文档（multipart，上传→异步解析→创建，返回 Task）
- `PUT /admin/v1/documents/{id}` - 更新文档
- `DELETE /admin/v1/documents/{id}` - 删除文档（同步清理向量库）
- `POST /admin/v1/documents:batchVectorize` - 批量向量化（`VectorizeRequest`，返回 `VectorizeResponse`）
- `POST /admin/v1/documents/{id}:vectorize` - 向量化单个文档（返回更新后的 Document）
- `POST /admin/v1/documents/{id}:removeVector` - 移除向量（重置 vector_status 为 none）
- `GET /admin/v1/documents/{id}/chunks` - 获取文档向量切片列表
- `POST /admin/v1/documents/retrieve` - 语义检索向量数据库（`VectorRetrieveRequest`）

### 合集管理

- `GET /admin/v1/collections` - 获取合集列表（支持 `is_pager`、`parent_id`、`site_id`）
- `GET /admin/v1/collections/{id}` - 获取合集详情
- `GET /admin/v1/collections:tree` - 获取合集树（`type=collection` 仅显示合集，不含文档节点）
- `POST /admin/v1/collections` - 创建合集
- `PUT /admin/v1/collections/{id}` - 更新合集
- `POST /admin/v1/collections/{id}:move` - 移动合集（`MoveCollectionRequest`：target_parent_id, target_position）
- `DELETE /admin/v1/collections/{id}` - 删除合集

### 文件管理

- `POST /admin/v1/files:upload` - 上传文件（`file`, `folder` 默认 uploads）
- `POST /admin/v1/files:batchUpload` - 批量上传（`files`, `folder`）
- `GET /admin/v1/files` - 列出文件（`prefix`, `recursive`, `page`, `size`, `is_pager`）
- `GET /admin/v1/files/{object_name}:download` - 下载文件
- `GET /admin/v1/files/{object_name}:info` - 获取文件信息
- `GET /admin/v1/files/{object_name}:presignedUrl` - 获取预签名 URL（`expires_hours` 1-168）
- `DELETE /admin/v1/files/{object_name}` - 删除文件

### 缓存管理

- `GET /admin/v1/cache:stats` - 获取缓存统计
- `POST /admin/v1/cache:clear` - 清空缓存

### 系统配置

- `GET /admin/v1/system-configs/ai-config` - 获取 AI 配置
- `PUT /admin/v1/system-configs/ai-config` - 更新 AI 配置
- `POST /admin/v1/system-configs/ai-config/test-connection` - 测试模型连接
- `GET /admin/v1/system-configs/doc-processor` - 获取文档处理服务配置
- `PUT /admin/v1/system-configs/doc-processor` - 更新文档处理服务配置
- `POST /admin/v1/system-configs/doc-processor/test-connection` - 测试文档处理服务连接
- `DELETE /admin/v1/system-configs/{config_key}` - 删除指定配置

> 注意：以上系统配置接口均支持 `scope` 查询参数（`platform`/`tenant`），默认为 `tenant`。

### 租户管理

#### 基础版 (CE)
- `GET /admin/v1/tenants/current` - 获取当前上下文租户

#### 企业版 (EE)
- `GET /admin/v1/tenants` - 获取租户列表（Admin Only，支持 `keyword`、`page`、`size`、`is_pager`）
- `POST /admin/v1/tenants` - 创建租户（Admin Only，`TenantCreateRequest` 含管理员账号信息）
- `GET /admin/v1/tenants/{id}` - 获取租户详情
- `PUT /admin/v1/tenants/{id}` - 更新租户信息（`TenantEEUpdate`）
- `DELETE /admin/v1/tenants/{id}` - 级联删除租户及数据（Admin Only）

### 统计信息

- `GET /admin/v1/stats:siteStats` - 获取站点统计

### 健康检查

- `GET /admin/v1/health` - 健康检查（数据库 + RustFS 存储状态）

---

## 📖 详细文档

完整的 API 文档请访问：http://localhost:3000/docs

---

## 📚 相关文档

- [API 概览](/development/api/overview)
- [Client API](/development/api/client)
- [SDK 使用指南](/development/tech/sdk-usage)
