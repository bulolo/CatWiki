# 快速开始

本指南将帮助您在 5 分钟内启动 CatWiki，包括开发环境和生产环境两种方式。

## 前置要求

- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **Make** (系统自带或通过包管理器安装)

---

## ⚡ 开发环境

开发环境适合本地开发调试，支持热更新，方便快速迭代。

### 一键启动

```bash
# 1. 克隆项目
git clone https://github.com/bulolo/CatWiki.git
cd catWiki

# 2. 首次启动（初始化配置）
make dev-init

# 3. 修改配置 .env (可选)

# 4. 启动开发环境
make dev-up
```

> [!WARNING]
> **关于 `make dev-init`**: 它会重新从模板复制 `.env` 文件，这会覆盖您已有的配置。
> - **第一次运行**: 请使用 `make dev-init`
> - **后续开发**: 请直接使用 `make dev-up`

### 访问服务

等待所有服务启动完成（首次启动需构建镜像，可能需要 3-5 分钟），访问：

| 服务 | 地址 | 说明 |
|------|------|------|
| 🎯 管理后台 | http://localhost:8001 | 账号: `admin@example.com` / `admin123` |
| 💬 客户端 | http://localhost:8002/medical | 默认医疗 Demo 站点 |
| 📚 API 文档 | http://localhost:3000/docs | Swagger UI 交互式文档 |
| 📖 文档中心 | http://localhost:8003 | 您现在正在阅读的文档 |

---

## � 生产环境

生产环境适合正式部署，使用 Nginx 反向代理，支持 HTTPS，性能优化。

### 1. 一键部署

```bash
# 1. 初始化生产配置
make prod-init

# 2. 修改配置文件（必须！）
vim deploy/docker/.env.backend    # 后端配置
vim deploy/docker/.env.admin      # Admin 前端配置
vim deploy/docker/.env.client     # Client 前端配置

# 3. 后台启动生产环境
make prod-up
```

### 2. 必要配置项

> [!IMPORTANT]
> 生产环境**必须**修改以下配置，否则存在安全风险！

#### 后端配置 (`deploy/docker/.env.backend`)

```bash
# 数据库密码（必改）
POSTGRES_PASSWORD=your_secure_password

# JWT 密钥（必改，使用随机字符串）
SECRET_KEY=your_random_secret_key_at_least_32_chars

# CORS 允许的域名
BACKEND_CORS_ORIGINS=["https://admin.catwiki.ai","https://demo.catwiki.ai","https://docs.catwiki.ai","https://catwiki.ai"]

# RustFS 对象存储配置
RUSTFS_ENDPOINT=rustfs:9000                    # 内部访问地址
RUSTFS_ACCESS_KEY=rustfsadmin                  # 访问密钥（建议修改）
RUSTFS_SECRET_KEY=rustfsadmin                  # 密钥（建议修改）
RUSTFS_PUBLIC_URL=https://files.catwiki.ai  # 公网访问地址
```

#### 前端配置

- **Admin 后台**: 修改 `deploy/docker/.env.admin` 中的 `NEXT_PUBLIC_API_URL` 为您的 API 域名。
- **Client 端**: 修改 `deploy/docker/.env.client` 中的 `NEXT_PUBLIC_API_URL`。

---

## �🛠️ 常用命令 (CLI Reference)

### 开发环境 (Development)

| 命令 | 说明 |
|------|------|
| `make dev-init` | **环境初始化**：生成本地 `.env` 文件（仅首次执行或重置配置时使用） |
| `make dev-up` | **一键启动**：构建并运行容器，展示实时日志 (Ctrl+C 停止) |
| `make dev-rebuild` | **后台重启**：构建并以守护进程模式启动 (Background) |
| `make dev-down` | **停止服务**：移除容器，保留数据 |
| `make dev-restart` | **快捷重启**：仅重启 backend 容器，适用于修改代码后快速刷新 |
| `make dev-logs` | **查看日志**：持续输出后端日志流 |
| `make dev-db-migrate m="xxx"` | **创建迁移**：自动生成 Alembic 数据库迁移文件 |
| `make dev-db-psql` | **DB 终端**：进入 PostgreSQL 交互式命令行 |
| `make dev-clean` | **彻底重置**：删除所有容器及数据（含数据库数据，慎用） |

### 生产环境 (Production)

| 命令 | 说明 |
|------|------|
| `make prod-init` | **生产初始化**：初始化生产环境配置文件模板 |
| `make prod-up` | **生产启动**：在后台启动生产环境所有服务 |
| `make prod-rebuild` | **无损重建**：重新构建生产镜像并拉起服务 |
| `make prod-down` | **生产停止**：停止并移除生产环境容器 |
| `make prod-restart` | **重启后端**：仅重启生产环境后端应用容器 |
| `make prod-logs` | **实时日志**：查看生产环境容器日志 |
| `make prod-clean` | **深度重置**：停止容器并删除生产所有数据卷（⚠️ 危险操作） |

### 系统维护 (Maintenance)

| 命令 | 说明 |
|------|------|
| `make gen-sdk` | **同步 SDK**：根据后端接口刷新前端 TypeScript SDK |
| `make format` | **自动格式化**：一键修复后端 (Ruff) 与前端 (Lint) 的代码格式 |
| `make license` | **许可注入**：为源码文件自动添加 License 声明头 |
| `make help` | **查看帮助**：显示所有可用 Makefile 指令 |

---

## 📚 下一步

- 📖 [环境配置指南](/deployment/config/environment) - 详细的配置说明
- 🚀 [Docker 部署指南](/deployment/guide/docker) - 完整生产部署流程
- 🔌 [API 文档](/development/api/overview) - API 接口说明
- 💻 [后端开发指南](/development/guide/backend) - 后端开发指南

---

## ❓ 常见问题

### Q: 为什么管理后台登录不上？

A: 请确认是否运行了 `make dev-init`（开发）或 `make prod-init`（生产）。如果数据库已损坏，请使用对应的 `clean` 命令重置。

### Q: 如何修改默认服务端口？

A: 
- 开发环境：修改根目录的 `docker-compose.dev.yml`
- 生产环境：修改 `deploy/docker/docker-compose.prod.yml`

### Q: 客户端 API 报 404？

A: 确保访问路径包含站点域名后缀，例如：`http://localhost:8002/medical`。

### Q: 修改配置后不生效？

A: Docker 环境需要重启服务：
- 开发环境：`make dev-restart` 或 `make dev-down && make dev-up`
- 生产环境：`make prod-restart` 或 `make prod-down && make prod-up`

### Q: 生产环境如何配置 HTTPS？

A: 建议使用 Nginx 反向代理 + Let's Encrypt，详见 [Docker 部署指南](/deployment/guide/docker)。

更多问题请查看 [常见问题](/about/project/faq)。
