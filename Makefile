.PHONY: help \
	dev-init dev-up dev-down dev-restart dev-logs dev-clean dev-db-migrate dev-db-psql gen-sdk \
	prod-init prod-up prod-down prod-restart prod-logs prod-clean

# ==============================================================================
# 默认目标 (Default Goal)
# ==============================================================================
help:
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo " 🐱 CatWiki 项目管理命令 (Project Management Commands)"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@echo " 🛠️  [开发环境] (Development Environment)"
	@echo "  make dev-init           - 初始化环境配置 (复制 .env.example)"
	@echo "  make dev-up             - 启动开发服务 (前台运行, 查看日志)"
	@echo "  make dev-down           - 停止开发容器"
	@echo "  make dev-restart        - 重启开发环境后端服务"
	@echo "  make dev-logs           - 查看开发环境后端日志"
	@echo "  make dev-clean          - 停止容器并删除数据卷 (重置数据库/存储)"
	@echo "  make dev-db-migrate m=\"\"  - 创建数据库迁移脚本 (例如: make dev-db-migrate m=\"add user table\")"
	@echo "  make dev-db-psql        - 进入开发环境数据库终端"
	@echo ""

	@echo " 🚀  [生产环境] (Production Environment)"
	@echo "  make prod-init          - 初始化生产环境配置"
	@echo "  make prod-up            - 启动生产环境 (后台运行)"
	@echo "  make prod-down          - 停止生产环境"
	@echo "  make prod-restart       - 重启生产环境后端服务"
	@echo "  make prod-logs          - 查看生产环境日志"
	@echo "  make prod-clean         - 停止容器并删除数据卷 (❗危险：清空生产数据)"
	@echo ""

	@echo " 🧩  [通用命令] (Common Commands)"
	@echo "  make gen-sdk            - 生成前端 TypeScript SDK"
	@echo "  make help               - 显示此帮助信息"
	@echo ""
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
	@echo "✅ [CatWiki] 配置文件初始化完成！"

# 启动服务 (前台运行，查看日志)
dev-up:
	docker compose -f docker-compose.dev.yml up --build

# 停止服务
dev-down:
	docker compose -f docker-compose.dev.yml down

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

# 数据库迁移
dev-db-migrate:
	docker compose -f docker-compose.dev.yml exec backend uv run alembic revision --autogenerate -m "$(m)"

# 数据库终端
dev-db-psql:
	docker compose -f docker-compose.dev.yml exec postgres psql -U postgres -d catwiki



# ==============================================================================
# [生产环境] Production Targets
# ==============================================================================

# 生产环境初始化
prod-init:
	@echo "🚀 开始初始化生产环境配置..."
	cp backend/.env.example deploy/docker/.env.backend
	cp frontend/admin/.env.example deploy/docker/.env.admin
	cp frontend/client/.env.example deploy/docker/.env.client
	@echo "✅ 生产环境配置模板已生成在 deploy/docker/ 目录下。"
	@echo "⚠️  请务必在运行 'make prod-up' 前修改这些 .env.* 文件中的敏感信息！"

# 生产环境启动 (后台运行)
prod-up:
	docker compose -f deploy/docker/docker-compose.prod.yml --profile init up -d

# 生产环境停止
prod-down:
	docker compose -f deploy/docker/docker-compose.prod.yml down

# 生产环境日志
prod-logs:
	docker compose -f deploy/docker/docker-compose.prod.yml logs -f

# 重启生产环境后端服务
prod-restart:
	docker compose -f deploy/docker/docker-compose.prod.yml restart backend

# 深度清理生产环境 (警告：将删除所有生产数据卷！)
prod-clean:
	@echo "🛑 [危险] 正在尝试深度清理生产环境..."
	@echo "⚠️  警告：此操作将删除所有生产容器相关的数据卷和数据！"
	@read -p "您确定要继续吗？[y/N] " ans && [ $${ans:-N} = y ] || (echo "❌ 操作已取消"; exit 1)
	docker compose -f deploy/docker/docker-compose.prod.yml down -v
	@echo "✅ 生产环境深度清理完成"

# ==============================================================================
# [通用命令] Common Targets
# ==============================================================================

# 生成 SDK
gen-sdk:
	@echo "正在生成前端 SDK..."
	@uv run python backend/scripts/generate_sdk.py
	@echo "✅ SDK 生成完成!"
