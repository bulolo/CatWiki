# ==============================================================================
# Makefile - CatWiki 项目管理脚本
# ==============================================================================
# 支持环境: macOS, Linux, WSL2
# 核心功能: 开发环境启停, 生产环境部署, 数据库迁移, 代码规范检查, 项目同步发布等
# ==============================================================================

.PHONY: help \
	dev-init dev-up dev-down dev-rebuild dev-restart dev-restart-backend dev-logs dev-clean dev-db-migrate dev-db-upgrade dev-db-psql gen-sdk license format \
	prod-init prod-up prod-up-build prod-rebuild prod-down prod-restart prod-restart-backend prod-logs prod-clean prod-docs \
	set-version publish-ce-github publish-ce-images setup-hooks check-changed check-all smoke-test \
	_check_es_config

# ------------------------------------------------------------------------------
# 1. 跨平台配置 (Cross-Platform Config)
# ------------------------------------------------------------------------------
# 检测操作系统，适配 sed 命令 (macOS 使用 sed -i ''，Linux/WSL 使用 sed -i)
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
    SED_I := sed -i ''
else
    SED_I := sed -i
endif

# ------------------------------------------------------------------------------
# 2. 目录配置 (Directory Config)
# ------------------------------------------------------------------------------
# 生产部署目录 (由 脚本自动维护脱敏)
PROD_DIR ?= deploy/docker

# ------------------------------------------------------------------------------
# 3. 帮助信息 (Help Section)
# ------------------------------------------------------------------------------
help:
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo " 🐱 CatWiki 项目管理命令 (Project Management Commands)"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo " 💻 系统检测: $(UNAME_S)"
	@echo ""
	@echo " 🛠️  [开发环境] (Development Environment)"
	@echo "  make dev-init           - 初始化环境配置 (复制 .env.example)"
	@echo "  make dev-up             - 启动开发服务 (前台运行, 查看日志)"
	@echo "  make dev-up ES=1        - 启动开发服务，含 Elasticsearch"
	@echo "  make dev-down           - 停止开发容器"
	@echo "  make dev-rebuild        - 重建并启动开发环境 (后台运行)"
	@echo "  make dev-restart        - 重启开发环境所有服务"
	@echo "  make dev-restart-backend - 仅重启后端应用服务 (API + Worker)"
	@echo "  make dev-logs           - 查看开发环境所有服务日志"
	@echo "  make dev-logs-backend   - 查看开发环境后端日志 (API)"
	@echo "  make dev-clean          - 停止容器并删除数据卷 (重置数据库/存储)"
	@echo "  make dev-db-migrate m=\"\"  - 创建数据库迁移脚本"
	@echo "  make dev-db-upgrade     - 执行数据库迁移升级到最新版本"
	@echo "  make dev-db-psql        - 进入开发环境数据库终端"
	@echo ""
	@echo " 🚀  [生产环境] (Production Environment)"
	@echo "  make prod-init          - 初始化生产环境配置"
	@echo "  make prod-up            - 启动生产环境 (后台运行, 拉取远端镜像)"
	@echo "  make prod-up ES=1       - 同上，额外启动 Elasticsearch 服务"
	@echo "  make prod-up-build      - 启动生产环境并在本地构建 (后台运行)"
	@echo "  make prod-rebuild       - 无缓存重新构建并启动生产环境"
	@echo "  make prod-down          - 停止生产环境"
	@echo "  make prod-restart       - 重启生产环境所有服务"
	@echo "  make prod-restart-backend - 仅重启后端应用服务 (API + Worker)"
	@echo "  make prod-logs          - 查看生产环境所有服务日志"
	@echo "  make prod-clean         - 停止容器并删除数据卷 (❗危险：清空生产数据)"
	@echo ""
	@echo " 🧩  [通用命令] (Common Commands)"
	@echo "  make gen-sdk            - 生成前端 TypeScript SDK"
	@echo "  make license            - 为所有源文件自动注入 License Header"
	@echo "  make format             - 运行代码格式化 (后端+前端)"
	@echo "  make check-changed      - 仅检查已暂存改动 (增量)"
	@echo "  make check-all          - 全量规范检查 (后端+前端+类型)"
	@echo "  make smoke-test          - 运行冒烟测试 (t=platform 平台级, ai=0 跳过AI, c=0 保留数据)"
	@echo "  make setup-hooks        - 配置 Git hooksPath 到 scripts/git-hooks"
	@echo "  make help               - 显示此帮助信息"
	@echo ""
	@echo " 📦  [发布同步] (Release & Sync)"
	@echo "  make publish-ce-images  - 构建 CE 镜像并推送到 Docker Hub (公开仓库)"
	@echo "  make set-version v=1.1.7 - 统一修改项目版本号 (代码, 配置, 镜像标签)"
	@echo ""
	@echo " ⚠️  Windows 用户注意: 请使用 WSL2 或 Git Bash 运行 make 命令"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ------------------------------------------------------------------------------
