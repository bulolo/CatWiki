# Client 前端开发

本文档提供 Client 客户端前端的开发指南。

## 🏗️ 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript 5.3+
- **样式**: Tailwind CSS
- **组件库**: shadcn/ui
- **Markdown 渲染**: streamdown
- **包管理**: pnpm

---

## 📁 项目结构

```
frontend/client/
└── src/
    ├── app/                # 页面路由
    ├── components/         # React 组件
    │   ├── ai/            # AI 对话组件
    │   └── features/      # 业务组件
    ├── lib/sdk/           # 自动生成的 SDK
    └── layout/            # 布局组件
```

---

## 🚀 快速开始

### 本地开发

```bash
cd frontend/client

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

### Docker 开发

```bash
# 在项目根目录
make dev-up
```

访问：http://localhost:8002

---

## 📝 开发指南

### 使用 SDK

```typescript
import { apiClient } from '@/lib/sdk'

// 获取文档列表
const response = await apiClient.documents.listDocuments({
  siteId: 1,
  page: 1,
  size: 20
})
```

### AI 对话集成

```typescript
import { useAIChat } from '@/hooks/useAIChat'

const { messages, input, handleInputChange, handleSubmit } = useAIChat({
  siteIdOrDomain: 'medical'
})
```

---

## 📚 相关文档

- [SDK 使用指南](/development/tech/sdk-usage)
- [快速开始](/development/start/quick-start)
