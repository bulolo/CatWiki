// Copyright 2024 CatWiki Authors
// 
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     https://github.com/CatWiki/CatWiki/blob/main/LICENSE
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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

  wecomSmartRobot: {
    enabled: boolean
    callbackUrl: string
    token: string
    encodingAesKey: string
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

    wecomSmartRobot: {
      enabled: false,
      callbackUrl: "",
      token: "",
      encodingAesKey: ""
    }
  }
}

// 阿里云百炼基础配置
export const BAILIAN_BASE = {
  provider: "bailian",
  baseUrl: "https://dashscope.aliyuncs.com/api/v1"
}

// ============ 文档处理服务配置 ============

export type DocProcessorType = "Docling" | "MinerU" | "PaddleOCR"

export type DocProcessorConfig = {
  name: string
  type: DocProcessorType
  baseUrl: string
  apiKey: string
  enabled: boolean
  config?: Record<string, any>
}

export const DOC_PROCESSOR_TYPES: { value: DocProcessorType; label: string; description: string; endpoint: string; docUrl?: string; icon: string; color: string; disabled?: boolean }[] = [
  { value: "MinerU", label: "MinerU", description: "高质量文档解析工具", endpoint: "/file_parse", docUrl: "https://opendatalab.github.io/MinerU/zh/quick_start/docker_deployment/#docker-compose", icon: "/icons/mineru.svg", color: "text-amber-600 bg-amber-50" },
  { value: "Docling", label: "Docling", description: "IBM 开源文档处理引擎 (支持 X-Api-Key 鉴权)", endpoint: "/v1/convert/file", docUrl: "https://github.com/docling-project/docling-serve", icon: "/icons/docling.svg", color: "text-indigo-600 bg-indigo-50" },
  { value: "PaddleOCR", label: "PaddleOCR", description: "百度飞桨 PaddleOCR-VL 布局解析引擎", endpoint: "/layout-parsing", docUrl: "https://github.com/PaddlePaddle/PaddleOCR", icon: "/icons/paddleocr.svg", color: "text-blue-600 bg-blue-50" },
]

export const initialDocProcessorConfig: DocProcessorConfig = {
  name: "",
  type: "MinerU",
  baseUrl: "",
  apiKey: "",
  enabled: true,
  config: {
    is_ocr: true,
    extract_images: false,
    extract_tables: true
  }
}
