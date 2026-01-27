# 项目介绍

<div align="center">

<img src="/logo.png" width="120" alt="CatWiki Logo">

# CatWiki

**企业级AI知识库平台**

企业级全栈 AI 知识库平台，集成了现代化的内容管理、深度 AI 智能问答与极致的用户交互体验。

<p align="center" style="display: flex; justify-content: center; gap: 8px; flex-wrap: wrap;">
  <a href="https://fastapi.tiangolo.com/" target="_blank"><img src="https://img.shields.io/badge/FastAPI-0.104+-009688?logo=fastapi" alt="FastAPI"></a>
  <a href="https://nextjs.org/" target="_blank"><img src="https://img.shields.io/badge/Next.js-14.0+-000000?logo=next.js" alt="Next.js"></a>
  <a href="https://www.typescriptlang.org/" target="_blank"><img src="https://img.shields.io/badge/TypeScript-5.3+-3178C6?logo=typescript" alt="TypeScript"></a>
  <a href="https://www.postgresql.org/" target="_blank"><img src="https://img.shields.io/badge/PostgreSQL-15+-336791?logo=postgresql" alt="PostgreSQL"></a>
</p>

[GitHub](https://github.com/bulolo/CatWiki) | [官方网站](http://catwiki.cn)

</div>



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



## ✨ 核心特性

### 🎯 管理后台 (Admin)
- **📝 富文本编辑**: 基于 Markdown 的文档编辑器，支持实时预览、代码高亮和图片上传
- **🗂️ 文档管理**: 层级目录结构，支持无限级分类、拖拽排序、批量操作及版本管理
- **👥 用户管理**: 完善的 RBAC 权限控制、角色管理及邀请注册机制
- **🌐 多站点支持**: 支持创建和管理多个独立的知识库站点，支持独立域名配置
- **🤖 AI 配置**: 灵活配置不同的 LLM 模型、Embedding 模型及 Prompt 策略

### 💬 客户端 (Client)
- **🤖 AI 智能问答**: 基于知识库内容的对话助手，支持上下文理解、流式输出及引用溯源
- **🔍 智能搜索**: 基于向量检索（pgvector）的全文搜索，关键词高亮显示
- **📱 响应式设计**: 完美适配桌面与移动端，提供优雅的现代 UI 交互
- **🎨 个性化界面**: 优雅的界面设计（基于 shadcn/ui），支持深色模式

### 🔧 技术优势 (Technical)
- ✅ **开箱即用**: 提供 Docker Compose 一键启动，支持全自动数据库迁移与数据初始化
- ✅ **全链路类型安全**: 前后端跨层级使用 TypeScript 和 Pydantic，确保代码稳健
- ✅ **全自动 SDK 同步**: 后端 API 变更后通过脚本自动同步生成前端 TypeScript SDK
- ✅ **高性能架构**: 使用 FastAPI + SQLAlchemy 2.0，集成 Redis 缓存与 pgvector 向量搜索
- ✅ **灵活的对象存储**: 兼容 S3 协议，内置 RustFS 支持，也可接入 MinIO 或阿里云 OSS
- ✅ **开发者友好**: 开发环境支持前后端热更新，提供完善的 API 交互文档（Swagger）

---

<div align="center">

**⭐ 如果这个项目对您有帮助，请给我们一个 Star！**

Made with ❤️ by CatWiki Team

</div>
