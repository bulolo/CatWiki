# 常见问题

## 🚀 安装和启动

### Q: 首次启动需要多长时间？
**A:** 首次启动需要下载 Docker 镜像和构建容器，通常需要 2-3 分钟。后续启动会更快。

### Q: 为什么管理后台登录不上？
**A:** 请确认以下几点：
1. 是否运行了 `make dev-init`
2. 数据库是否正常初始化（查看 `make dev-logs`）
3. 如果数据库已损坏，使用 `make dev-clean` 重置

默认管理员账号：
- 📧 邮箱: `admin@example.com`
- 🔑 密码: `admin123`

### Q: 如何修改默认服务端口？
**A:** 直接在根目录的 `docker-compose.dev.yml` 中修改对应的 `ports` 映射：

```yaml
services:
  backend:
    ports:
      - "3000:3000"  # 改为 "3001:3000" 使用 3001 端口
```

修改后重启服务：`make dev-down && make dev-up`

---

## 🔧 配置问题

### Q: 如何启用 AI 功能？
**A:** 编辑 `backend/.env` 文件，添加 OpenAI API Key：

```bash
OPENAI_API_KEY=sk-your-api-key-here
```

然后重启后端：`make dev-restart`

### Q: 修改配置后不生效？
**A:** Docker 环境需要重启服务：

```bash
# 仅重启后端（推荐）
make dev-restart

# 完全重启所有服务
make dev-down && make dev-up
```

### Q: 如何查看当前配置？
**A:** 使用以下命令查看配置：

```bash
# 查看 Docker Compose 解析后的完整配置
docker compose -f docker-compose.dev.yml config

# 查看后端容器的环境变量
docker compose -f docker-compose.dev.yml exec backend env
```

---

## 🗄️ 数据库问题

### Q: 数据库连接失败？
**A:** 检查以下几点：

1. **Docker 环境**：确保 PostgreSQL 容器正在运行
   ```bash
   docker compose -f docker-compose.dev.yml ps
   ```

2. **本地开发**：确保配置正确
   ```bash
   # Docker 环境
   POSTGRES_SERVER=postgres
   POSTGRES_PORT=5432
   
   # 本地开发
   POSTGRES_SERVER=localhost
   POSTGRES_PORT=5433
   ```

### Q: 如何重置数据库？
**A:** 使用 `make clean` 命令：

```bash
make clean  # 会提示确认，输入 y 继续
```

> [!WARNING]
> 此操作会删除所有数据，请谨慎使用！

### Q: 如何进入数据库终端？
**A:** 使用 `make db-psql` 命令：

```bash
make db-psql
```

---

## 📁 文件存储问题

### Q: 文件 URL 显示为内部地址（rustfs:9000）？
**A:** 检查 `RUSTFS_PUBLIC_URL` 配置：

```bash
# 查看配置
docker compose exec backend env | grep RUSTFS_PUBLIC_URL

# 如果未设置或错误，修改 backend/.env
echo "RUSTFS_PUBLIC_URL=http://localhost:9000" >> backend/.env

# 重启 backend
make restart
```

### Q: 文件无法访问（404）？
**A:** 确保存储桶是公开的：

```bash
# 检查配置
grep RUSTFS_PUBLIC_BUCKET backend/.env
# 应该是: RUSTFS_PUBLIC_BUCKET=true

# 重新初始化存储桶
docker compose exec backend uv run python scripts/init_rustfs.py

# 重启 backend
make restart
```

---

## 🌐 API 问题

### Q: 客户端 API 返回 404？
**A:** 确保访问路径包含站点域名后缀：

```bash
# ❌ 错误
http://localhost:8002/

# ✅ 正确
http://localhost:8002/medical
```

### Q: CORS 错误？
**A:** 检查 `BACKEND_CORS_ORIGINS` 配置：

```bash
# 开发环境
BACKEND_CORS_ORIGINS=http://localhost:8001,http://localhost:8002,http://localhost:8003

# 生产环境
BACKEND_CORS_ORIGINS=https://admin.yourdomain.com,https://yourdomain.com
```

### Q: 如何查看 API 文档？
**A:** 访问 http://localhost:3000/docs 查看交互式 API 文档（Swagger UI）。

---

## 🔄 SDK 问题

### Q: 如何更新前端 SDK？
**A:** 当后端 API 变更后，运行：

```bash
make gen-sdk
```

这会自动生成新的 TypeScript SDK 到：
- `frontend/admin/src/lib/sdk`
- `frontend/client/src/lib/sdk`

### Q: SDK 类型不匹配？
**A:** 确保前后端代码同步：

1. 拉取最新代码
2. 重新生成 SDK：`make gen-sdk`
3. 重启前端服务

---

## 🚀 生产环境问题

### Q: 如何部署到生产环境？
**A:** 参考 [生产环境部署指南](/deployment/guide/docker)。

### Q: 生产环境如何配置？
**A:** 使用 `make prod-init` 生成配置模板，然后修改敏感信息：

```bash
make prod-init
cd deploy/docker
vim .env.backend  # 修改后端配置
vim .env.admin    # 修改 Admin 配置
vim .env.client   # 修改 Client 配置
```

---

## 💡 其他问题

### Q: 如何查看日志？
**A:** 使用以下命令：

```bash
# 查看所有服务日志
make dev  # 前台运行，实时查看

# 查看后端日志
make logs

# 查看特定服务日志
docker compose -f docker-compose.dev.yml logs -f backend
docker compose -f docker-compose.dev.yml logs -f admin-frontend
```

### Q: 如何停止服务？
**A:** 使用 `make down` 命令：

```bash
make down  # 停止并移除容器，保留数据
```

### Q: 遇到其他问题怎么办？
**A:** 
1. 查看 [GitHub Issues](https://github.com/bulolo/CatWiki/issues)
2. 提交新的 Issue
3. 联系开发团队：82607314@qq.com

---

## 📚 相关文档

- 📖 [快速开始](/development/start/quick-start)
- ⚙️ [环境配置](/deployment/config/environment)
- 🚀 [部署指南](/deployment/guide/docker)
- 🔌 [API 文档](/development/api/overview)
