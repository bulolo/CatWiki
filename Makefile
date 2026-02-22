.PHONY: help \
	dev-init dev-up dev-down dev-restart dev-logs dev-clean dev-db-migrate dev-db-psql gen-sdk license \
	prod-init prod-up prod-rebuild prod-down prod-restart prod-logs prod-clean clean-cache \
	

# ==============================================================================
# 跨平台配置 (Cross-Platform Config)
# ==============================================================================
# 检测操作系统，适配 sed 命令
# macOS 使用 sed -i ''，Linux/WSL 使用 sed -i
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
    SED_I := sed -i ''
else
    SED_I := sed -i
endif

# ==============================================================================
# 默认目标 (Default Goal)
# ==============================================================================
help:
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo " 🐱 CatWiki 项目管理命令 (Project Management Commands)"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo " 💻 系统检测: $(UNAME_S)"
	@echo ""
	@echo " 🛠️  [开发环境] (Development Environment)"
	@echo "  make dev-init           - 初始化环境配置 (复制 .env.example)"
	@echo "  make dev-up             - 启动开发服务 (前台运行, 查看日志)"
	@echo "  make dev-down           - 停止开发容器"
	@echo "  make dev-restart        - 重启开发环境后端服务"
	@echo "  make dev-logs           - 查看开发环境后端日志"
	@echo "  make dev-clean          - 停止容器并删除数据卷 (重置数据库/存储)"
	@echo "  make dev-db-migrate m=\"\"  - 创建数据库迁移脚本 (例如: make dev-db-migrate m=\"add user table\")"
	@echo "  make dev-db-upgrade     - 执行数据库迁移升级到最新版本"
	@echo "  make dev-db-psql        - 进入开发环境数据库终端"
	@echo ""

	@echo " 🚀  [生产环境] (Production Environment)"
	@echo "  make prod-init          - 初始化生产环境配置"
	@echo "  make prod-up            - 启动生产环境 (后台运行)"
	@echo "  make prod-rebuild       - 无缓存重新构建生产环境"
	@echo "  make prod-down          - 停止生产环境"
	@echo "  make prod-restart       - 重启生产环境后端服务"
	@echo "  make prod-logs          - 查看生产环境日志"
	@echo "  make prod-clean         - 停止容器并删除数据卷 (❗危险：清空生产数据)"
	@echo ""

	@echo " 🧩  [通用命令] (Common Commands)"
	@echo "  make clean-cache        - 清理本地缓存 (node_modules/.next/.pnpm-store 等)"
	@echo "  make gen-sdk            - 生成前端 TypeScript SDK"
	@echo "  make license            - 为所有源文件自动注入 License Header"
	@echo "  make format             - 运行代码格式化 (后端+前端)"
	@echo "  make help               - 显示此帮助信息"
	@echo ""

	@echo " 📦  [CE 发布] (CE Release)"
	@echo "  make sync-ce            - 从 ee 生成 CE 并推送到 origin/ce"
	@echo "  make publish-ce         - 将 origin/ce 推送到 GitHub"
	@echo ""
	@echo " ⚠️  Windows 用户注意: 请使用 WSL2 或 Git Bash 运行 make 命令"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ==============================================================================
# [开发环境] Development Targets
# ==============================================================================



# 初始化环境配置
dev-init:
	@echo "🔧 [CatWiki] 正在初始化环境配置..."
	@echo "🧹 [CatWiki] 清理现有配置文件..."
	@rm -f backend/.env frontend/admin/.env frontend/client/.env
	@echo "📥 [CatWiki] 从 .env.example 复制配置文件..."
	@cp backend/.env.example backend/.env
	@cp frontend/admin/.env.example frontend/admin/.env
	@cp frontend/client/.env.example frontend/client/.env
	@# 自动修正开发环境基础配置
	@$(SED_I) 's/^ENVIRONMENT=.*/ENVIRONMENT=dev/g' backend/.env
	@$(SED_I) 's/^DEBUG=.*/DEBUG=true/g' backend/.env
	@echo "✅ [CatWiki] 配置文件初始化完成！"

# 启动服务 (前台运行，查看日志)
dev-up:
	docker compose -f docker-compose.dev.yml up --build

# 停止服务
dev-down:
	docker compose -f docker-compose.dev.yml down

# 重建并启动服务
dev-rebuild:
	docker compose -f docker-compose.dev.yml up -d --build

# 重启后端
dev-restart:
	docker compose -f docker-compose.dev.yml restart backend

# 查看日志
dev-logs:
	docker compose -f docker-compose.dev.yml logs -f backend

# 深度清理 (仅限开发环境)
dev-clean:
	@echo "🧹 [开发环境] 正在尝试深度清理开发环境..."
	@echo "⚠️  警告：此操作将删除所有开发容器相关的数据卷和数据！"
	@read -p "您确定要继续吗？[y/N] " ans && [ $${ans:-N} = y ] || (echo "❌ 操作已取消"; exit 1)
	docker compose -f docker-compose.dev.yml down -v
	@echo "✅ 开发环境深度清理完成"

# 数据库迁移创建
dev-db-migrate:
	docker compose -f docker-compose.dev.yml exec backend uv run alembic revision --autogenerate -m "$(m)"

