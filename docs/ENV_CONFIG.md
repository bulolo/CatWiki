# CatWiki 环境配置完整指南

## 📋 概述

本文档提供 CatWiki 项目的完整环境配置说明，包括开发环境和生产环境的配置方法。

### 配置架构

- ✅ **前后端分离**：每个模块独立管理自己的配置
- ✅ **模块化**：配置文件分散到各自目录，职责清晰
- ✅ **灵活性**：支持本地开发和 Docker 开发
- ✅ **符合规范**：遵循现代前后端分离架构的最佳实践

---

## 📁 配置文件结构

```
catWiki/
├── backend/
│   ├── .env                      # 后端环境变量（开发环境，Git 忽略）
│   └── .env.example              # 后端配置模板
├── frontend/
│   ├── admin/
│   │   ├── .env                  # Admin 配置（开发环境，Git 忽略）
│   │   └── .env.example          # Admin 配置模板
│   └── client/
│       ├── .env                  # Client 配置（开发环境，Git 忽略）
│       └── .env.example          # Client 配置模板
├── docker-compose.dev.yml        # 开发环境 Docker Compose 配置
└── deploy/
    └── docker/
        ├── .env.backend          # 生产环境后端配置（Git 忽略）
        ├── .env.admin            # 生产环境 Admin 配置（Git 忽略）
        ├── .env.client           # 生产环境 Client 配置（Git 忽略）
        └── docker-compose.prod.yml  # 生产环境 Docker Compose 配置
```

**配置模板位置**：
- 后端配置模板：`backend/.env.example`
- Admin 前端配置模板：`frontend/admin/.env.example`
- Client 前端配置模板：`frontend/client/.env.example`

### 配置文件说明

| 文件 | 用途 | 是否提交到 Git |
|------|------|---------------|
| `backend/.env` | 开发环境后端配置 | ❌ 否（Git 忽略） |
| `backend/.env.example` | 后端配置模板 | ✅ 是 |
| `frontend/*/.env` | 开发环境前端配置 | ❌ 否（Git 忽略） |
| `frontend/*/.env.example` | 前端配置模板 | ✅ 是 |
| `deploy/docker/.env.backend` | 生产环境后端配置 | ❌ 否（Git 忽略） |
| `deploy/docker/.env.admin` | 生产环境 Admin 配置 | ❌ 否（Git 忽略） |
| `deploy/docker/.env.client` | 生产环境 Client 配置 | ❌ 否（Git 忽略） |
| `docker-compose.*.yml` | Docker 环境配置 | ✅ 是 |

**配置分离的优势**：
- ✅ **开发环境**：配置文件在各模块目录下（`backend/.env`、`frontend/*/.env`）
- ✅ **生产环境**：配置文件统一在 `deploy/docker/` 目录下，按模块分离
- ✅ **前后端分离**：`.env.backend`、`.env.admin`、`.env.client` 各司其职
- ✅ **避免混淆**：每个文件只包含对应模块的配置，清晰明了
- ✅ **独立修改**：可以单独修改某个模块的配置，不影响其他模块
- ✅ **无冗余**：配置模板在源目录，生产环境直接复制即可

---

## 🚀 快速开始

### 开发环境设置

```bash
# 1. 复制配置文件
cd backend
cp .env.example .env

# 2. 使用默认配置即可（可选：修改端口等）
# 默认配置已经可以正常使用

# 3. 启动服务
cd ..
docker compose -f docker-compose.dev.yml up -d

# 4. 访问服务
# - Admin 前端: http://localhost:8001
# - Client 前端: http://localhost:8002
# - 后端 API: http://localhost:3000
# - API 文档: http://localhost:3000/docs
# - RustFS 控制台: http://localhost:9001
```

### 生产环境设置

