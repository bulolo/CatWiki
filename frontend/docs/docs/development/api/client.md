# Client API

Client API 提供只读访问，无需认证，仅返回已发布的内容。

## 🌐 公开访问

Client API 不需要身份认证，可以直接访问。

---

## 📚 API 端点

### 站点信息

- `GET /api/v1/sites` - 获取已发布站点列表
- `GET /api/v1/sites/{id}` - 获取站点详情
- `GET /api/v1/sites/by-domain/{domain}` - 通过域名获取站点

### 文档浏览

- `GET /api/v1/documents` - 获取已发布文档列表
- `GET /api/v1/documents/{id}` - 获取文档详情（自动增加浏览量）

### 合集浏览

- `GET /api/v1/collections/tree` - 获取合集树（仅已发布内容）

### 文件访问

- `GET /api/v1/files/download/{path}` - 下载文件
- `GET /api/v1/files/presigned-url/{path}` - 获取预签名 URL

---

## 💡 使用示例

### 获取站点信息

```typescript
const response = await apiClient.wikiSites.listWikiSites({
  page: 1,
  size: 10
})

const sites = response.data.list
```

### 获取文档列表

```typescript
const response = await apiClient.documents.listDocuments({
  siteId: 1,
  page: 1,
  size: 20,
  excludeContent: true  // 不返回内容，加速加载
})

const docs = response.data.list
```

### 获取文档详情

```typescript
const response = await apiClient.documents.getDocument({
  id: 1
})

const doc = response.data
```

---

## 📖 详细文档

完整的 API 文档请访问：http://localhost:3000/docs

---

## 📚 相关文档

- [API 概览](/development/api/overview)
- [Admin API](/development/api/admin)
- [SDK 使用指南](/development/tech/sdk-usage)
