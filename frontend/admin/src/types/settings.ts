/**
 * 设置页面相关类型定义
 */

export type ModelConfig = {
  provider: string
  model: string
  apiKey: string
  baseUrl: string
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
  mode: "auto" | "manual"
  // 自动模式配置
  autoConfig: {
    provider: "bailian" | "openai" | "deepseek"
    apiKey: string
    models: {
      chat: string
      embedding: string
      rerank: string
      vl: string
    }
  }
  // 手动模式配置
  manualConfig: {
    chat: ModelConfig
    embedding: ModelConfig
    rerank: ModelConfig
    vl: ModelConfig
  }
  botConfig: BotConfig
}

export type ModelType = "models" | "chat" | "embedding" | "rerank" | "vl" | "security" | "users" | "sites"

export const initialConfigs: AIConfigs = {
  mode: "auto",
  autoConfig: {
    provider: "bailian",
    apiKey: "",
    models: {
      chat: "qwen3-max",
      embedding: "text-embedding-v4",
      rerank: "qwen3-rerank",
      vl: "qwen3-vl-plus"
    }
  },
  manualConfig: {
    chat: {
      provider: "deepseek",
      model: "deepseek-chat",
      apiKey: "",
      baseUrl: "https://api.deepseek.com"
    },
    embedding: {
      provider: "zhipu",
      model: "embedding-3",
      apiKey: "",
      baseUrl: "https://open.bigmodel.cn/api/paas/v4/"
    },
    rerank: {
      provider: "siliconflow",
      model: "BAAI/bge-reranker-v2-m3",
      apiKey: "",
      baseUrl: "https://api.siliconflow.cn/v1"
    },
    vl: {
      provider: "deepseek",
      model: "deepseek-chat",
      apiKey: "",
      baseUrl: "https://api.deepseek.com"
    }
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

