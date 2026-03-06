# Client API

Client API 提供只读访问，无需认证，仅返回已发布的内容。

## 🌐 公开访问

Client API 不需要身份认证，可以直接访问。

---

## 📚 API 端点

### 站点信息

- `GET /v1/sites` - 获取已发布站点列表
- `GET /v1/sites/{id}` - 获取站点详情
- `GET /v1/sites:bySlug/{slug}` - 通过 slug 获取站点

### 文档浏览

- `GET /v1/documents` - 获取已发布文档列表（支持 tenant_slug 跨端拉取）
- `GET /v1/documents/{id}` - 获取文档详情（自动增加浏览量）

### 合集浏览

- `GET /v1/collections:tree` - 获取合集树（仅已发布内容）

### 文件访问

- `GET /v1/files/{path}:download` - 下载文件
- `GET /v1/files/{path}:info` - 获取文件信息
- `GET /v1/files/{path}:presignedUrl` - 获取预签名 URL

### AI 对话

- `POST /v1/chat/completions` - 创建聊天补全 (OpenAI 兼容接口)

### 会话记录

- `GET /v1/chat/sessions` - 获取会话列表（支持 tenant_slug, keyword 搜索，member_id 过滤）
- `GET /v1/chat/sessions/{thread_id}` - 获取会话详情
- `GET /v1/chat/sessions/{thread_id}/messages` - 获取会话历史消息
- `DELETE /v1/chat/sessions/{thread_id}` - 删除会话

### 机器人 Webhook

- `GET/POST /v1/bot/wecom-smart` - 企业微信智能机器人（URL 验证 & 消息回调）
- `GET/POST /v1/bot/wecom-kefu` - 企业微信客服（URL 验证 & 消息回调）
- `GET/POST /v1/bot/wecom-app` - 企业微信应用（URL 验证 & 消息回调）

### EE Bot API 👑 (企业版专属)

- `POST /v1/bot/chat/completions` - 站点专用聊天补全（通过 API Key 认证）
- `GET /v1/bot/models` - 列出可用模型

### 健康检查

- `GET /v1/health` - 健康检查（数据库状态）

---

## 💡 使用示例

### 获取站点信息

```typescript
const response = await apiClient.sites.listClientSites({
  page: 1,
  size: 10
})

const sites = response.data.list
```

### 获取文档列表

```typescript
const response = await apiClient.documents.listClientDocuments({
  siteId: 1,
  page: 1,
  size: 20,
  excludeContent: true  // 不返回内容，加速加载
})

const docs = response.data.list
```

### 获取文档详情

```typescript
const response = await apiClient.documents.getClientDocument({
  documentId: 1
})

const doc = response.data
```

### 通过 slug 获取站点

```typescript
const response = await apiClient.sites.getClientSiteBySlug({
  slug: "my-site"
})

const site = response.data
```

### 获取会话列表

```typescript
const response = await apiClient.chatSessions.listChatSessions({
  tenantSlug: "company-a", // 跨站点拉取
  keyword: "搜索内容",
  memberId: "user-123",
  page: 1,
  size: 20
})

const sessions = response.data.items
```

### AI 对话

```typescript
const response = await fetch("/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: [{ role: "user", content: "你好" }],
    stream: true,
    filter: { site_id: 1 }
  })
})
```

---

## 📖 详细文档

完整的 API 文档请访问：http://localhost:3000/docs

---

## 📚 相关文档

- [API 概览](/development/api/overview)
- [Admin API](/development/api/admin)
- [SDK 使用指南](/development/tech/sdk-usage)