```bash
# 1. 在生产服务器上进入部署目录
cd deploy/docker

# 2. 创建配置文件（从模板复制）
# 后端配置
cp ../../backend/.env.example .env.backend
vim .env.backend

# Admin 前端配置
cp ../../frontend/admin/.env.example .env.admin
vim .env.admin

# Client 前端配置
cp ../../frontend/client/.env.example .env.client
vim .env.client

# 3. ⚠️ 修改 .env.backend 中的配置
# - POSTGRES_PASSWORD（数据库密码）
# - SECRET_KEY（使用 openssl rand -hex 32）
# - RUSTFS_ROOT_USER / RUSTFS_ROOT_PASSWORD
# - RUSTFS_ACCESS_KEY / RUSTFS_SECRET_KEY（使用 openssl rand -hex 16）
# - RUSTFS_PUBLIC_URL（文件访问域名）
# - BACKEND_CORS_ORIGINS（前端域名）

# 4. ⚠️ 修改 .env.admin 和 .env.client 中的配置
# - NEXT_PUBLIC_API_URL（后端 API 地址）

# 5. 生成安全密钥
openssl rand -hex 32  # 用于 SECRET_KEY
openssl rand -hex 16  # 用于 RustFS 密钥

# 6. 首次部署（包含初始化）
docker compose --profile init up -d

# 7. 后续启动（不运行初始化）
docker compose up -d

# 8. 查看日志
docker compose logs -f
```

---

## 🔧 配置项详解

### 1. 环境配置

| 配置项 | 说明 | 开发环境 | 生产环境 |
|--------|------|---------|---------|
| `ENVIRONMENT` | 运行环境 | `local` | `prod` |
| `DEBUG` | 调试模式 | `true` | `false` |
| `LOG_LEVEL` | 日志级别 | `DEBUG` | `INFO` |
| `DB_ECHO` | 是否输出 SQL 日志 | `true` | `false` |

### 2. 数据库配置

| 配置项 | 说明 | 默认值 | 注意事项 |
|--------|------|--------|---------|
| `POSTGRES_SERVER` | 数据库地址 | `postgres` | Docker 使用服务名 |
| `POSTGRES_USER` | 数据库用户 | `postgres` | |
| `POSTGRES_PASSWORD` | 数据库密码 | `postgres` | ⚠️ 生产环境必须修改 |
| `POSTGRES_DB` | 数据库名称 | `catwiki` | |
| `POSTGRES_PORT` | 数据库端口 | `5432` | 容器内部端口 |
| `POSTGRES_PORT_HOST` | 主机映射端口 | `5433` | 避免冲突 |

**数据库连接池配置：**

```bash
DB_POOL_SIZE=10           # 连接池大小
DB_MAX_OVERFLOW=20        # 最大溢出连接数
DB_POOL_TIMEOUT=30        # 连接超时时间（秒）
DB_POOL_RECYCLE=3600      # 连接回收时间（秒）
```

### 3. 安全配置

| 配置项 | 说明 | 生成方法 |
|--------|------|---------|
| `SECRET_KEY` | JWT 密钥（至少 32 字符） | `openssl rand -hex 32` |
| `ALGORITHM` | JWT 加密算法 | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token 有效期 | `10080`（7天） |

**生成安全密钥：**

```bash
# 方法 1: 使用 OpenSSL
openssl rand -hex 32

# 方法 2: 使用 Python
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 4. CORS 配置

```bash
# 开发环境
BACKEND_CORS_ORIGINS=http://localhost:8001,http://localhost:8002

