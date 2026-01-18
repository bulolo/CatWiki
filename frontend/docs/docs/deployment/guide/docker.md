# Docker 部署指南

本文档提供基于 Docker 的生产环境详细部署、配置和维护说明。这是 CatWiki 推荐的生产部署方式。

## 📋 前置要求

- **服务器**: Linux 服务器（推荐 Ubuntu 20.04+）
- **Docker**: >= 20.10
- **Docker Compose**: >= 2.0
- **域名**: 已备案的域名（可选，用于 HTTPS）

## 🏗️ 生产环境架构

生产环境采用前后端分离架构，推荐使用 Nginx 作为反向代理：

```
┌─────────────┐
│   Nginx     │ ← HTTPS/SSL (443)
│  (反向代理)  │
└──────┬──────┘
       │
       ├─→ Admin Frontend (8001)
       ├─→ Client Frontend (8002)
       ├─→ Backend API (3000)
       └─→ RustFS (9000)
```

## 📝 配置文件说明

生产环境配置位于 `deploy/docker/` 目录，采用模块化管理：

```
deploy/docker/
├── .env.backend              # 后端核心配置（数据库、Redis、密钥等）
├── .env.admin                # 管理后台前端配置
├── .env.client               # 用户端前端配置
└── docker-compose.prod.yml   # 生产容器编排文件
```

> [!TIP]
> 前后端配置分离使得管理更加清晰，且支持分布式部署。

## 🚀 部署步骤

### 1. 获取代码

```bash
git clone https://github.com/bulolo/CatWiki.git
cd catWiki
```

### 2. 初始化配置

使用 `make prod-init` 自动生成配置文件模板：

```bash
make prod-init

# 这将在 deploy/docker/ 目录下生成 .env.backend, .env.admin, .env.client
```

### 3. 修改配置 (关键!)

进入部署目录并修改配置文件：

```bash
cd deploy/docker
```

#### 3.1 后端配置 (`.env.backend`)

编辑 `.env.backend`，**必须修改**以下安全项：

```bash
# 1. 数据库密码
POSTGRES_PASSWORD=your-strong-password

# 2. 系统密钥 (使用 openssl rand -hex 32 生成)
SECRET_KEY=your-secret-key-min-32-chars

# 3. RustFS 对象存储配置
RUSTFS_ROOT_USER=your-rustfs-user
RUSTFS_ROOT_PASSWORD=your-rustfs-password
RUSTFS_ACCESS_KEY=your-access-key  # openssl rand -hex 16
RUSTFS_SECRET_KEY=your-secret-key  # openssl rand -hex 16

# 4. 文件访问域名 (文件服务器对外地址)
RUSTFS_PUBLIC_URL=https://files.yourdomain.com

# 5. CORS 允许域名 (允许访问 API 的前端域名)
BACKEND_CORS_ORIGINS=https://admin.yourdomain.com,https://yourdomain.com
```

#### 3.2 前端配置 (`.env.admin` & `.env.client`)

编辑两个前端配置文件，指向你的 API 地址：

```bash
# .env.admin
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# .env.client
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### 4. 启动服务

回到项目根目录，使用 Make 命令一键启动：

```bash
# 返回根目录
cd ../..

# 启动生产环境 (后台运行)
make prod-up
```

等待几分钟，查看服务状态：

```bash
docker compose -f deploy/docker/docker-compose.prod.yml ps
```

## 🔧 常用管理命令

CatWiki 提供了快捷命令来管理生产环境：

| 命令 | 说明 |
|------|------|
| `make prod-up` | **启动服务**：在后台启动所有生产容器 |
| `make prod-down` | **停止服务**：停止并移除容器（数据保留） |
| `make prod-restart` | **重启后端**：仅重启后端 API 服务（配置生效） |
| `make prod-logs` | **查看日志**：实时查看容器运行日志 |
| `make prod-clean` | **🚨 深度清理**：停止并**删除所有数据**（慎用！） |

## 🛡️ 维护指南

### 数据备份

**数据库备份**：
```bash
docker compose -f deploy/docker/docker-compose.prod.yml exec postgres \
  pg_dump -U postgres catwiki > backup_$(date +%F).sql
```

**文件存储备份**：
```bash
docker compose -f deploy/docker/docker-compose.prod.yml exec rustfs \
  tar czf /tmp/rustfs_backup_$(date +%F).tar.gz /data
docker cp rustfs:/tmp/rustfs_backup_*.tar.gz ./
```

### 版本升级

```bash
# 1. 拉取最新代码
git pull

# 2. 重启服务 (会自动构建新镜像)
make prod-down
make prod-up
```

## 🌐 Nginx 配置示例

详细的 Nginx HTTPS 反向代理配置，请参考 [Nginx 示例配置](/deployment/config/nginx-example)。
