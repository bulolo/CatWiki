# Admin API

Admin API 提供完整的 CRUD 操作和管理功能，需要身份认证。

## 🔐 认证

所有 Admin API 都需要 JWT Token 认证。

### 获取 Token

```typescript
const response = await apiClient.users.login({
  requestBody: {
    email: "admin@example.com",
    password: "admin123"
  }
})

const token = response.data.access_token
```

### 使用 Token

```typescript
// 在请求头中添加 Token
headers: {
  'Authorization': `Bearer ${token}`
}
```

---

## 📚 API 端点

### 用户管理

- `POST /admin/api/v1/users/login` - 用户登录
- `GET /admin/api/v1/users` - 获取用户列表
- `POST /admin/api/v1/users` - 创建用户
- `PUT /admin/api/v1/users/{id}` - 更新用户
- `DELETE /admin/api/v1/users/{id}` - 删除用户

### 站点管理

- `GET /admin/api/v1/sites` - 获取站点列表
- `POST /admin/api/v1/sites` - 创建站点
- `PUT /admin/api/v1/sites/{id}` - 更新站点
- `DELETE /admin/api/v1/sites/{id}` - 删除站点

### 文档管理

- `GET /admin/api/v1/documents` - 获取文档列表
- `POST /admin/api/v1/documents` - 创建文档
- `PUT /admin/api/v1/documents/{id}` - 更新文档
- `DELETE /admin/api/v1/documents/{id}` - 删除文档
- `POST /admin/api/v1/documents/{id}/vectorize` - 向量化文档

### 合集管理

- `GET /admin/api/v1/collections` - 获取合集列表
- `GET /admin/api/v1/collections/tree` - 获取合集树
- `POST /admin/api/v1/collections` - 创建合集
- `PUT /admin/api/v1/collections/{id}` - 更新合集
- `DELETE /admin/api/v1/collections/{id}` - 删除合集

---

## 📖 详细文档

完整的 API 文档请访问：http://localhost:3000/docs

---

## 📚 相关文档

- [API 概览](/development/api/overview)
- [Client API](/development/api/client)
- [SDK 使用指南](/development/tech/sdk-usage)
