# 快速开始

## ⚡ 5分钟快速体验

### 前置要求

- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **Make** (系统自带或通过包管理器安装)

### 一键启动

```bash
# 1. 克隆项目
git clone https://github.com/bulolo/CatWiki.git
cd catWiki

# 2. 首次启动（初始化配置）
make dev-init

# 修改配置 .env (可选)

# 3. 启动开发环境
make dev-up
```

> [!WARNING]
> **关于 `make dev-init`**: 它会重新从模板复制 `.env` 文件，这会覆盖您已有的配置。
> - **第一次运行**: 请使用 `make dev-init`
> - **后续开发**: 请直接使用 `make dev-up`

等待 2-3 分钟，所有服务启动完成后，访问：

- 🎯 **管理后台**: http://localhost:8001  
  使用 `admin@example.com` / `admin123` 登录
- 💬 **客户端**: http://localhost:8002/medical  
  查看 Demo 医学科普，包含 5 篇医学文档
- 📚 **API 文档**: http://localhost:3000/docs  
  交互式 API 文档
- 📖 **文档站点**: http://localhost:8003  
  项目完整文档

就这么简单！🎉

---

### 🏗️ 项目管理命令

本项目根目录提供了 `Makefile` 工具，将复杂的 Docker 维护命令封装为简单的指令。

#### 通用命令
| 命令 | 说明 |
|------|------|
| `make gen-sdk` | **生成 SDK**：触发后端 API 自动生成前端 SDK |
| `make help` | **预览命令**：显示所有可用指令及其说明 |

#### 开发环境命令
| 命令 | 说明 |
|------|------|
| `make dev-init` | **初始化环境配置**：清理并重新从 `.env.example` 复制配置文件 |
| `make dev-up` | **开发启动**：构建镜像并在前台启动，实时查看所有服务日志 |
| `make dev-down` | **优雅停止**：停止并移除容器，保留数据库存储卷 |
| `make dev-restart` | **快捷重启**：仅重启后端应用容器 |
| `make dev-logs` | **实时日志**：查看后端核心服务的实时运行日志 |
| `make dev-db-migrate m="msg"` | **生成迁移脚本**：生成新的数据库迁移脚本（需提供备注 `m`） |
| `make dev-db-psql` | **数据库终端**：进入 PostgreSQL 交互式终端 |
| `make dev-clean` | **深度重置**：停止容器并**删除所有数据卷**（清空数据库和存储，⚠️ 危险操作） |

### 生产环境命令

| 命令 | 说明 |
|------|------|
| `make prod-init` | **生产初始化**：初始化生产环境配置文件模板 |
| `make prod-up` | **生产启动**：在后台启动生产环境所有服务 |
| `make prod-down` | **生产停止**：停止并移除生产环境容器 |
| `make prod-restart` | **重启后端**：仅重启生产环境后端应用容器 |
| `make prod-logs` | **实时日志**：查看生产环境容器日志 |
| `make prod-clean` | **深度重置**：停止容器并**删除生产所有数据卷**（⚠️ 危险操作） |

---

## 🔧 配置说明

### 开发环境配置

开发环境使用默认配置即可正常运行，无需修改。如果需要启用 AI 功能：

```bash
# 编辑后端配置文件
vim backend/.env

# 添加 OpenAI API Key
OPENAI_API_KEY=sk-your-api-key-here

# 重启后端服务
make dev-restart
```

### 生产环境配置

生产环境需要修改敏感信息，详见 [部署指南](/deployment/guide/docker)。

---

## 📚 下一步

- 📖 [环境配置指南](/deployment/config/environment) - 详细的配置说明
- 🚀 [部署指南](/deployment/guide/docker) - 生产环境部署
- 🔌 [API 文档](/development/api/overview) - API 接口说明
- 💻 [开发指南](/development/guide/backend) - 后端开发指南

---

## ❓ 常见问题

### Q: 为什么管理后台登录不上？
A: 请确认是否运行了 `make dev-init`。如果数据库已损坏，请使用 `make dev-clean` 重置。

### Q: 如何修改默认服务端口？
A: 直接在根目录的 `docker-compose.dev.yml` 中修改对应的 `ports` 映射即可。

### Q: 客户端 API 报 404？
A: 确保你的访问路径包含站点域名后缀，例如：`http://localhost:8002/medical`。

### Q: 修改配置后不生效？
A: Docker 环境需要重启服务：`make dev-restart`（仅重启后端）或 `make dev-down && make dev-up`（完全重启）。

更多问题请查看 [常见问题](/about/project/faq)。
