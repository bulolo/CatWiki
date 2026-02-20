#!/bin/bash
# ============================================================
# CatWiki CE Sync Script
# 从 ee 分支生成 CE (Community Edition) 并推送到 origin/ce
#
# Usage: ./scripts/sync_ce.sh [--dry-run]
#   --dry-run  预览变更，不推送
# ============================================================

set -eo pipefail

# ---- 配置 ----
SOURCE_BRANCH="ee"
CE_BRANCH="ce"
ORIGIN_REMOTE="origin"

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
    DRY_RUN=true
    echo "[DRY RUN] 预览模式，不会推送。"
fi

echo "================================================"
echo "  CatWiki CE 同步工具"
echo "  ee → origin/ce"
echo "================================================"

# ---- 前置检查 ----
if [ ! -f "README.md" ] || [ ! -d "backend" ]; then
    echo "ERROR: 请在项目根目录运行此脚本。"
    exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
    echo "ERROR: 工作区不干净，请先提交或暂存修改。"
    git status --short
    exit 1
fi

CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$SOURCE_BRANCH" ]; then
    echo "ERROR: 请先切换到 $SOURCE_BRANCH 分支（当前在 $CURRENT_BRANCH）。"
    exit 1
fi

if ! git remote | grep -q "^${ORIGIN_REMOTE}$"; then
    echo "ERROR: Remote '$ORIGIN_REMOTE' 不存在。"
    exit 1
fi

echo "[OK] 前置检查通过。"
echo ""

# ---- 准备 ce 分支并应用最新代码 ----
echo "[1/6] 在 $CE_BRANCH 分支上应用来自 $SOURCE_BRANCH 的最新更改..."

# 检查本地或远程是否存在 CE_BRANCH，并切换
if git show-ref --verify --quiet "refs/heads/$CE_BRANCH"; then
    git checkout "$CE_BRANCH"
elif git ls-remote --exit-code --heads "$ORIGIN_REMOTE" "$CE_BRANCH" > /dev/null 2>&1; then
    git checkout -b "$CE_BRANCH" "$ORIGIN_REMOTE/$CE_BRANCH"
else
    git checkout --orphan "$CE_BRANCH"
fi

# 强行用源分支的文件状态覆盖当前的工作区和暂存区
git rm -rf . >/dev/null 2>&1 || true
git restore --source="$SOURCE_BRANCH" --staged --worktree .

# ---- 删除 EE 专有文件 ----
echo "[2/6] 删除 EE 专有文件..."

if [ -d "backend/app/ee" ]; then
    rm -rf "backend/app/ee"
    echo "  [DELETED] backend/app/ee/"
else
    echo "  [SKIP] backend/app/ee/ (不存在)"
fi

if [ -d "telemetry-backend" ]; then
    rm -rf "telemetry-backend"
    echo "  [DELETED] telemetry-backend/"
else
    echo "  [SKIP] telemetry-backend/ (不存在)"
fi

if [ -f ".gitlab-ci.yml" ]; then
    rm -f ".gitlab-ci.yml"
    echo "  [DELETED] .gitlab-ci.yml"
else
    echo "  [SKIP] .gitlab-ci.yml (不存在)"
fi

# ---- 适配单租户 CE ----
echo "[3/6] 适配单租户 CE 模式..."

# 删除 baby 租户初始化脚本（CE 仅保留 health demo）
if [ -f "backend/scripts/init_baby_tenant.py" ]; then
    rm -f "backend/scripts/init_baby_tenant.py"
    echo "  [DELETED] init_baby_tenant.py (CE 仅保留 health demo)"
fi
if [ -f "backend/scripts/data/baby_care.json" ]; then
    rm -f "backend/scripts/data/baby_care.json"
    echo "  [DELETED] baby_care.json"
fi

# 删除平台级管理员初始化数据（CE 单租户下不需要）
if [ -f "backend/scripts/init_admin_data.py" ]; then
    rm -f "backend/scripts/init_admin_data.py"
    echo "  [DELETED] init_admin_data.py"
