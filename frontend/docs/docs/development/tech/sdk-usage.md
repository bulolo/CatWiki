# API SDK 与 客户端使用指南

CatWiki 的 API 调用体系分为两层：底层的 **自动生成 SDK** 与上层的 **手动封装客户端 (API Client)**。

## 1. 架构深度解析

为了平衡开发效率与代码健壮性，我们采用了两层架构：

### 底层：自动生成 SDK (`@/lib/sdk`)
- **来源**：通过 `make gen-sdk` 工具基于后端的 OpenAPI (Swagger) 定义自动生成。
- **职责**：提供原始接口定义。Admin 端生成 `CatWikiAdminSdk`，Client 端生成 `CatWikiClientSdk`。
- **注意**：**不要手动修改此目录下的任何代码**。

### 上层：封装客户端 (`@/lib/api-client`)
- **职责**：
    - **单例化**：预配置 `BASE_URL` 并初始化 SDK 实例。
    - **认证注入**：Admin 端自动注入 Bearer Token。
    - **统一拦截**：处理 401 自动跳转等逻辑。
    - **类型重导出**：导出 `Models` 命名空间，提供完整的类型提示。

---

## 2. 引入与使用

**推荐方式**：统一使用封装好的 `api` 对象，并配合 `Models` 命名空间使用类型。

### 示例代码
```typescript
import { api, Models } from '@/lib/api-client' 

// 1. 调用接口
const sites = await api.site.list({ page: 1 })

// 2. 使用类型 (推荐 Models 命名空间)
const newSite: Models.SiteCreate = {
  name: '我的新站点',
  slug: 'my-site'
}
```

---

## 3. 分端说明 (Admin vs Client)

底层 SDK 在生成的服务命名上存在细微差别：

| 特性 | 管理端 (Admin) | 展示端 (Client) |
| :--- | :--- | :--- |
| **生成的类名** | `CatWikiAdminSdk` | `CatWikiClientSdk` |
| **服务命名空间** | `adminSites`, `adminDocuments`... | `sites`, `documents`... |
| **认证方式** | 必须携带 Token | 默认公开访问 |

---

## 4. 扩展指南：如何增加新的 API？

如果你在后端新增了一个接口（例如 `GET /admin/sites/my-action`）：

1.  **同步 SDK**：
    ```bash
    make gen-sdk
    ```
2.  **完善封装**：在 `lib/api-client.ts` 中找到对应的模块进行封装。
    ```typescript
    // 以 Admin 端为例
    const siteApi = {
      // ...
      myNewAction: (id: number) => 
        wrapResponse<Models.ActionResult>(client.adminSites.myNewAction({ id })),
    }
    ```
3.  **UI 调用**：
    ```typescript
    const res = await api.site.myNewAction(123)
    ```

---

## 5. 类型安全最佳实践

**强烈建议** 使用 `Models` 命名空间，而不是从深层路径引入。

```typescript
// ✅ 推荐：由 api-client 统一导出的命名空间
import { Models } from '@/lib/api-client'
type Site = Models.Site

// ❌ 不推荐：路径依赖过深且不可控
import type { Site } from '@/lib/sdk/models/Site'
```

---

## 6. 常见问题

**Q: 运行 `make gen-sdk` 报错？**
A: 请确保后端服务已启动（`make dev-up`），因为脚本需要访问 `http://localhost:3000/openapi-admin.json` 获取最新的接口定义。
