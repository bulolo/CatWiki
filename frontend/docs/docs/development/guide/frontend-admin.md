# Admin 前端开发

本文档提供 Admin 管理后台前端的开发指南。

## 🏗️ 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript 5.3+
- **样式**: Tailwind CSS
- **组件库**: shadcn/ui
- **状态管理**: React Hooks
- **包管理**: pnpm

---

## 📁 项目结构

```
frontend/admin/
└── src/
    ├── app/                # 页面路由
    ├── components/         # React 组件
    │   ├── features/      # 业务组件
    │   ├── layout/        # 布局组件
    │   └── ui/            # shadcn/ui 组件
    ├── lib/sdk/           # 自动生成的 SDK
    └── hooks/             # 自定义 Hooks
```

---

## 🚀 快速开始

### 本地开发

```bash
cd frontend/admin

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

访问：http://localhost:8001

---

## 📝 开发指南

### 使用 SDK

```typescript
import { apiClient } from '@/lib/sdk'

// 获取站点列表
const response = await apiClient.wikiSites.listWikiSites({
  page: 1,
  size: 10
})
```

### 添加新页面

1. 在 `src/app/` 创建路由目录
2. 创建 `page.tsx` 文件
3. 使用 shadcn/ui 组件构建 UI

### 使用自定义 Hooks

```typescript
import { useAutosave } from '@/hooks/useAutosave'

// 自动保存
const { isSaving, lastSavedTime } = useAutosave({
  data: formData,
  onSave: async (data) => {
    await apiClient.documents.updateDocument({ id, requestBody: data })
  }
})
```

---

## 📚 相关文档

- [SDK 使用指南](/development/tech/sdk-usage)
- [快速开始](/development/start/quick-start)
