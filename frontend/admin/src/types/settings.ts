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