# 3. [开发环境] Development Targets
# ------------------------------------------------------------------------------
# 可选参数: ES=1 启用 Elasticsearch 服务
# 示例: make dev-up ES=1
_ES_PROFILE = $(if $(ES),--profile es,)
_PROD_ES_PROFILE = $(if $(ES),--profile es,)

# 检查 ES 相关环境变量配置是否与 ES=1 参数一致
_check_es_config:
	@if [ ! -f backend/.env ]; then exit 0; fi; \
	STORE_TYPE=$$(grep -E '^VECTOR_STORE_TYPE=' backend/.env | cut -d= -f2 | tr -d ' \r'); \
	ES_URL_VAL=$$(grep -E '^ES_URL=' backend/.env | sed 's/^[^=]*=//' | tr -d ' \r'); \
	if [ "$(ES)" = "1" ]; then \
		if [ "$$STORE_TYPE" != "elasticsearch" ]; then \
			echo ""; \
			echo "❌ [ES 检查] 已指定 ES=1，但 backend/.env 中 VECTOR_STORE_TYPE=$$STORE_TYPE"; \
			echo "   若要启用 ES 检索，请在 backend/.env 中设置: VECTOR_STORE_TYPE=elasticsearch"; \
			echo "   若不需要 ES，请去掉 ES=1 参数"; \
			echo ""; \
			exit 1; \
		fi; \
		if [ -z "$$ES_URL_VAL" ]; then \
			echo "❌ [ES 检查] ES_URL 未配置，请在 backend/.env 中添加:"; \
			echo "   ES_URL=http://elasticsearch:9200"; \
			echo ""; \
			exit 1; \
		fi; \
	else \
		if [ "$$STORE_TYPE" = "elasticsearch" ]; then \
			echo ""; \
			echo "❌ [ES 检查] backend/.env 中 VECTOR_STORE_TYPE=elasticsearch，但未传入 ES=1"; \
			echo "   后端将尝试连接未启动的 Elasticsearch，建议改用: make dev-up ES=1"; \
			echo "   若要改回 PGVector，请在 backend/.env 中设置: VECTOR_STORE_TYPE=postgres"; \
			echo ""; \
			exit 1; \
		fi; \
	fi

# 初始化环境配置
dev-init:
	@echo "🔧 [CatWiki] 正在初始化环境配置..."
	@rm -f backend/.env
	@cp backend/.env.example backend/.env
	@$(SED_I) 's/^ENVIRONMENT=.*/ENVIRONMENT=dev/g' backend/.env
	@$(SED_I) 's/^DEBUG=.*/DEBUG=true/g' backend/.env
	@echo "✅ [CatWiki] 配置文件初始化完成！"

# 启动服务
dev-up: _check_es_config
	docker compose -f docker-compose.dev.yml $(_ES_PROFILE) up --build

# 停止服务
dev-down:
	docker compose -f docker-compose.dev.yml $(_ES_PROFILE) down

# 重建并启动服务
dev-rebuild: _check_es_config
	docker compose -f docker-compose.dev.yml $(_ES_PROFILE) up -d --build

# 重启开发环境所有服务
dev-restart: _check_es_config
	docker compose -f docker-compose.dev.yml $(_ES_PROFILE) restart

# 仅重启后端应用 (API + Worker)
dev-restart-backend:
	docker compose -f docker-compose.dev.yml restart backend worker

# 查看所有日志
dev-logs:
	docker compose -f docker-compose.dev.yml $(_ES_PROFILE) logs -f

# 查看后端日志
dev-logs-backend:
	docker compose -f docker-compose.dev.yml logs -f backend

