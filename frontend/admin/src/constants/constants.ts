/**
 * 常量定义
 * 统一管理所有常量，避免在多个文件中重复定义
 */

// ==================== 站点配置常量 ====================

import { env } from "@/lib/env"

// 客户端站点 URL（用于从管理后台跳转到客户端）
export const CLIENT_SITE_URL = env.NEXT_PUBLIC_CLIENT_URL

// ==================== 模型配置常量 ====================

// 模型提供商默认 Base URL 映射
export const PROVIDER_BASE_URLS: Record<string, string> = {
  deepseek: "https://api.deepseek.com",
  siliconflow: "https://api.siliconflow.cn/v1",
  moonshot: "https://api.moonshot.cn/v1",
  bailian: "https://dashscope.aliyuncs.com/api/v1",
  volcengine: "https://ark.cn-beijing.volces.com/api/v3",
  openai: "https://api.openai.com/v1",
  local: "http://localhost:11434/v1"
} as const

// 阿里云百炼可选模型列表
export const BAILIAN_MODEL_OPTIONS = {
  chat: [
    { label: "Qwen3-Max", value: "qwen3-max" },
  ],
  embedding: [
    { label: "Text-Embedding-V4", value: "text-embedding-v4" },
    { label: "Text-Embedding-V3", value: "text-embedding-v3" },
  ],
  rerank: [
    { label: "Qwen3-Rerank", value: "qwen3-rerank" },
    { label: "GTE-Rerank-V2", value: "gte-rerank-v2" },
  ],
  vl: [
    { label: "Qwen3-VL-Plus", value: "qwen3-vl-plus" },
  ]
} as const

