# Client API

Client API 提供只读访问，无需认证，仅返回已发布的内容。

## 🌐 公开访问

Client API 不需要身份认证，可以直接访问。

---

---

## 📚 API 端点

> [!IMPORTANT]
> **关于路径中的冒号 (`:`)**
> 本项目遵循 Google API 设计指南中的自定义方法规范。诸如 `:tree`, `:bySlug`, `:info` 等后缀是直接加在资源路径后的动作标识，**中间没有斜杠**。
> - ✅ 正确：`/v1/sites:bySlug/my-site`
> - ❌ 错误：`/v1/sites/bySlug/my-site`

### 站点信息

- `GET /v1/sites` - 获取已发布站点列表（支持 `is_pager`、`tenant_id`、`tenant_slug`、`keyword`）
- `GET /v1/sites/{id}` - 获取站点详情（含 EE 字段：`is_public`、`requires_password`、`has_password`）
- `GET /v1/sites:bySlug/{slug}` - 通过 slug 获取站点

#### EE 站点访问 👑 (企业版专属)

- `GET /v1/client/sites/{slug}/access-status` - 获取站点访问状态（`is_public`、`requires_password`、`has_password`）
- `POST /v1/client/sites/{slug}/verify-password` - 验证站点访问密码，返回短期 `access_token`（有效期 24 小时）

### 文档浏览

- `GET /v1/documents` - 获取已发布文档列表（支持 `is_pager`、`site_id`、`collection_id`、`keyword`、`exclude_content`、`include_site_info`、`tenant_id`）
- `GET /v1/documents/{id}` - 获取文档详情（自动增加浏览量，记录 IP/UA/referer 浏览事件）

### 合集浏览

- `GET /v1/collections:tree` - 获取合集树（仅已发布内容，`site_id` 必填，`include_documents` 控制是否含文档节点）

### 文件访问

- `GET /v1/files/{object_name}:download` - 下载文件
- `GET /v1/files/{object_name}:info` - 获取文件信息
- `GET /v1/files/{object_name}:presignedUrl` - 获取预签名 URL

### AI 对话

- `POST /v1/chat/responses` - 创建 AI 响应（OpenAI Responses API 规范，含 `filter` 扩展字段）

### 会话记录

- `GET /v1/chat/sessions` - 获取会话列表（`member_id` **必填**、`site_id`、`keyword`、`page`、`size`、`is_pager`、`tenant_id`）
- `GET /v1/chat/sessions/{thread_id}` - 获取会话详情（元数据）
- `GET /v1/chat/sessions/{thread_id}/messages` - 获取会话全量历史消息
- `GET /v1/chat/sessions/{thread_id}/tool-result/{tool_call_id}` - 获取单次 RAG 工具调用的检索结果
- `DELETE /v1/chat/sessions/{thread_id}` - 删除会话（`member_id` **必填**，校验所有权；同步清除 LangGraph Checkpointer 历史）

### 机器人 Webhook

- `GET /v1/bot/wecom-kefu` - 企业微信客服 URL 验证（`msg_signature`, `timestamp`, `nonce`, `echostr`, `site_id`）
- `POST /v1/bot/wecom-kefu` - 企业微信客服消息回调（XML 协议，`site_id` 必填）
- `GET /v1/bot/wecom-app` - 企业微信应用 URL 验证（`msg_signature`, `timestamp`, `nonce`, `echostr`, `site_id`）
- `POST /v1/bot/wecom-app` - 企业微信应用消息回调（XML 协议，`site_id` 必填）

### EE Bot API 👑 (企业版专属)

- `POST /v1/bot/chat/completions` - 站点专用聊天补全（`OpenAIChatCompletionRequest`，严格 OpenAI 兼容，`Authorization: Bearer <api_key>`）
- `GET /v1/bot/models` - 列出站点可用模型（`Authorization: Bearer <api_key>` 可选）

### 健康检查

- `GET /v1/health` - 健康检查（数据库状态）

---

## 💡 使用示例

> 前端通过 orval 生成的函数 / hooks 调用,具体规范见 [SDK 使用指南](/development/tech/sdk-usage)。`ApiResponse` envelope 已在 SDK 层展平,业务侧无 `response.data` 二次嵌套。

### 获取站点列表

```typescript
import { useListClientSites } from '@/lib/sdk/client-sites'

const { data } = useListClientSites({ page: 1, size: 10 })
const sites = data?.list
```

### 获取文档列表

```typescript
import { useListClientDocuments } from '@/lib/sdk/client-documents'

const { data } = useListClientDocuments({
  siteId: 1,
  page: 1,
  size: 20,
  excludeContent: true, // 不返回内容,加速加载
})
const docs = data?.list
```

### 获取文档详情

```typescript
import { useGetClientDocument } from '@/lib/sdk/client-documents'

const { data: doc } = useGetClientDocument(documentId)
```

### 通过 slug 获取站点

```typescript
import { useGetClientSiteBySlug } from '@/lib/sdk/client-sites'

const { data: site } = useGetClientSiteBySlug('my-site')
```

### 获取会话列表

```typescript
import { useListChatSessions } from '@/lib/sdk/client-chat-sessions'

const { data } = useListChatSessions({
  siteId: 1,
  keyword: "搜索内容",
  memberId: "user-123",
  page: 1,
  size: 20,
})
const sessions = data?.items
```

### AI 对话

```typescript
const response = await fetch("/v1/chat/responses", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: "你好",
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
