# 后端开发

本文档提供后端开发的详细指南。

## 🏗️ 技术栈

- **框架**: FastAPI
- **数据库**: PostgreSQL + SQLAlchemy 2.0 (支持异步与向量检索)
- **迁移工具**: Alembic
- **包管理**: [uv](https://github.com/astral-sh/uv) (推荐)
- **AI 框架**: LangChain / LangGraph
- **身份认证**: JWT + PassLib
- **Python 版本**: >= 3.12 (必须)
- **平台集成**: lark-oapi (飞书), dingtalk-stream (钉钉)

---

## 📁 项目结构

```
backend/
├── app/
│   ├── api/                 # API 路由 (Admin & Client)
│   ├── core/                # 核心逻辑 (Integration, Shared, etc.)
│   ├── crud/                # 数据库 CRUD 操作
│   ├── db/                  # 数据库连接与配置
│   ├── models/              # SQLAlchemy ORM 模型
│   ├── schemas/             # Pydantic 数据模式
│   ├── services/            # 业务逻辑编排 (如机器人回复)
│   └── main.py              # 应用入口 (FastAPI App)
├── alembic/                 # 数据库迁移脚本
├── scripts/                 # 维护脚本 (SDK 生成, License 注入等)
└── pyproject.toml           # 项目依赖与配置
```

---

## 🚀 快速开始

### 环境初始化

在项目根目录下执行：
```bash
make dev-init
```

### 开发模式启动 (Docker)

推荐使用 Docker 快速启动全栈环境：
```bash
# 启动所有服务 (后端、前端、数据库)
make dev-up
```

### 本地原生启动 (后端)

如果您需要直接在主机上运行后端：
```bash
cd backend

# 安装并同步依赖
uv sync

# 启动服务器
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 3000
```

---

## 📝 常用开发命令

### 1. 数据库管理
- **进入 psql**: `make dev-db-psql`
- **生成迁移**: `make dev-db-migrate m="描述"`
- **手动升级**: `make dev-db-upgrade`
- **深度清理**: `make dev-clean` (重置数据库与存储)

### 2. 代码维护与工具
- **代码格式化**: `make format` (运行 ruff 对后端代码进行格式化与 lint 修复)
- **License 注入**: `make license` (自动为所有 `.py`, `.ts`, `.tsx`, `.go` 文件注入 License Header)
- **生成 SDK**: `make gen-sdk` (修改 Pydantic schemas 后必跑)

### 3. CE (社区版) 同步
- **同步代码**: `make sync-ce` (将 EE 代码同步并过滤生成 CE 版)
- **发布代码**: `make publish-ce-github` (推送至 GitHub 公开仓库)
- **发布镜像**: `make publish-ce-images` (构建 CE 镜像并推送到 Docker Hub)

---

## 📚 相关文档

- [AI 对话核心架构](/development/tech/ai-chat-architecture)
- [API 概览](/development/api/overview)
- [机器人集成指南系列](/development/bots/feishu-app)
- [RustFS 使用手册](/development/tech/rustfs)
