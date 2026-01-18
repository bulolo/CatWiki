# 后端开发

本文档提供后端开发的详细指南。

## 🏗️ 技术栈

- **框架**: FastAPI
- **数据库**: PostgreSQL + SQLAlchemy 2.0
- **迁移工具**: Alembic
- **包管理**: uv
- **身份认证**: JWT + PassLib
- **Python 版本**: >= 3.10

---

## 📁 项目结构

```
backend/
├── app/
│   ├── api/                 # API 路由
│   │   ├── admin/          # 管理后台 API
│   │   └── client/         # 客户端 API
│   ├── core/                # 核心配置
│   ├── crud/                # 数据库操作
│   ├── models/              # ORM 模型
│   ├── schemas/             # Pydantic 模式
│   └── main.py              # 应用入口
├── alembic/                 # 数据库迁移
├── scripts/                 # 工具脚本
└── pyproject.toml           # 依赖管理
```

---

## 🚀 快速开始

### 本地开发

```bash
cd backend

# 安装依赖
uv sync

# 启动开发服务器
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 3000
```

### Docker 开发

```bash
# 在项目根目录
make dev
```

---

## 📝 开发指南

### 添加新的 API 端点

1. 在 `app/api/admin/endpoints/` 或 `app/api/client/endpoints/` 创建路由文件
2. 在 `app/schemas/` 创建 Pydantic 模式
3. 在 `app/crud/` 创建数据库操作
4. 在 `app/models/` 创建或更新 ORM 模型（如需要）

### 数据库迁移

```bash
# 生成迁移脚本
make db-migrate m="描述"

# 应用迁移
docker compose exec backend uv run alembic upgrade head
```

### 生成 SDK

```bash
make gen-sdk
```

---

## 📚 相关文档

- [API 概览](/development/api/overview)
- [RustFS 使用](/development/tech/rustfs)
- [环境配置](/deployment/config/environment)
