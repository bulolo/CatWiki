.PHONY: setup init-env dev down restart logs clean db-migrate db-psql gen-sdk prod-init prod-up prod-down prod-restart prod-logs prod-clean help

# 默认目标
help:
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo " 🐱 CatWiki 项目管理命令"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@echo " 🛠️  [开发环境] (Development)"
	@echo "  make setup              - 一键初始化并启动开发环境 (init-env + dev)"
	@echo "  make init-env           - 初始化环境配置 (复制 .env.example 到 .env)"
	@echo "  make dev                - 启动所有服务 (前台运行, 查看日志)"
	@echo "  make down               - 停止并删除容器"
	@echo "  make restart            - 重启后端服务"
	@echo "  make logs               - 查看后端日志"
	@echo "  make clean              - 停止容器并删除所有数据卷 (重置数据库/存储)"
	@echo "  make db-migrate m=\"msg\" - 创建数据库迁移脚本"
	@echo "  make db-psql            - 进入数据库终端"
	@echo "  make gen-sdk            - 生成前端 TypeScript SDK"
	@echo ""
	@echo " 🚀  [生产环境] (Production)"
	@echo "  make prod-init          - 初始化生产环境配置"
	@echo "  make prod-up            - 启动生产环境 (后台运行)"
	@echo "  make prod-down          - 停止生产环境"
	@echo "  make prod-restart       - 重启生产环境后端服务"
	@echo "  make prod-logs          - 查看生产环境日志"
	@echo "  make prod-clean         - 停止容器并删除所有数据卷 (❗危险：清空生产数据)"
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# [开发环境] 一键设置并启动
setup:
	@echo "🚀 [CatWiki] 开始一键初始化与启动程序..."
	@make init-env
	@echo "📡 [CatWiki] 正在启动 Docker 环境 (dev)..."
	@make dev

# [开发环境] 初始化环境配置
init-env:
	@echo "🔧 [CatWiki] 正在初始化环境配置..."
	@echo "🧹 [CatWiki] 清理现有配置文件..."
	@rm -f backend/.env frontend/admin/.env frontend/client/.env
	@echo "📥 [CatWiki] 从 .env.example 复制配置文件..."
	@cp backend/.env.example backend/.env
	@cp frontend/admin/.env.example frontend/admin/.env
	@cp frontend/client/.env.example frontend/client/.env
	@echo "✅ [CatWiki] 配置文件初始化完成！"

# [开发环境] 启动服务 (前台运行，查看日志)
dev:
	docker compose -f docker-compose.dev.yml up --build

# [开发环境] 停止服务
down:
	docker compose -f docker-compose.dev.yml down

# [开发环境] 重启后端
restart:
	docker compose -f docker-compose.dev.yml restart backend

# [开发环境] 查看日志
logs:
	docker compose -f docker-compose.dev.yml logs -f backend

# [开发环境] 深度清理 (仅限开发环境)
clean:
	@echo "🧹 [开发环境] 正在尝试深度清理开发环境..."
	@echo "⚠️  警告：此操作将删除所有开发容器相关的数据卷和数据！"
	@read -p "您确定要继续吗？[y/N] " ans && [ $${ans:-N} = y ] || (echo "❌ 操作已取消"; exit 1)
	docker compose -f docker-compose.dev.yml down -v
	@echo "✅ 开发环境深度清理完成"

# [开发环境] 数据库迁移
db-migrate:
	docker compose -f docker-compose.dev.yml exec backend uv run alembic revision --autogenerate -m "$(m)"

# [开发环境] 数据库终端
db-psql:
	docker compose -f docker-compose.dev.yml exec postgres psql -U postgres -d catwiki

# [开发环境] 生成 SDK
gen-sdk:
	docker compose -f docker-compose.dev.yml exec backend uv run python scripts/generate_sdk.py

# [生产环境] 生产环境初始化
prod-init:
	@echo "🚀 开始初始化生产环境配置..."
	cp backend/.env.example deploy/docker/.env.backend
	cp frontend/admin/.env.example deploy/docker/.env.admin
	cp frontend/client/.env.example deploy/docker/.env.client
	@echo "✅ 生产环境配置模板已生成在 deploy/docker/ 目录下。"
	@echo "⚠️  请务必在运行 'make prod-up' 前修改这些 .env.* 文件中的敏感信息！"

# [生产环境] 生产环境启动 (后台运行)
prod-up:
	docker compose -f deploy/docker/docker-compose.prod.yml --profile init up -d

# [生产环境] 生产环境停止
prod-down:
	docker compose -f deploy/docker/docker-compose.prod.yml down

# [生产环境] 生产环境日志
prod-logs:
	docker compose -f deploy/docker/docker-compose.prod.yml logs -f

# [生产环境] 重启生产环境后端服务
prod-restart:
	docker compose -f deploy/docker/docker-compose.prod.yml restart backend

# [生产环境] 深度清理生产环境 (警告：将删除所有生产数据卷！)
prod-clean:
	@echo "🛑 [危险] 正在尝试深度清理生产环境..."
	@echo "⚠️  警告：此操作将删除所有生产容器相关的数据卷和数据！"
	@read -p "您确定要继续吗？[y/N] " ans && [ $${ans:-N} = y ] || (echo "❌ 操作已取消"; exit 1)
	docker compose -f deploy/docker/docker-compose.prod.yml down -v
	@echo "✅ 生产环境深度清理完成"