# 深度清理开发环境
dev-clean:
	@echo "🧹 [开发环境] 正在尝试深度清理开发环境..."
	@echo "⚠️  警告：此操作将删除所有开发容器相关的数据卷和数据！"
	@read -p "您确定要继续吗？[y/N] " ans && [ $${ans:-N} = y ] || (echo "❌ 操作已取消"; exit 1)
	docker compose -f docker-compose.dev.yml $(_ES_PROFILE) down -v
	@echo "✅ 开发环境深度清理完成"

# 数据库迁移: 创建
dev-db-migrate:
	docker compose -f docker-compose.dev.yml exec backend uv run alembic revision --autogenerate -m "$(m)"

# 数据库迁移: 升级
dev-db-upgrade:
	docker compose -f docker-compose.dev.yml exec backend uv run alembic upgrade heads

# 数据库终端 (psql)
dev-db-psql:
	docker compose -f docker-compose.dev.yml exec postgres psql -U postgres -d catwiki

# ------------------------------------------------------------------------------
# 4. [生产环境] Production Targets
# ------------------------------------------------------------------------------
# 生产部署目录 (EE: docker-ee, CE 经 sync 后会被替换为 docker)

# 前置检查: 确保 .env 存在
check-prod-env:
	@if [ ! -f "$(PROD_DIR)/.env" ]; then \
		echo "❌ 未找到 $(PROD_DIR)/.env, 请先执行: make prod-init"; \
		exit 1; \
	fi

# 初始化生产环境配置
prod-init:
	@echo "🚀 开始初始化生产环境配置..."
	@mkdir -p $(PROD_DIR)
	@cp backend/.env.example $(PROD_DIR)/.env
	@$(SED_I) 's/^ENVIRONMENT=.*/ENVIRONMENT=prod/g' $(PROD_DIR)/.env
	@$(SED_I) 's/^DEBUG=.*/DEBUG=false/g' $(PROD_DIR)/.env
	@echo "✅ 生产环境配置模板已生成在 $(PROD_DIR)/ 目录下。"
	@echo "⚠️  请务必在运行 'make prod-up' 前修改敏感信息！"

# 启动生产环境
# 可选参数: ES=1 同时启动 Elasticsearch (示例: make prod-up ES=1)
prod-up: check-prod-env
	@docker network inspect catwiki-network >/dev/null 2>&1 || docker network create catwiki-network
	docker compose -f $(PROD_DIR)/docker-compose.yml pull
	docker compose -f $(PROD_DIR)/docker-compose.yml $(_PROD_ES_PROFILE) up -d

# 本地构建并启动生产环境
prod-up-build: check-prod-env
	@docker network inspect catwiki-network >/dev/null 2>&1 || docker network create catwiki-network
	docker compose -f $(PROD_DIR)/docker-compose.yml build backend admin-frontend client-frontend
	docker compose -f $(PROD_DIR)/docker-compose.yml $(_PROD_ES_PROFILE) up -d

# 无缓存重新构建并启动
prod-rebuild: check-prod-env
	@echo "🔧 [CatWiki] 无缓存重新构建生产环境..."
	@docker network inspect catwiki-network >/dev/null 2>&1 || docker network create catwiki-network
	docker compose -f $(PROD_DIR)/docker-compose.yml build --no-cache backend admin-frontend client-frontend
	docker compose -f $(PROD_DIR)/docker-compose.yml $(_PROD_ES_PROFILE) up -d

# 停止生产环境
prod-down: check-prod-env
	docker compose -f $(PROD_DIR)/docker-compose.yml $(_PROD_ES_PROFILE) down
	@if [ -f "$(PROD_DIR)/docker-compose.static.yml" ]; then \
		docker compose -f $(PROD_DIR)/docker-compose.static.yml down; \
	fi
	@docker rm -f catwiki-backend-init >/dev/null 2>&1 || true

# 查看生产环境所有日志
prod-logs: check-prod-env
	docker compose -f $(PROD_DIR)/docker-compose.yml logs -f
# 重启生产环境所有服务
prod-restart: check-prod-env
	docker compose -f $(PROD_DIR)/docker-compose.yml $(_PROD_ES_PROFILE) restart

# 仅重启后端应用 (API + Worker)
prod-restart-backend: check-prod-env
	docker compose -f $(PROD_DIR)/docker-compose.yml restart backend worker

