# API SDK 与 客户端使用指南

CatWiki 的 API 调用体系分为两层：底层的 **自动生成 SDK** 与上层的 **手动封装客户端 (API Client)**。

## 1. 架构深度解析

为了平衡开发效率与代码健壮性，我们采用了两层架构：

### 底层：自动生成 SDK (`@/lib/sdk`)
- **来源**：通过 `make gen-sdk` 工具基于后端的 OpenAPI (Swagger) 定义自动生成。
- **职责**：提供所有原始接口的定义、请求参数类型以及响应模型。
- **注意**：**不要手动修改此目录下的任何代码**，因为下次生成时会被覆盖。

### 上层：封装客户端 (`@/lib/api-client`)
- **来源**：手工维护的薄封装层。
- **职责**：
    - **单例化**：预配置 `BASE_URL` 和初始化 SDK 实例。
    - **认证注入**：自动从本地存储获取 Token 并注入 Request Header。
    - **全局拦截**：统一处理 401 (未授权) 自动跳转登录页等通用逻辑。
    - **常用模型重导出**：为了方便开发，将最常用的 `Site`, `Document` 等类型集中在此处导出。

---

## 2. 引入与使用

项目中 **严禁** 直接从 `@/lib/sdk` 引入方法，**必须** 统一使用封装好的 `api` 对象。

### 统一引入方式
```typescript
import { api } from '@/lib/api-client' 
// 常用模型也可以直接从此处引入
import type { Site, Document } from '@/lib/api-client'

// 使用示例
const response = await api.site.list({ page: 1 })
```

---

## 3. 分端说明 (Admin vs Client)

项目包含两套 SDK，分别对应不同的使用场景：

### 管理端 (Admin)
- **SDK**: `CatWikiAdminSdk`
- **接口范围**: 包含所有管理功能（站点配置、用户权限、系统设置）。
- **认证**: 必须提供有效 Token。

### 展示端 (Client)
- **SDK**: `CatWikiClientSdk`
- **接口范围**: 仅包含公开数据接口（文档阅读、公开合集、搜索）。
- **认证**: 通常不需要 Token（或仅限公开访问权限）。

---

## 4. 扩展指南：如何增加新的 API？

如果你在后端新增了一个接口，请按照以下步骤同步到前端：

1.  **后端定义**：确保你的 FastAPI Endpoint 已定义 `operation_id`（建议遵循 `actionRoleNoun` 规范）。
2.  **同步 SDK**：在项目根目录运行以下命令：
    ```bash
    make gen-sdk
    ```
    这将更新 `frontend/admin/src/lib/sdk` 和 `frontend/client/src/lib/sdk`。
3.  **完善封装**：打开对应的 `src/lib/api-client.ts`，在对应的 `xxxApi` 对象中添加新方法。
    ```typescript
    // 示例：在 admin/api-client.ts 中添加方法
    const siteApi = {
      // ... 现有方法
      myNewAction: (params: any) => client.adminSites.myNewAction(params),
    }
    ```
4.  **UI 调用**：在组件中使用：
    ```typescript
    const res = await api.site.myNewAction(...)
    ```

---

## 5. 核心区别参考

| 特性 | 底层 SDK (`@/lib/sdk`) | 封装客户端 (`@/lib/api-client`) |
| :--- | :--- | :--- |
| **维护方式** | 机器自动生成 | 人工手动维护 |
| **状态** | 裸类定义 | 已配置的单例对象 |
| **认证处理** | 需手动传入 Token | **自动注入 Token** |
| **错误拦截** | 无 | **全局 401 拦截与跳转** |
| **使用建议** | 仅作为类型参考 | **开发首选调用方式** |

---

## 6. 类型安全建议

尽量不要直接引用 `lib/sdk/models` 下的深层路径。我们已经在 `api-client.ts` 中重导出了大部分常用类型。

```typescript
// ✅ 推荐：简洁明了
import type { Site, Document } from '@/lib/api-client'

// ❌ 不推荐：路径过深，且可能因 SDK 重新生成而变动
import type { Site } from '@/lib/sdk/models/Site'
```
