# Client 前端开发

本文档提供 Client 客户端（对话界面）前端的开发指南。

## 🏗️ 技术栈

- **框架**: Next.js 14+ (App Router)
- **语言**: TypeScript 5.x
- **样式**: Tailwind CSS
- **Markdown 渲染**: streamdown (支持流式动画渲染)
- **AI 对话交互**: 支持打字机效果、流式更新
- **包管理**: pnpm

---

## 📁 项目结构

```
frontend/client/
├── src/
│   ├── app/                # 页面路由
│   ├── components/         # 组件库
│   │   ├── ai/            # AI 对话核心组件 (MessageList, ChatBar 等)
│   │   └── features/      # 业务功能组件
│   ├── hooks/             # 对话控制与状态 Hooks (useAIChat)
│   ├── lib/
│   │   └── sdk/           # 自动生成的 SDK
│   └── stores/            # 状态管理
└── public/                 # 静态资源
```

---

## 🚀 快速开始

### 1. 环境初始化

在项目根目录下执行：
```bash
make dev-init
```

### 2. 启动服务 (Docker)

```bash
# 在项目根目录启动全栈环境
make dev-up
```
访问地址：`http://localhost:8002`

### 3. 本地独立运行

```bash
cd frontend/client
pnpm install
pnpm dev
```

---

## 📝 核心开发指南

### AI 对话集成

对于 Client 端，最重要的逻辑是处理 AI 流式反馈。我们提供了统一的 `useAIChat` Hook：

```typescript
import { useAIChat } from '@/hooks/useAIChat'

const { messages, sendMessage, isLoading } = useAIChat({
  siteId: currentSiteId
})

// 发送消息
const handleSend = async (text: string) => {
  await sendMessage(text)
}
```

### 网页挂件 (Widget) 模式

Client 前端不仅支持独立页面展示，还支持作为“网页挂件”嵌入第三方网站。其核心逻辑共用了 `components/ai` 下的对话组件。
- 挂件集成方式详见：[网页挂件机器人说明](/development/tech/widget-integration)

### 消息渲染

为保证 AI 输出的流畅性，系统采用了流式 Markdown 渲染技术。在修改 `components/ai/MessageItem` 时，请注意保持对动画效果的支持。

---

## 📚 相关文档

- [AI 对话与知识库检索](/development/tech/ai-chat-architecture)
- [SDK 使用指南](/development/tech/sdk-usage)
- [网页挂件机器人](/development/tech/widget-integration)