# 数据库迁移升级
dev-db-upgrade:
	docker compose -f docker-compose.dev.yml exec backend uv run alembic upgrade head

# 数据库终端
dev-db-psql:
	docker compose -f docker-compose.dev.yml exec postgres psql -U postgres -d catwiki



# ==============================================================================
# [生产环境] Production Targets
# ==============================================================================

# 生产环境初始化
prod-init:
	@echo "🚀 开始初始化生产环境配置..."
	@mkdir -p deploy/docker
	@cp backend/.env.example deploy/docker/.env.backend
	@cp frontend/admin/.env.example deploy/docker/.env.admin
	@cp frontend/client/.env.example deploy/docker/.env.client
	@# 自动修正生产环境基础配置
	@$(SED_I) 's/^ENVIRONMENT=.*/ENVIRONMENT=prod/g' deploy/docker/.env.backend
	@$(SED_I) 's/^DEBUG=.*/DEBUG=false/g' deploy/docker/.env.backend
	@echo "✅ 生产环境配置模板已生成在 deploy/docker/ 目录下。"
	@echo "⚠️  请务必在运行 'make prod-up' 前修改这些 .env.* 文件中的敏感信息！"

# 生产环境启动 (后台运行)
prod-up:
	set -a && . deploy/docker/.env.client && . deploy/docker/.env.admin && set +a && \
	docker compose -f deploy/docker/docker-compose.prod.yml --profile init up -d --build

# 生产环境无缓存重新构建
prod-rebuild:
	@echo "🔧 [CatWiki] 无缓存重新构建生产环境..."
	set -a && . deploy/docker/.env.client && . deploy/docker/.env.admin && set +a && \
	docker compose -f deploy/docker/docker-compose.prod.yml --profile init build --no-cache
	set -a && . deploy/docker/.env.client && . deploy/docker/.env.admin && set +a && \
	docker compose -f deploy/docker/docker-compose.prod.yml --profile init up -d

# 生产环境停止
prod-down:
	docker compose -f deploy/docker/docker-compose.prod.yml --profile init down
	@docker rm -f catwiki-backend-init-prod >/dev/null 2>&1 || true

# 生产环境日志
prod-logs:
	docker compose -f deploy/docker/docker-compose.prod.yml --profile init logs -f

# 重启生产环境后端服务
prod-restart:
	docker compose -f deploy/docker/docker-compose.prod.yml --profile init restart backend

# 深度清理生产环境 (警告：将删除所有生产数据卷！)
prod-clean:
	@echo "🛑 [危险] 正在尝试深度清理生产环境..."
	@echo "⚠️  警告：此操作将删除所有生产容器相关的数据卷和数据！"
	@read -p "您确定要继续吗？[y/N] " ans && [ $${ans:-N} = y ] || (echo "❌ 操作已取消"; exit 1)
	docker compose -f deploy/docker/docker-compose.prod.yml --profile init down -v
	@docker rm -f catwiki-backend-init-prod >/dev/null 2>&1 || true
	@echo "✅ 生产环境深度清理完成"

# ==============================================================================
# [通用命令] Common Targets
# ==============================================================================

# 清理本地缓存/构建产物
clean-cache:
	@echo "🧹 [CatWiki] 清理本地缓存目录..."
	@rm -rf .pnpm-store
	@rm -rf frontend/admin/.pnpm-store frontend/client/.pnpm-store frontend/docs/.pnpm-store frontend/website/.pnpm-store
	@rm -rf frontend/admin/node_modules frontend/client/node_modules frontend/docs/node_modules frontend/website/node_modules
	@rm -rf frontend/admin/.next frontend/client/.next frontend/website/.next frontend/website/out
	@rm -rf frontend/docs/.vitepress/cache frontend/docs/.vitepress/dist
	@find backend scripts -type d -name "__pycache__" -prune -exec rm -rf {} + 2>/dev/null || true
	@rm -rf backend/.pytest_cache backend/.ruff_cache
	@rm -f frontend/admin/tsconfig.tsbuildinfo frontend/client/tsconfig.tsbuildinfo
	@echo "✅ 本地缓存清理完成"

# 生成 SDK
gen-sdk:
	@echo "正在生成前端 SDK..."
	@uv run python backend/scripts/generate_sdk.py
	@echo "✅ SDK 生成完成!"

# 格式化代码
format:
	@echo "🎨 [Backend] 正在格式化 Python 代码..."
	cd backend && uv run ruff format .
	@echo "🎨 [Frontend] 正在格式化 TypeScript 代码 (Admin)..."
	cd frontend/admin && pnpm run lint:fix
	@echo "🎨 [Frontend] 正在格式化 TypeScript 代码 (Client)..."
	cd frontend/client && pnpm run lint:fix
	@echo "✅ 代码格式化完成"

# 注入 License Header
license:
	@echo "🔏 [CatWiki] 正在为源文件注入 License Header..."
	@python3 scripts/add_license_header.py
	@echo "✅ License Header 注入完成！"

# ==============================================================================
# 从 ee 生成 CE 并推送到 origin/ce
# 将 origin/ce 推送到 GitHub