# 生产环境
BACKEND_CORS_ORIGINS=https://admin.yourdomain.com,https://yourdomain.com
```

⚠️ **注意**：只允许信任的前端域名访问

### 5. RustFS 对象存储配置（重要！）

#### 5.1 连接配置

| 配置项 | 说明 | 开发环境 | 生产环境 |
|--------|------|---------|---------|
| `RUSTFS_ENDPOINT` | 内部连接地址 | `rustfs:9000` | `rustfs:9000` |
| `RUSTFS_ACCESS_KEY` | 访问密钥 | `rustfsadmin` | ⚠️ 必须修改 |
| `RUSTFS_SECRET_KEY` | 密钥 | `rustfsadmin` | ⚠️ 必须修改 |
| `RUSTFS_ROOT_USER` | Root 用户 | 与 ACCESS_KEY 一致 | 与 ACCESS_KEY 一致 |
| `RUSTFS_ROOT_PASSWORD` | Root 密码 | 与 SECRET_KEY 一致 | 与 SECRET_KEY 一致 |

**生成 RustFS 密钥：**

```bash
openssl rand -hex 16
```

#### 5.2 存储桶配置

| 配置项 | 说明 | 推荐值 |
|--------|------|--------|
| `RUSTFS_BUCKET_NAME` | 存储桶名称 | `catwiki` |
| `RUSTFS_USE_SSL` | 是否使用 SSL | 开发: `false` / 生产: `true` |
| `RUSTFS_PUBLIC_BUCKET` | 是否公开存储桶 | `true` |

**公开 vs 私有存储桶：**

- **公开（`true`）**：文件可直接访问，URL 简洁，适合公开内容
- **私有（`false`）**：需要预签名 URL，更安全，适合敏感内容

#### 5.3 公共访问配置（关键！）

| 环境 | `RUSTFS_PUBLIC_URL` | 说明 |
|------|---------------------|------|
| 开发环境 | `http://localhost:9000` | 直接访问 |
| 生产（域名） | `https://files.yourdomain.com` | 需要 Nginx 反向代理 |
| 生产（CDN） | `https://cdn.yourdomain.com` | 需要 CDN 配置 |

**配置要点：**

- ✅ 必须包含协议（`http://` 或 `https://`）
- ✅ 不要在末尾添加斜杠
- ✅ 这是用户访问文件时使用的地址

**工作原理：**

```
内部操作: backend -> RUSTFS_ENDPOINT (rustfs:9000)
外部访问: 用户 -> RUSTFS_PUBLIC_URL (https://files.yourdomain.com)
```

#### 5.4 完整 RustFS 配置示例

**开发环境：**

```bash
RUSTFS_ENDPOINT=rustfs:9000
RUSTFS_ACCESS_KEY=rustfsadmin
RUSTFS_SECRET_KEY=rustfsadmin
RUSTFS_ROOT_USER=rustfsadmin
RUSTFS_ROOT_PASSWORD=rustfsadmin
RUSTFS_BUCKET_NAME=catwiki
RUSTFS_USE_SSL=false
RUSTFS_PUBLIC_URL=http://localhost:9000
RUSTFS_PUBLIC_BUCKET=true
```

**生产环境：**

```bash
RUSTFS_ENDPOINT=rustfs:9000
RUSTFS_ACCESS_KEY=<openssl rand -hex 16>
RUSTFS_SECRET_KEY=<openssl rand -hex 16>
RUSTFS_ROOT_USER=<与 ACCESS_KEY 一致>
RUSTFS_ROOT_PASSWORD=<与 SECRET_KEY 一致>
RUSTFS_BUCKET_NAME=catwiki
RUSTFS_USE_SSL=true
RUSTFS_PUBLIC_URL=https://files.yourdomain.com
RUSTFS_PUBLIC_BUCKET=true
```

### 6. 前端配置

#### 6.1 Next.js 环境变量

前端配置文件位置：
- `frontend/admin/.env` - Admin 前端配置
- `frontend/client/.env` - Client 前端配置

配置示例：

