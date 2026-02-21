# Admin 前端开发

本文档提供 Admin 管理后台前端的开发指南。

## 🏗️ 技术栈

- **框架**: Next.js 14+ (App Router)
- **语言**: TypeScript 5.x
- **样式**: Tailwind CSS
- **组件库**: shadcn/ui
- **状态管理**: TanStack Query (React Query) / React Hooks
- **包管理**: pnpm
- **编译工具**: Turbopack (开发模式)

---

## 📁 项目结构

```
frontend/admin/
├── src/
│   ├── app/                # 页面路由 (Next.js App Router)
│   ├── components/         # 可复用组件
│   │   ├── features/      # 业务逻辑组件
│   │   └── ui/            # shadcn/ui 基础组件
│   ├── hooks/             # 自定义 React Hooks
│   ├── lib/
│   │   ├── sdk/           # 后端自动生成的 TypeScript SDK
│   │   └── utils.ts       # 通用工具函数
│   └── store/             # 状态存储 (如有)
├── public/                 # 静态资源
└── tailwind.config.ts      # Tailwind 配置
```

---

## 🚀 快速开始

### 1. 环境初始化

在项目根目录下执行：
```bash
make dev-init
```

### 2. 启动开发服务器 (Docker)

推荐使用 Docker 统一管理：
```bash
# 在项目根目录
make dev-up
```
访问地址：`http://localhost:8001`

### 3. 本地独立运行

如果您只想在本地运行前端以获得更快的热重载：
```bash
cd frontend/admin
pnpm install
pnpm dev
```

---

## 📝 开发规范

### SDK 使用原则

所有的后端交互都应通过 `src/lib/sdk` 提供的方法进行。

```typescript
import { apiClient } from '@/lib/sdk'

// 示例：获取站点列表
const fetchSites = async () => {
  const sites = await apiClient.sites.listSites()
  return sites
}
```

### 添加新组件

1. 如果是通用 UI 组件，使用 `npx shadcn-ui@latest add [component]`。
2. 如果是业务组件，放入 `src/components/features`。

### 权限与认证

管理后台主要通过 `middleware.ts` 或高阶组件（HOC）处理身份校验。请参考 `src/app/login` 的实现。

---

## 📚 相关文档

- [SDK 使用指南](/development/tech/sdk-usage)
- [API 概览](/development/api/overview)
- [后端开发指南](/development/guide/backend)
