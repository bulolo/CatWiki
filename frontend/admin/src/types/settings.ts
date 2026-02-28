// Copyright 2026 CatWiki Authors
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
 *
 * ⚠️ 规范：ModelConfig / DocProcessorConfig / DocProcessorType
 *    均从 SDK 导入，禁止重复定义
 */

import {
  type ModelConfig,
  type DocProcessorConfig as SdkDocProcessorConfig,
  DocProcessorType,
  ModelConfig as ModelConfigEnum,
} from '@/lib/api-client'

// ==================== 从 SDK 重新导出 ====================
export type { ModelConfig }
export { DocProcessorType }

// SDK 的 DocProcessorConfig 扩展：增加前端专用 'origin' 字段
export type DocProcessorConfig = SdkDocProcessorConfig & {
  origin?: 'platform' | 'tenant'
}

export type BotConfig = {
  web_widget: {
    enabled: boolean
    title: string
    welcome_message: string
    primary_color: string
    position: "left" | "right"
  }
  api_bot: {
    enabled: boolean
    api_key: string
    timeout: number
  }
  wecom_smart: {
    enabled: boolean
    token: string
    encoding_aes_key: string
  }
  feishu_app: {
    enabled: boolean
    app_id: string
    app_secret: string
  }
  dingtalk_app: {
    enabled: boolean
    client_id: string
    client_secret: string
    template_id: string
  }
  wecom_kefu: {
    enabled: boolean
    corp_id: string
    secret: string
    token: string
    encoding_aes_key: string
    welcome_message?: string
  }
  wecom_app: {
    enabled: boolean
    corp_id: string
    agent_id: string
    secret: string
    token: string
    encoding_aes_key: string
  }
  discord_app?: {
    enabled?: boolean
  }
  telegram_app?: {
    enabled?: boolean
  }
}

export type AIConfigs = {
  chat: ModelConfig
  embedding: ModelConfig
  rerank: ModelConfig
  vl: ModelConfig
  bot_config: BotConfig
}

export type SettingsTabId = "models" | "chat" | "embedding" | "rerank" | "vl" | "security" | "users" | "sites"

export const MODEL_TYPES = ["chat", "embedding", "rerank", "vl"] as const

export const initialConfigs: AIConfigs = {
  chat: {
    provider: "openai",
    model: "",
    api_key: "",
    base_url: "",
    mode: ModelConfigEnum.mode.CUSTOM,
    is_vision: false,
    extra_body: {}
  },
  embedding: {
    provider: "openai",
    model: "",
    api_key: "",
    base_url: "",
    mode: ModelConfigEnum.mode.CUSTOM,
    is_vision: false
  },
  rerank: {
    provider: "openai",
    model: "",
    api_key: "",
    base_url: "",
    mode: ModelConfigEnum.mode.CUSTOM,
    is_vision: false
  },
  vl: {
    provider: "openai",
    model: "",
    api_key: "",
    base_url: "",
    mode: ModelConfigEnum.mode.CUSTOM,
    is_vision: true
  },
  bot_config: {
    web_widget: {
      enabled: false,
      title: "AI 客服助手",
      welcome_message: "您好！我是 AI 助手，有什么可以帮您？",
      primary_color: "#3b82f6",
      position: "right"
    },
    api_bot: {
      enabled: false,
      api_key: "",
      timeout: 30
    },
    wecom_smart: {
      enabled: false,
      token: "",
      encoding_aes_key: ""
    },
    feishu_app: {
      enabled: false,
      app_id: "",
      app_secret: ""
    },
    dingtalk_app: {
      enabled: false,
      client_id: "",
      client_secret: "",
      template_id: ""
    },
    wecom_kefu: {
      enabled: false,
      corp_id: "",
      secret: "",
      token: "",
      encoding_aes_key: "",
      welcome_message: ""
    },
    wecom_app: {
      enabled: false,
      corp_id: "",
      agent_id: "",
      secret: "",
      token: "",
      encoding_aes_key: ""
    },
    discord_app: {
      enabled: false
    },
    telegram_app: {
      enabled: false
    }
  }
}

// 阿里云百炼基础配置
export const BAILIAN_BASE = {
  provider: "bailian",
  base_url: "https://dashscope.aliyuncs.com/api/v1"
}

// ============ 文档处理服务配置 ============

export const DOC_PROCESSOR_TYPES: { value: DocProcessorType; label: string; description: string; endpoint: string; docUrl?: string; icon: string; color: string; disabled?: boolean }[] = [
  { value: DocProcessorType.MINER_U, label: "MinerU", description: "高质量文档解析工具", endpoint: "/file_parse", docUrl: "https://opendatalab.github.io/MinerU/zh/quick_start/docker_deployment/#docker-compose", icon: "/icons/mineru.svg", color: "text-amber-600 bg-amber-50" },
  { value: DocProcessorType.DOCLING, label: "Docling", description: "IBM 开源文档处理引擎 (支持 X-Api-Key 鉴权)", endpoint: "/v1/convert/file", docUrl: "https://github.com/docling-project/docling-serve", icon: "/icons/docling.svg", color: "text-indigo-600 bg-indigo-50" },
  { value: DocProcessorType.PADDLE_OCR, label: "PaddleOCR", description: "百度飞桨 PaddleOCR-VL 布局解析引擎", endpoint: "/layout-parsing", docUrl: "https://github.com/PaddlePaddle/PaddleOCR", icon: "/icons/paddleocr.svg", color: "text-blue-600 bg-blue-50" },
]

export const initialDocProcessorConfig: DocProcessorConfig = {
  name: "",
  type: DocProcessorType.MINER_U,
  base_url: "",
  api_key: "",
  enabled: true,
  config: {
    is_ocr: true,
    extract_images: false,
    extract_tables: true
  }
}

