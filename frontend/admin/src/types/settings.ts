/**
 * 设置页面相关类型定义
 */

export type ModelConfig = {
  provider: string
  model: string
  apiKey: string
  baseUrl: string
  dimension?: number
}

export type BotConfig = {
  webWidget: {
    enabled: boolean
    title: string
    welcomeMessage: string
    primaryColor: string
    position: "left" | "right"
  }
  apiBot: {
    enabled: boolean
    apiEndpoint: string
    apiKey: string
    timeout: number
  }
  wechat: {
    enabled: boolean
    appId: string
    appSecret: string
    token: string
    encodingAESKey: string
  }
}

export type AIConfigs = {
  chat: ModelConfig
  embedding: ModelConfig
  rerank: ModelConfig
  vl: ModelConfig
  botConfig: BotConfig
}

export type ModelType = "models" | "chat" | "embedding" | "rerank" | "vl" | "security" | "users" | "sites"

export const MODEL_TYPES = ["chat", "embedding", "rerank", "vl"] as const

export const initialConfigs: AIConfigs = {
  chat: {
    provider: "openai",
    model: "",
    apiKey: "",
    baseUrl: ""
  },
  embedding: {
    provider: "openai",
    model: "",
    apiKey: "",
    baseUrl: ""
  },
  rerank: {
    provider: "openai",
    model: "",
    apiKey: "",
    baseUrl: ""
  },
  vl: {
    provider: "openai",
    model: "",
    apiKey: "",
    baseUrl: ""
  },
  botConfig: {
    webWidget: {
      enabled: false,
      title: "AI 客服助手",
      welcomeMessage: "您好！我是 AI 助手，有什么可以帮您？",
      primaryColor: "#3b82f6",
      position: "right"
    },
    apiBot: {
      enabled: false,
      apiEndpoint: "",
      apiKey: "",
      timeout: 30
    },
    wechat: {
      enabled: false,
      appId: "",
      appSecret: "",
      token: "",
      encodingAESKey: ""
    }
  }
}

// 阿里云百炼基础配置
export const BAILIAN_BASE = {
  provider: "bailian",
  baseUrl: "https://dashscope.aliyuncs.com/api/v1"
}

// ============ 文档处理服务配置 ============

export type DocProcessorType = "docling" | "mineru" | "paddleocr" | "tianshu"

export type DocProcessorConfig = {
  name: string
  type: DocProcessorType
  baseUrl: string
  apiKey: string
  enabled: boolean
}

export const DOC_PROCESSOR_TYPES: { value: DocProcessorType; label: string; description: string; docUrl?: string }[] = [
  { value: "docling", label: "Docling", description: "IBM 开源文档处理引擎", docUrl: "https://github.com/docling-project/docling-serve" },
  { value: "mineru", label: "MinerU", description: "高质量文档解析工具", docUrl: "https://opendatalab.github.io/MinerU/zh/quick_start/docker_deployment/#docker-compose" },
  { value: "paddleocr", label: "PaddleOCR", description: "百度 OCR 引擎", docUrl: "https://www.paddleocr.ai/main/version3.x/pipeline_usage/PaddleOCR-VL.html#41-docker-compose" },
  { value: "tianshu", label: "天枢", description: "天枢文档解析引擎", docUrl: "https://github.com/magicyuan876/mineru-tianshu" },
]

export const initialDocProcessorConfig: DocProcessorConfig = {
  name: "",
  type: "docling",
  baseUrl: "",
  apiKey: "",
  enabled: true,
}
