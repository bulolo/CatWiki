# 前端 SDK 使用指南

CatWiki 前端通过 `make gen-sdk` 基于后端 OpenAPI 自动生成 TypeScript SDK,使用 [orval](https://orval.dev/) (mode=tags + react-query) 产出。

## 1. 生成与产物

```bash
make gen-sdk
```

依赖运行中的后端(默认 `http://localhost:3000`)。脚本会:

1. 拉 `/openapi-admin.json` 和 `/openapi-client.json`
2. 规范化 OpenAPI 3.1 binary 字段、展平 `ApiResponse_X` envelope
3. 调用各项目内的 `orval.config.ts`,按 OpenAPI tag 拆分生成

产物布局(`frontend/admin/src/lib/sdk/` 与 `frontend/client/src/lib/sdk/`):

```
sdk/
  admin-sites.ts          # 每个 OpenAPI tag 一个文件
  admin-documents.ts      # 内含 fetcher + queryKey + useQuery/useMutation hooks
  ee-admin-sites.ts       # ee-* 前缀为 EE 专属 tag
  ...
  sdk.schemas.ts          # 所有 schema 类型(Site / Document / ...)
```

> ⚠️ **不要手动修改 `sdk/` 下任何文件** —— 下次 `make gen-sdk` 会被 `clean: true` 全量覆盖。

## 2. 在业务代码中使用

**直接从 `@/lib/sdk/<tag>` import**,无 barrel,无包装层。tag 名一目了然反映 API 归属:

```typescript
// 函数 + hooks(自动按 tag 分文件)
import {
  listAdminSites,
  useListAdminSites,
  useCreateAdminSite,
  getListAdminSitesQueryKey,
} from '@/lib/sdk/admin-sites'

// Schema 类型(统一在 sdk.schemas)
import type { Site, SiteCreate, SiteUpdate } from '@/lib/sdk/sdk.schemas'

// 业务异常类型
import { ApiError } from '@/lib/custom-fetch'      // admin
import { HttpError } from '@/lib/custom-fetch'     // client
```

### 调用风格

orval 同时产 fetcher 函数和 react-query hooks,**绝大多数场景用 hooks**:

```tsx
function SiteList() {
  const { data, isLoading } = useListAdminSites({ page: 1, size: 20 })
  // data 已是解包后的业务数据(custom-fetch mutator 剥过 ApiResponse envelope)
  // 类型也已展平,无 data.data 嵌套
  return <ul>{data?.list.map(s => <li key={s.id}>{s.name}</li>)}</ul>
}
```

仅在 hook 外(loader / 事件 handler / 命令式调用)用 fetcher 函数:

```typescript
async function handleSubmit(payload: SiteCreate) {
  const site = await createAdminSite(payload)
  // ...
}
```

### Mutation + invalidation

orval 自动生成 `getListAdminSitesQueryKey()`,和 hook 的 `queryKey` 一致,**直接复用**避免手维护 key:

```tsx
const qc = useQueryClient()
const { mutate } = useCreateAdminSite({
  mutation: {
    onSuccess: () => qc.invalidateQueries({ queryKey: getListAdminSitesQueryKey() }),
  },
})
```

## 3. 设计要点

### 为什么不要 barrel(`@/lib/api-client`)

历史上业务侧统一从 `@/lib/api-client` 转发,但已废弃。原因:

- **静默漏失**:后端新增 tag 时 barrel 不会自动更新,业务 import 找不到只能等代码审查发现
- **失去 tree-shaking 保证**:`export *` 在某些链路会牵连整个 tag 文件进 chunk
- **隐藏归属**:`from '@/lib/api-client'` 看不出调用打到哪个域

`@/lib/sdk/<tag>` 路径自带语义,新增 tag 零维护。

### ApiResponse envelope 在 OpenAPI 层展平

后端响应统一裹 `{ code, msg, data }`。`generate_sdk.py` 在 spec 落盘前会把所有 `$ref: ApiResponse_X_` 替换为其 `data` 字段的 schema,同时 `custom-fetch.ts` 在运行时也剥一次 envelope。**类型与运行时对齐**,业务侧零 `data.data` 嵌套。

### 文件 / 二进制字段

FastAPI 0.115+ 输出 OpenAPI 3.1 `contentMediaType` 表达 multipart 文件。orval 8.x 仍只识别 3.0 的 `format: binary`,脚本会就地改写,业务侧 `File` / `Blob` 类型正确无需绕。

## 4. 后端新增接口的流程

1. 后端加路由,确保 `tags=["xxx"]` 设置正确
2. 重启 backend(或确保 dev 模式 hot reload 生效)
3. `make gen-sdk`
4. 业务侧直接 `import { useXxxYyy } from '@/lib/sdk/xxx'`

无需任何手动 barrel / 封装层维护。

## 5. 常见问题

**Q: `make gen-sdk` 报连接错误?**
A: 后端没在 `http://localhost:3000` 上响应。先 `make dev-up`,或设置 `SDK_API_URL` 指向实际后端地址。

**Q: 生成后 tsc 报某 schema 类型缺失?**
A: 确认后端是否将该 schema 真正暴露给了对应 prefix(admin / client)。`filter_openapi_by_prefix` 只暴露被路由引用的 schema。

**Q: 已经有 fetcher 函数为什么还要 hook?**
A: hook 自动接入 react-query 的缓存、refetch、stale time 体系,绝大多数场景应优先 hook。fetcher 仅用于命令式调用(form submit / loader / 串行依赖)。