```bash
# 开发环境（本地或 Docker）
NEXT_PUBLIC_API_URL=http://localhost:3000

# 生产环境
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

⚠️ **重要**：
- `NEXT_PUBLIC_*` 前缀的变量会被打包到前端代码中
- 不要在这类变量中存放密钥或敏感信息
- 前端代码运行在浏览器中
- Docker 环境下，配置会被 `docker-compose.yml` 中的 `environment` 块覆盖

---

## 📊 环境变量优先级

### Docker Compose 环境（推荐）

在 Docker 环境下，优先级从高到低：

```
1. docker-compose.yml 中的 environment 块（最高优先级）
2. env_file 指定的文件（backend/.env 或 frontend/*/.env）
3. ${变量:-默认值} 语法指定的默认值
```

**示例**：

```yaml
services:
  backend:
    env_file:
      - ./backend/.env          # 优先级 2
    environment:
      POSTGRES_SERVER: postgres  # 优先级 1（会覆盖 .env 中的配置）
```

### Python 后端（本地运行）

```
优先级从高到低：
1. 系统环境变量       （export VARIABLE=value）
2. .env 文件          （backend/.env）
3. 配置文件默认值      （app/core/config.py）
```

### Next.js 前端（本地运行）

```
优先级从高到低：
1. .env.local         （本地开发覆盖，Git 忽略，可选）
2. .env.development   （开发环境，pnpm dev，可选）
3. .env.production    （生产环境，pnpm build，可选）
4. .env               （所有环境，项目中使用）
```

**说明**：
- 本项目主要使用 `.env` 文件配置前端
- `.env.local` 可用于本地开发时的个性化配置（优先级最高）
- 开发环境通常只需配置 `.env` 文件即可

---

## 🎯 使用场景

### 场景 1: Docker Compose 开发（推荐）

```bash
# 1. 修改配置
vim backend/.env

# 2. 启动服务
docker compose -f docker-compose.dev.yml up -d

# 3. 修改配置后重启
docker compose -f docker-compose.dev.yml restart backend

# 4. 查看日志
docker compose -f docker-compose.dev.yml logs -f backend
```

### 场景 2: 生产环境部署

```bash
# 1. 进入部署目录
cd deploy/docker

# 2. 创建配置文件
cp ../../backend/.env.example .env.backend
cp ../../frontend/admin/.env.example .env.admin
cp ../../frontend/client/.env.example .env.client

# 3. 修改配置
vim .env.backend  # 修改后端配置
vim .env.admin    # 修改 Admin 前端配置
vim .env.client   # 修改 Client 前端配置

# 4. 首次部署（包含初始化）
docker compose --profile init up -d

# 5. 后续启动
docker compose up -d

# 6. 查看日志
docker compose logs -f

# 7. 查看特定服务日志
docker compose logs -f backend
docker compose logs -f admin-frontend
```

### 场景 3: 本地运行后端

```bash
# 1. 修改配置
cd backend
vim .env

# 确保以下配置正确：
# POSTGRES_SERVER=localhost
# POSTGRES_PORT=5433

# 2. 运行后端
make dev
```

### 场景 4: 本地运行前端

```bash
# 1. 创建配置文件
cd frontend/admin
cp .env.example .env

# 2. 修改配置（如果需要）
vim .env
# NEXT_PUBLIC_API_URL=http://localhost:3000

# 3. 安装依赖并运行前端
pnpm install
pnpm dev

# 提示：如果需要本地覆盖配置，可以创建 .env.local（优先级更高）
# cp .env .env.local
# vim .env.local
```

---

## 🔍 配置验证

### 开发环境验证

```bash
# 查看 Docker Compose 解析后的完整配置
docker compose -f docker-compose.dev.yml config

# 查看后端容器的环境变量
docker compose -f docker-compose.dev.yml exec backend env | grep -E "POSTGRES|RUSTFS|SECRET"

# 查看 RustFS 配置
docker compose -f docker-compose.dev.yml exec backend env | grep RUSTFS
```

### 生产环境验证

```bash
# 切换到部署目录
cd deploy/docker

# 查看配置
docker compose config

# 查看后端环境变量
docker compose exec backend env | grep -E "POSTGRES|RUSTFS|SECRET"

# 查看 Admin 前端环境变量
docker compose exec admin-frontend env | grep NEXT_PUBLIC

# 查看 Client 前端环境变量
docker compose exec client-frontend env | grep NEXT_PUBLIC
```

### 验证 RustFS 配置

```bash
# 查看后端日志（开发环境）
docker compose -f docker-compose.dev.yml logs backend | grep RustFS

# 查看后端日志（生产环境）
cd deploy/docker
docker compose logs backend | grep RustFS
```

**应该看到：**

```
RustFS 客户端初始化成功: rustfs:9000
RustFS 公共访问地址: http://localhost:9000
RustFS 服务初始化成功
```

### 测试文件上传

```bash
# 1. 获取 Token
TOKEN=$(curl -X POST "http://localhost:3000/admin/api/v1/users/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq -r '.data.access_token')

# 2. 上传测试文件
echo "Hello RustFS!" > test.txt
curl -X POST "http://localhost:3000/admin/api/v1/files/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.txt"

# 3. 检查返回的 URL
# 应该是: http://localhost:9000/catwiki/uploads/xxx.txt
```

---

## ❓ 常见问题

### Q1: 文件 URL 还是内部地址（rustfs:9000）？

**症状**: 上传文件后返回 `http://rustfs:9000/...`

**解决**:

```bash
# 1. 检查配置
docker compose exec backend env | grep RUSTFS_PUBLIC_URL

# 2. 如果未设置或错误，修改 backend/.env
echo "RUSTFS_PUBLIC_URL=http://localhost:9000" >> backend/.env

# 3. 重启 backend
docker compose restart backend
```

### Q2: 文件无法访问（404）？

**症状**: URL 返回 404 或无法访问

**解决**:

```bash
# 1. 确保存储桶是公开的
grep RUSTFS_PUBLIC_BUCKET backend/.env
# 应该是: RUSTFS_PUBLIC_BUCKET=true

# 2. 重新初始化存储桶
docker compose exec backend uv run python scripts/init_rustfs.py

# 3. 重启 backend
docker compose restart backend
```

### Q3: 数据库连接失败？

**症状**: 后端无法连接数据库

**解决**:

```bash
# Docker 环境（docker-compose.yml 会自动覆盖）
# POSTGRES_SERVER=postgres
# POSTGRES_PORT=5432

# 本地开发
# POSTGRES_SERVER=localhost
# POSTGRES_PORT=5433
```

### Q4: 前端无法连接后端？

**症状**: 前端请求失败或 CORS 错误

**解决**:

1. 检查后端是否运行: `docker compose ps`
2. 检查 CORS 配置: `grep BACKEND_CORS_ORIGINS backend/.env`
3. 确保前端配置正确: `cat frontend/admin/.env`

### Q5: 修改配置后不生效？

**解决**:

```bash
# Docker 环境需要重启（开发环境）
docker compose -f docker-compose.dev.yml restart backend

# Docker 环境需要重启（生产环境）
cd deploy/docker
docker compose restart backend

# 或完全重新启动（开发环境）
docker compose -f docker-compose.dev.yml down
docker compose -f docker-compose.dev.yml up -d

# 或完全重新启动（生产环境）
cd deploy/docker
docker compose down
docker compose up -d
```

---

## 🔐 生产环境配置检查清单

部署到生产环境前，请逐项检查：

### 后端配置 (.env.backend)

#### 基础配置

- [ ] 创建 `deploy/docker/.env.backend` 文件
- [ ] 设置 `ENVIRONMENT=prod`（通过 docker-compose.yml 自动设置）
- [ ] 设置 `DEBUG=false`（通过 docker-compose.yml 自动设置）
- [ ] 设置 `LOG_LEVEL=INFO`（通过 docker-compose.yml 自动设置）
- [ ] 设置 `DB_ECHO=false`（通过 docker-compose.yml 自动设置）

### 数据库配置

- [ ] 修改 `POSTGRES_PASSWORD`（使用强密码）
- [ ] 配置数据库连接池参数

### 安全配置

- [ ] 修改 `SECRET_KEY`（使用 `openssl rand -hex 32` 生成）
- [ ] 配置合适的 Token 过期时间

### RustFS 配置

- [ ] 修改 `RUSTFS_ACCESS_KEY`（使用 `openssl rand -hex 16`）
- [ ] 修改 `RUSTFS_SECRET_KEY`（使用 `openssl rand -hex 16`）
- [ ] 修改 `RUSTFS_ROOT_USER`（与 ACCESS_KEY 一致）
- [ ] 修改 `RUSTFS_ROOT_PASSWORD`（与 SECRET_KEY 一致）
- [ ] 修改 `RUSTFS_PUBLIC_URL`（你的域名或 CDN）
- [ ] 设置 `RUSTFS_USE_SSL=true`
- [ ] 确认 `RUSTFS_PUBLIC_BUCKET` 设置正确

### CORS 和前端配置

- [ ] 修改 `BACKEND_CORS_ORIGINS`（你的前端域名）- 在 `.env.backend`
- [ ] 修改 `NEXT_PUBLIC_API_URL`（你的 API 地址）- 在 `.env.admin` 和 `.env.client`

### 前端配置 (.env.admin 和 .env.client)

- [ ] 创建 `deploy/docker/.env.admin` 文件
- [ ] 创建 `deploy/docker/.env.client` 文件
- [ ] 设置 `NEXT_PUBLIC_API_URL`（后端 API 地址）

**说明**：
- Admin 和 Client 通常使用相同的 API 地址
- 如果需要不同的 API 地址，可以分别配置

### 基础设施

- [ ] 配置 Nginx 反向代理（如果使用自定义域名）
- [ ] 配置 SSL 证书
- [ ] 配置 CDN（如果需要）
- [ ] 配置防火墙规则
- [ ] 配置备份策略

---

## 🛠️ 快速命令参考

```bash
# 生成密钥
openssl rand -hex 32    # SECRET_KEY
openssl rand -hex 16    # RustFS 密钥

# 开发环境服务管理
docker compose -f docker-compose.dev.yml ps                    # 查看服务状态
docker compose -f docker-compose.dev.yml restart backend       # 重启后端
docker compose -f docker-compose.dev.yml logs -f backend       # 查看日志

# 生产环境服务管理（在 deploy/docker/ 目录下）
cd deploy/docker
docker compose ps                    # 查看服务状态
docker compose restart backend       # 重启后端
docker compose logs -f backend       # 查看日志

# 配置验证（开发环境）
docker compose -f docker-compose.dev.yml exec backend env | grep RUSTFS     # 检查 RustFS 配置
docker compose -f docker-compose.dev.yml exec backend env | grep POSTGRES   # 检查数据库配置

# 配置验证（生产环境）
cd deploy/docker
docker compose exec backend env | grep RUSTFS     # 检查 RustFS 配置
docker compose exec backend env | grep POSTGRES   # 检查数据库配置

# RustFS 管理（开发环境）
docker compose -f docker-compose.dev.yml exec backend uv run python scripts/init_rustfs.py

# RustFS 管理（生产环境）
cd deploy/docker
docker compose exec backend uv run python scripts/init_rustfs.py

# 数据库管理（开发环境）
docker compose -f docker-compose.dev.yml exec postgres psql -U postgres -d catwiki

# 数据库管理（生产环境）
cd deploy/docker
docker compose exec postgres psql -U postgres -d catwiki
```

---

## 📚 相关文档

- **[backend/.env.example](../backend/.env.example)** - 后端配置模板
- **[frontend/admin/.env.example](../frontend/admin/.env.example)** - Admin 前端配置模板
- **[frontend/client/.env.example](../frontend/client/.env.example)** - Client 前端配置模板
- **[deploy/docker/README.md](../deploy/docker/README.md)** - 生产环境部署详细指南
- **[docker-compose.dev.yml](../docker-compose.dev.yml)** - Docker Compose 开发配置
- **[deploy/docker/docker-compose.prod.yml](../deploy/docker/docker-compose.prod.yml)** - Docker Compose 生产配置
- **[backend/app/core/RUSTFS_USAGE.md](../backend/app/core/RUSTFS_USAGE.md)** - RustFS 详细使用指南
- **[docs/](./README.md)** - 项目文档目录

---

## 🎉 总结

本配置指南提供了：

- ✅ **完整的配置结构**：清晰的文件组织
- ✅ **详细的配置说明**：每个配置项的含义和用法
- ✅ **RustFS 完整配置**：包括公共访问、存储桶设置等
- ✅ **快速开始指南**：3 步开始开发
- ✅ **问题排查方法**：常见问题和解决方案
- ✅ **生产环境清单**：确保安全部署

现在你可以：

1. **开发环境**：复制各模块的 `.env.example` → `.env`，使用默认配置即可
2. **生产环境**：在 `deploy/docker/` 目录下创建三个配置文件：
   - `.env.backend` - 后端配置
   - `.env.admin` - Admin 前端配置
   - `.env.client` - Client 前端配置
3. 按照清单逐项检查，确保配置正确

**优势**：
- ✅ 前后端配置完全分离，职责清晰
- ✅ 生产环境配置独立管理，避免与开发环境混淆
- ✅ 可以单独修改某个模块的配置
- ✅ 符合标准命名规范（`.env.example`）
- ✅ 更符合微服务架构理念

祝开发愉快！🚀
