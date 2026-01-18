# 项目介绍

<div align="center">

<img src="/logo.png" width="120" alt="CatWiki Logo">

# CatWiki / 知几喵

**企业级AI知识库平台**

一个功能完善的知识库平台，提供强大的内容管理、AI 智能问答和现代化的用户体验

<p align="center" style="display: flex; justify-content: center; gap: 8px; flex-wrap: wrap;">
  <a href="https://fastapi.tiangolo.com/" target="_blank"><img src="https://img.shields.io/badge/FastAPI-0.104+-009688?logo=fastapi" alt="FastAPI"></a>
  <a href="https://nextjs.org/" target="_blank"><img src="https://img.shields.io/badge/Next.js-14.0+-000000?logo=next.js" alt="Next.js"></a>
  <a href="https://www.typescriptlang.org/" target="_blank"><img src="https://img.shields.io/badge/TypeScript-5.3+-3178C6?logo=typescript" alt="TypeScript"></a>
  <a href="https://www.postgresql.org/" target="_blank"><img src="https://img.shields.io/badge/PostgreSQL-15+-336791?logo=postgresql" alt="PostgreSQL"></a>
</p>

[GitHub](https://github.com/bulolo/CatWiki) | [官方网站](http://catwiki.cn)

</div>

---

## 🎯 项目亮点

- ✅ **开箱即用**: Docker Compose 一键启动，自动初始化数据库和演示数据
- ✅ **双端架构**: 独立的管理后台和客户端，职责清晰
- ✅ **类型安全**: 前后端全面使用 TypeScript 和 Pydantic，类型安全有保障
- ✅ **现代技术栈**: FastAPI + Next.js 14 + SQLAlchemy 2.0，使用最新技术
- ✅ **AI 集成**: 内置 AI 智能问答，基于 Vercel AI SDK
- ✅ **热更新**: 开发环境支持前后端代码热更新
- ✅ **自动生成 SDK**: 后端 API 变更后自动生成 TypeScript SDK
- ✅ **完善的文档**: 详细的 API 文档和使用指南

---

## 📸 应用截图

### 🎯 管理后台

<table>
  <tbody>
  <tr>
    <td width="50%">
      <img src="/images/screenshots/1.png" alt="运营概览">
      <p align="center"><b>运营概览</b><br>实时查看站点运行状态和关键指标</p>
    </td>
    <td width="50%">
      <img src="/images/screenshots/2.png" alt="文档管理">
      <p align="center"><b>文档管理</b><br>层级目录结构,支持批量操作</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="/images/screenshots/3.png" alt="用户管理">
      <p align="center"><b>用户管理</b><br>完整的用户权限和角色管理</p>
    </td>
    <td width="50%">
      <img src="/images/screenshots/4.png" alt="系统设置">
      <p align="center"><b>系统设置</b><br>灵活的 AI 模型配置</p>
    </td>
  </tr>
  </tbody>
</table>

### 💬 客户端

<div align="center">
  <img src="/images/screenshots/5.png" alt="AI 智能问答" width="80%">
  <p><b>AI 智能问答</b> - 基于知识库内容的智能对话助手，支持上下文理解</p>
</div>

---

## 🏗️ 技术架构

### 后端技术栈
- **框架**: FastAPI
- **数据库**: PostgreSQL + SQLAlchemy 2.0
- **迁移工具**: Alembic
- **包管理**: uv (高性能 Python 包管理器)
- **身份认证**: JWT + PassLib
- **Python 版本**: >= 3.10

### 前端技术栈
- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript 5.3+
- **样式**: Tailwind CSS
- **组件库**: shadcn/ui (基于 Radix UI)
- **状态管理**: React Hooks
- **包管理**: pnpm

### 特色功能库
- **拖拽排序**: @dnd-kit/core + @dnd-kit/sortable (管理后台)
- **Markdown 编辑**: md-editor-rt (管理后台)
- **AI 集成**: Vercel AI SDK (ai + @ai-sdk/react) (客户端)
- **Markdown 渲染**: streamdown (客户端)
- **通知系统**: Sonner (前端通用)

---

## 📁 项目结构

```
catWiki/
├── backend/                      # 🐍 FastAPI 后端服务
│   ├── app/
│   │   ├── api/                 # API 路由
│   │   │   ├── admin/          # 管理后台 API（完整 CRUD + 认证）
│   │   │   └── client/         # 客户端 API（只读 + 公开）
│   │   ├── core/                # 核心配置、中间件、工具
│   │   ├── crud/                # 数据库 CRUD 操作
│   │   ├── models/              # SQLAlchemy ORM 模型
│   │   ├── schemas/             # Pydantic 验证模式
│   │   └── main.py              # 应用入口
│   ├── alembic/                 # 数据库迁移
│   ├── scripts/                 # 工具脚本（创建用户、生成 SDK、初始化数据）
│   ├── Dockerfile.dev           # 开发环境镜像
│   ├── Dockerfile.prod          # 生产环境镜像
│   └── pyproject.toml           # 依赖管理（uv）
│
├── frontend/
│   ├── admin/                   # 🎯 管理后台（Next.js，端口 8001）
│   │   └── src/
│   │       ├── app/            # 页面路由
│   │       ├── components/     # React 组件
│   │       ├── lib/sdk/       # 自动生成的 TypeScript SDK
│   │       └── hooks/         # 自定义 React Hooks
│   │
│   ├── client/                  # 💬 客户端前端（Next.js，端口 8002）
│   │   └── src/
│   │       ├── app/            # 页面路由
│   │       ├── components/     # React 组件
│   │       ├── lib/sdk/       # 自动生成的 TypeScript SDK
│   │       └── layout/        # 侧边栏、站点切换
│   │
│   └── docs/                    # 📚 文档站点（VitePress，端口 8003）
│       └── docs/               # 文档内容
│
├── deploy/                      # 🚀 生产环境部署
│   └── docker/                 # Docker Compose 部署
│
├── docker-compose.dev.yml       # 开发环境一键启动
├── LICENSE                      # AGPL-3.0 许可证
└── README.md                    # 项目文档
```

---

## 📄 许可证

本项目采用 **GNU Affero General Public License v3.0 (AGPL-3.0)** 许可证。

### 📋 许可证说明

- ✅ **自由使用**: 你可以自由使用、修改和分发本软件
- ✅ **开源要求**: 你必须以相同的许可证开源你的修改
- ✅ **网络服务**: 如果你通过网络提供服务，也必须开源你的代码
- ✅ **商业使用**: 允许商业使用，但需要遵守相同的开源要求

详见 [许可证页面](/about/team/license) 获取完整信息。

---

## ✨ 核心特性

### 🎯 管理后台
- **富文本编辑**: Markdown 实时预览、代码高亮、图片管理
- **文档管理**: 层级目录、拖拽排序、批量操作、版本管理
- **用户管理**: 完整的权限控制、角色管理、邀请机制
- **多站点**: 支持创建多个独立知识库站点，独立域名配置
- **AI 配置**: 灵活配置 LLM 模型、Embedding 模型及 Prompt

### 💬 客户端
- **智能搜索**: 全文检索、关键词高亮、快速定位
- **AI 问答**: 基于知识库的智能对话、引用溯源、流式输出
- **响应式**: 完美适配桌面与移动端，深色模式支持
- **现代化 UI**: 基于 shadcn/ui 的优雅设计

### 🔧 技术优势
- **类型安全**: 前后端 TypeScript + Pydantic 全链路类型安全
- **自动化**: 自动生成前端 SDK、自动数据库迁移、自动向量化
- **高性能**: PostgreSQL pgvector 向量搜索、Redis 缓存支持
- **对象存储**: 支持 RustFS/MinIO，兼容 S3 协议
- **安全**: JWT 认证、RBAC 权限、SQL 注入/XSS 防护

---

---

## 📮 联系方式

- 💬 **问题反馈**: 通过 [GitHub Issues](https://github.com/bulolo/CatWiki/issues) 提交
- 📧 **商务合作**: 82607314@qq.com / bulolo(微信)
- 🌐 **官方网站**: http://catwiki.cn

---

<div align="center">

**⭐ 如果这个项目对您有帮助，请给我们一个 Star！**

Made with ❤️ by CatWiki Team

</div>
