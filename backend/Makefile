.PHONY: install dev run migrate upgrade downgrade test clean test-data gen-sdk lint lint-fix

# 安装依赖
install:
	uv sync

# 开发模式运行
dev:
	uv run uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload

# 运行服务
run:
	uv run uvicorn app.main:app --host 0.0.0.0 --port 3000

# 创建数据库迁移
migrate:
	uv run alembic revision --autogenerate -m "$(msg)"

# 应用迁移
upgrade:
	uv run alembic upgrade head

# 回滚迁移
downgrade:
	uv run alembic downgrade -1

# 运行测试
test:
	uv run pytest

# 清理缓存
clean:
	find . -type d -name __pycache__ -exec rm -r {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete

# 创建测试数据
test-data:
	uv run python scripts/create_test_data.py

# 生成前端 SDK
gen-sdk:
	@echo "正在生成前端 SDK..."
	@uv run python scripts/generate_sdk.py
	@echo "✅ SDK 生成完成!"


# 代码检查
lint:
	uv run ruff check .

# 代码检查并修复
lint-fix:
	uv run ruff check . --fix

