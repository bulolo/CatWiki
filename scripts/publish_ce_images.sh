#!/bin/bash
set -e

# ==============================================================================
# CatWiki CE 镜像打包并推送到 Docker Hub 的脚本
#
# 请在 ce 分支上运行此脚本。
# 前提：已运行过 make sync-ce 生成 ce 分支。
#
# 环境变量 (可选，未设置时会交互式输入):
#   DOCKERHUB_USERNAME  - Docker Hub 用户名
#   DOCKERHUB_TOKEN     - Docker Hub Access Token
#   DOCKERHUB_NAMESPACE - Docker Hub 组织/用户名空间 (默认: bulolo)
#   VERSION             - 镜像版本标签 (默认: latest)
#
# Usage:
#   make publish-ce-images               # 构建并推送所有 CE 镜像
#   make publish-ce-images s=backend     # 仅构建并推送指定服务
#   make publish-ce-images v=v1.0.0      # 指定版本号
# ==============================================================================

REGISTRY="docker.io"
NAMESPACE=${DOCKERHUB_NAMESPACE:-"bulolo"}
VERSION=${VERSION:-"latest"}

echo "=========================================="
echo "🚀 开始构建并推送 CatWiki CE 镜像到 Docker Hub"
echo "📦 目标仓库: ${NAMESPACE}/*"
echo "🏷️  镜像版本: ${VERSION}"
echo "=========================================="

# ---- 分支检查 ----
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "ce" ]; then
    echo ""
    echo "❌ 当前分支为 ${CURRENT_BRANCH}，此脚本需要在 ce 分支上运行。"
    echo "   请先执行: git checkout ce"
    exit 1
fi
echo "📌 当前分支: ${CURRENT_BRANCH}"

# ---- 凭证处理 ----
if [ -z "${DOCKERHUB_USERNAME:-}" ]; then
    echo ""
    read -r -p "🔑 请输入 Docker Hub 用户名: " DOCKERHUB_USERNAME
    if [ -z "$DOCKERHUB_USERNAME" ]; then
        echo "❌ 用户名不能为空"
        exit 1
    fi
fi

if [ -z "${DOCKERHUB_TOKEN:-}" ]; then
    read -r -s -p "🔑 请输入 Docker Hub 密码/Access Token: " DOCKERHUB_TOKEN
    echo ""
    if [ -z "$DOCKERHUB_TOKEN" ]; then
        echo "❌ 密码不能为空"
        exit 1
    fi
fi

# 获取项目根目录
ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

# 登录 Docker Hub
echo ""
echo "🔑 正在登录 Docker Hub..."
echo "$DOCKERHUB_TOKEN" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin

# CE 版本不包含 website，其余服务保持一致
# 格式: 服务名称(用于镜像名):相对构建路径:Dockerfile名称
SERVICES=(
  "backend:backend:Dockerfile.prod"
  "admin:frontend/admin:Dockerfile.prod"
  "client:frontend/client:Dockerfile.prod"
)

TARGET_SERVICE=$1
if [ -n "$TARGET_SERVICE" ]; then
  echo ""
  echo "🎯 将仅构建并推送服务: ${TARGET_SERVICE}"
fi

# 用于记录构建失败的服务
FAILED_SERVICES=()

for SERVICE_CONFIG in "${SERVICES[@]}"; do
  # 解析配置
  IFS=':' read -r SERVICE_NAME CONTEXT_DIR DOCKERFILE <<< "$SERVICE_CONFIG"

  # 如果指定了目标服务且当前服务不匹配，则跳过
  if [ -n "$TARGET_SERVICE" ] && [ "$TARGET_SERVICE" != "$SERVICE_NAME" ]; then
    continue
  fi

  # 检查构建上下文是否存在
  if [ ! -d "$CONTEXT_DIR" ]; then
    echo ""
    echo "⚠️  [${SERVICE_NAME}] 构建上下文 ${CONTEXT_DIR} 不存在，跳过。"
    continue
  fi

  # Docker Hub 镜像名称: <namespace>/catwiki-<service>:<version>
  IMAGE_NAME="catwiki-${SERVICE_NAME}"
  FULL_IMAGE_NAME="${NAMESPACE}/${IMAGE_NAME}:${VERSION}"

  echo ""
  echo "------------------------------------------"
  echo "🔨 [${SERVICE_NAME}] 开始构建 CE 镜像..."
  echo "📁 构建上下文: ${CONTEXT_DIR}"
  echo "📄 Dockerfile: ${DOCKERFILE}"
  echo "🏷️  镜像标签: ${FULL_IMAGE_NAME}"
  echo "------------------------------------------"

  # 构建镜像
  if docker build -t "$FULL_IMAGE_NAME" -f "${CONTEXT_DIR}/${DOCKERFILE}" "${CONTEXT_DIR}"; then
    # backend-init 复用 backend 镜像
    if [ "$SERVICE_NAME" == "backend" ]; then
      INIT_IMAGE_NAME="${NAMESPACE}/catwiki-backend-init:${VERSION}"
      echo "🏷️  [backend-init] 从 backend 镜像标记为 ${INIT_IMAGE_NAME}..."
      docker tag "$FULL_IMAGE_NAME" "$INIT_IMAGE_NAME"

      echo "☁️  [backend-init] 推送到 Docker Hub..."
      docker push "$INIT_IMAGE_NAME"
    fi

    echo "☁️  [${SERVICE_NAME}] 推送到 Docker Hub..."
    docker push "$FULL_IMAGE_NAME"

    # 如果版本不是 latest，额外打一个 latest 标签
    if [ "$VERSION" != "latest" ]; then
      LATEST_IMAGE_NAME="${NAMESPACE}/${IMAGE_NAME}:latest"
      docker tag "$FULL_IMAGE_NAME" "$LATEST_IMAGE_NAME"
      docker push "$LATEST_IMAGE_NAME"
      echo "🏷️  [${SERVICE_NAME}] 同时推送 latest 标签"

      if [ "$SERVICE_NAME" == "backend" ]; then
        INIT_LATEST="${NAMESPACE}/catwiki-backend-init:latest"
        docker tag "$FULL_IMAGE_NAME" "$INIT_LATEST"
        docker push "$INIT_LATEST"
      fi
    fi
  else
    echo "❌ [${SERVICE_NAME}] 构建失败！"
    FAILED_SERVICES+=("$SERVICE_NAME")
  fi
done

# 输出结果
echo ""
echo "=========================================="
if [ ${#FAILED_SERVICES[@]} -eq 0 ]; then
  echo "🎉 所有 CE 镜像构建并推送成功！"
else
  echo "⚠️  以下服务构建失败: ${FAILED_SERVICES[*]}"
fi
echo ""
echo "📦 镜像仓库: https://hub.docker.com/u/${NAMESPACE}"
echo "=========================================="

# 如果有失败则返回非零退出码
if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
  exit 1
fi