fi
if [ -f "backend/scripts/data/admin.json" ]; then
    rm -f "backend/scripts/data/admin.json"
    echo "  [DELETED] admin.json"
fi
if [ -f "backend/scripts/seeders/admin_seeder.py" ]; then
    rm -f "backend/scripts/seeders/admin_seeder.py"
    echo "  [DELETED] admin_seeder.py"
fi

# 修改 health_care.json 为单租户默认值
if [ -f "backend/scripts/data/health_care.json" ]; then
    python3 -c "
import json
with open('backend/scripts/data/health_care.json', 'r') as f:
    data = json.load(f)
data['tenant']['name'] = 'CatWiki Demo'
data['tenant']['slug'] = 'default'
data['tenant']['description'] = 'CatWiki 社区版默认团队'
if 'role' in data.get('admin', {}):
    data['admin']['role'] = 'admin'
with open('backend/scripts/data/health_care.json', 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
"
    echo "  [UPDATED] health_care.json → 单租户模式"
fi

# 从 docker-compose.dev.yml 移除 baby init
if [ -f "docker-compose.dev.yml" ]; then
    sed -i '' '/初始化 Baby 站点/d' "docker-compose.dev.yml"
    sed -i '' '/init_baby_tenant/d' "docker-compose.dev.yml"
    sed -i '' '/Baby 数据初始化完成/d' "docker-compose.dev.yml"
    sed -i '' '/Baby 站点/d' "docker-compose.dev.yml"
    sed -i '' '/baby-guide/d' "docker-compose.dev.yml"
    
    # 移除平台管理员初始化（CE 不包含）
    sed -i '' '/init_admin_data/d' "docker-compose.dev.yml"
    sed -i '' '/初始化系统平台默认管理员/d' "docker-compose.dev.yml"
    
    echo "  [UPDATED] docker-compose.dev.yml → 移除 baby init 和 admin init"
fi

# 从 docker-compose.prod.yml 移除 baby init 并修复默认值
if [ -f "deploy/docker/docker-compose.prod.yml" ]; then
    sed -i '' '/init_baby_tenant/d' "deploy/docker/docker-compose.prod.yml"
    sed -i '' '/Baby 数据初始化完成/d' "deploy/docker/docker-compose.prod.yml"
    sed -i '' '/Baby 站点/d' "deploy/docker/docker-compose.prod.yml"
    sed -i '' '/baby-guide/d' "deploy/docker/docker-compose.prod.yml"
    
    # 移除平台管理员初始化（CE 不包含）
    sed -i '' '/init_admin_data/d' "deploy/docker/docker-compose.prod.yml"
    sed -i '' '/初始化系统平台默认管理员/d' "deploy/docker/docker-compose.prod.yml"
    
    # 修复 docker-compose 中的默认值
    sed -i '' 's/NEXT_PUBLIC_CATWIKI_EDITION:-enterprise/NEXT_PUBLIC_CATWIKI_EDITION:-community/g' "deploy/docker/docker-compose.prod.yml"
    echo "  [UPDATED] docker-compose.prod.yml → 移除 baby init, admin init, 修复默认值"
fi

# ---- 修改 env 配置 ----
echo "[4/6] 更新 .env 配置为 community..."

update_env_file() {
    local f="$1"
    if [ -f "$f" ]; then
        local changed=false
        # 替换 CATWIKI_EDITION
        if grep -q "CATWIKI_EDITION=enterprise" "$f" 2>/dev/null; then
            sed -i '' 's/CATWIKI_EDITION=enterprise/CATWIKI_EDITION=community/g' "$f"
            changed=true
        fi
        if grep -q "NEXT_PUBLIC_CATWIKI_EDITION=enterprise" "$f" 2>/dev/null; then
            sed -i '' 's/NEXT_PUBLIC_CATWIKI_EDITION=enterprise/NEXT_PUBLIC_CATWIKI_EDITION=community/g' "$f"
            changed=true
        fi
        # 清空 license key
        if grep -q "CATWIKI_LICENSE_KEY=." "$f" 2>/dev/null; then
            sed -i '' 's/CATWIKI_LICENSE_KEY=.*/CATWIKI_LICENSE_KEY=/g' "$f"
            changed=true
        fi
        if [ "$changed" = "true" ]; then
            echo "  [UPDATED] $f → community"
        else
            echo "  [SKIP] $f (已是 community)"
        fi
    fi
}

update_env_file "backend/.env.example"
update_env_file "backend/.env"
update_env_file "deploy/docker/.env.backend"
update_env_file "deploy/docker/.env.admin"
update_env_file "deploy/docker/.env.client"
update_env_file "frontend/admin/.env.example"
update_env_file "frontend/admin/.env"
update_env_file "frontend/client/.env.example"
update_env_file "frontend/client/.env"

# ---- 安全检查 ----
echo "[5/6] 运行安全检查..."

SAFE=true

if [ -d "backend/app/ee" ]; then
    echo "  [FAIL] backend/app/ee/ 仍然存在！"
    SAFE=false
else
    echo "  [PASS] backend/app/ee/ 已删除"
fi

if grep -rq "EDITION=enterprise" deploy/ backend/.env.example frontend/admin/.env.example 2>/dev/null; then
    ENTERPRISE_COUNT=$(grep -rc "EDITION=enterprise" deploy/ backend/.env.example frontend/admin/.env.example 2>/dev/null | grep -v ":0$" | wc -l | tr -d ' ')
    echo "  [FAIL] $ENTERPRISE_COUNT 个 env 文件仍设为 enterprise"
    grep -rn "EDITION=enterprise" deploy/ backend/.env.example frontend/admin/.env.example 2>/dev/null
    SAFE=false
else
    echo "  [PASS] 所有 .env 已设为 community"
fi

if [ -d "telemetry-backend" ]; then
    echo "  [FAIL] telemetry-backend/ 仍然存在！"
    SAFE=false
else
    echo "  [PASS] telemetry-backend/ 已删除"
fi

# 检查 license key 泄漏
if grep -rn "CATWIKI_LICENSE_KEY=ey" deploy/ backend/.env.example 2>/dev/null; then
    echo "  [FAIL] env 文件中存在 License Key！"
    SAFE=false
else
    echo "  [PASS] 无 License Key 泄漏"
fi

if [ "$SAFE" != "true" ]; then
    echo ""
    echo "ERROR: 安全检查失败，中止操作。"
    # 如果失败了，重置当前分支工作区并切回源分支
    git reset --hard HEAD
    git checkout "$SOURCE_BRANCH"
    exit 1
fi

echo "  [PASS] 所有安全检查通过"

# ---- 提交并推送 ----
echo "[6/6] 提交 CE 版本..."

git add -A
git commit -m "release: sync CE from EE $(date +%Y-%m-%d)" --allow-empty

echo ""
echo "======== CE 变更摘要 ========"
git diff --stat HEAD~1
echo "============================="
echo ""

if [ "$DRY_RUN" = "true" ]; then
    echo "[DRY RUN] 跳过推送。"
else
    echo "准备推送到 ${ORIGIN_REMOTE}/${CE_BRANCH} (线性提交)..."
    echo ""
    read -p "推送到 origin/ce？(y/N): " CONFIRM
    if [ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ]; then
        git push "$ORIGIN_REMOTE" "${CE_BRANCH}:${CE_BRANCH}"
        echo "[OK] 已推送到 ${ORIGIN_REMOTE}/${CE_BRANCH}"
    else
        echo "[CANCELLED] 推送已取消。"
    fi
fi

# ---- 清理 ----
git checkout "$SOURCE_BRANCH"

echo ""
echo "================================================"
echo "  CE 同步完成！"
echo ""
echo "  下一步："
echo "  1. 在 CodeUp 上检查 ce 分支"
echo "  2. 确认无误后运行: make publish-ce"
echo "================================================"