# 深度清理生产环境
prod-clean: check-prod-env
	@echo "🛑 [危险] 正在尝试深度清理生产环境..."
	@echo "⚠️  警告：此操作将删除所有生产容器相关的数据卷和数据！"
	@read -p "您确定要继续吗？[y/N] " ans && [ $${ans:-N} = y ] || (echo "❌ 操作已取消"; exit 1)
	docker compose -f $(PROD_DIR)/docker-compose.yml down -v
	@if [ -f "$(PROD_DIR)/docker-compose.static.yml" ]; then \
		docker compose -f $(PROD_DIR)/docker-compose.static.yml down -v; \
	fi
	@docker rm -f catwiki-backend-init >/dev/null 2>&1 || true
	@echo "✅ 生产环境深度清理完成"


# ------------------------------------------------------------------------------
# 5. [通用命令] Common Targets
# ------------------------------------------------------------------------------
# API 冒烟测试
# 用法: make smoke-test            (默认租户级测试)
#       make smoke-test ai=0       (跳过AI测试)
#       make smoke-test c=0        (保留测试数据不删除)
#       make smoke-test t=platform  (平台管理测试)
smoke-test:
	@docker compose -f docker-compose.dev.yml exec backend uv run python scripts/smoke_tests/smoke_test_$(or $(t),tenant).py $(if $(filter 0,$(ai)),--skip-ai) $(if $(filter 0,$(c)),--no-cleanup)

# 生成前端 SDK
gen-sdk:
	@echo "⚙️  正在生成前端 SDK..."
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

# 增量检查 (仅对 staged 文件)
check-changed:
	@echo "🔎 运行增量检查 (staged files)..."
	@STAGED="$$(git diff --cached --name-only --diff-filter=ACMR)"; \
	if [ -z "$$STAGED" ]; then \
		echo "ℹ️ 未检测到已暂存改动，跳过增量检查。"; \
		exit 0; \
	fi; \
	PY_FILES="$$(printf '%s\n' "$$STAGED" | grep '^backend/.*\.py$$' || true)"; \
	if [ -n "$$PY_FILES" ]; then \
		echo "  - backend ruff (staged python)"; \
		REL_PY_FILES="$$(printf '%s\n' "$$PY_FILES" | sed 's#^backend/##')"; \
		cd backend && uv run ruff check $$REL_PY_FILES; \
		cd - >/dev/null; \
	fi; \
	if printf '%s\n' "$$STAGED" | grep -Eq '^frontend/admin/.*\.(ts|tsx)$$'; then \
		echo "  - frontend/admin eslint + tsc"; \
		cd frontend/admin && pnpm run lint && pnpm exec tsc --noEmit; \
		cd - >/dev/null; \
	fi; \
	if printf '%s\n' "$$STAGED" | grep -Eq '^frontend/client/.*\.(ts|tsx)$$'; then \
		echo "  - frontend/client eslint + tsc"; \
		cd frontend/client && pnpm run lint && pnpm exec tsc --noEmit; \
		cd - >/dev/null; \
	fi; \
	echo "✅ 增量检查通过"

# 全量检查
check-all:
	@echo "🔎 运行全量检查..."
	@echo "  - backend ruff"
	cd backend && uv run ruff check .
	@echo "  - frontend/admin eslint + tsc"
	cd frontend/admin && pnpm run lint && pnpm exec tsc --noEmit
	@echo "  - frontend/client eslint + tsc"
	cd frontend/client && pnpm run lint && pnpm exec tsc --noEmit
	@echo "  - i18n keys check"
	python3 scripts/check-i18n.py
	@echo "✅ 全量检查通过"

# 配置 Git hooks 路径
setup-hooks:
	@git config core.hooksPath scripts/git-hooks
	@echo "✅ 已配置 hooksPath: scripts/git-hooks"

# 自动注入 License Header
license:
	@echo "🔏 [CatWiki] 正在为源文件注入 License Header..."
	@python3 scripts/add_license_header.py
	@echo "✅ License Header 注入完成！"

# 统一修改版本号
set-version:
	@python3 scripts/version.py $(v)

# ------------------------------------------------------------------------------
# 6. [发布同步] Release & Sync Targets
# ------------------------------------------------------------------------------

# 构建 CE 镜像并推送到 Docker Hub (公开仓库)
# 参数可选: make publish-ce-images s=backend v=v1.0.0
publish-ce-images:
	@VERSION=$(v) bash scripts/publish_ce_images.sh $(s)

