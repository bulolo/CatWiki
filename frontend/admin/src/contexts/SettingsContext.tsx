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
 * 设置页面的状态管理 Context
 * 统一管理配置状态、更新逻辑和保存操作
 */

"use client"

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react"
import { toast } from "sonner"
import { useAllConfigs, useUpdateAIConfig, useUpdateBotConfig } from "@/hooks"
import { type AIModelConfig, type BotConfig as ApiBotConfigType, AIConfigUpdate, WebWidgetConfig } from "@/lib/api-client"
import { logError } from "@/lib/error-handler"
import { type AIConfigs, type ModelType, type BotConfig, initialConfigs, MODEL_TYPES } from "@/types/settings"

// 深度合并函数
const deepMerge = (target: any, source: any): any => {
  if (!source) return target
  if (typeof source !== 'object' || typeof target !== 'object') return source || target

  const result = { ...target }
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key])
    } else {
      result[key] = source[key] !== undefined && source[key] !== null ? source[key] : target[key]
    }
  }
  return result
}

interface SettingsContextType {
  // 配置状态
  configs: AIConfigs
  savedConfigs: AIConfigs
  isLoading: boolean
  isAiDirty: boolean

  // 更新函数
  handleUpdate: (type: string, field: string, value: string | boolean | number) => void
  handleSave: () => Promise<void>
  handleSaveBotConfig: () => Promise<void>

  // 工具函数
  isModelConfigured: (modelType: "chat" | "embedding" | "rerank" | "vl") => boolean
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [configs, setConfigs] = useState<AIConfigs>(initialConfigs)
  const [savedConfigs, setSavedConfigs] = useState<AIConfigs>(initialConfigs)
  const isSwitchingMode = useRef(false)

  // 使用 React Query hooks
  const { data: allConfigsData, isLoading } = useAllConfigs()
  const updateAIConfigMutation = useUpdateAIConfig()
  const updateBotConfigMutation = useUpdateBotConfig()



  // 当配置数据加载完成时，合并到本地状态
  useEffect(() => {
    if (allConfigsData) {
      let loadedConfigs: AIConfigs = { ...initialConfigs }

      if (allConfigsData.aiConfig) {
        // [MODIFIED] 直接使用后端返回的扁平结构
        const aiData = allConfigsData.aiConfig as any

        const chatConfig = aiData.chat
        const embeddingConfig = aiData.embedding
        const rerankConfig = aiData.rerank
        const vlConfig = aiData.vl

        loadedConfigs = {
          ...loadedConfigs,
          chat: deepMerge(initialConfigs.chat, chatConfig),
          embedding: deepMerge(initialConfigs.embedding, embeddingConfig),
          rerank: deepMerge(initialConfigs.rerank, rerankConfig),
          vl: deepMerge(initialConfigs.vl, vlConfig),
        }
      }

      if (allConfigsData.botConfig) {
        loadedConfigs.botConfig = deepMerge(initialConfigs.botConfig, allConfigsData.botConfig)
      }

      setConfigs(loadedConfigs)
      setSavedConfigs(loadedConfigs)
    }
  }, [allConfigsData])

  const handleUpdate = (type: string, field: string, value: string | boolean | number) => {
    setConfigs(prev => {
      const newConfigs = { ...prev }

      // 处理 AI 模型配置 (chat, embedding, rerank, vl)
      if (MODEL_TYPES.includes(type as any)) {
        const modelType = type as (typeof MODEL_TYPES)[number]
        const modelConfig = prev[modelType]
        const updatedConfig = { ...modelConfig, [field]: value }
        newConfigs[modelType] = updatedConfig
      }
      // 处理机器人配置
      else if (type === "botConfig") {
        const [botType, botField] = field.split(".")
        newConfigs.botConfig = {
          ...prev.botConfig,
          [botType]: {
            ...prev.botConfig[botType as keyof BotConfig],
            [botField]: value
          }
        }
      }

      return newConfigs
    })
  }

  const handleSave = async () => {
    // 构建完整的 AI 配置对象 (扁平结构)
    const aiConfig: AIModelConfig = {
      chat: configs.chat,
      embedding: configs.embedding,
      rerank: configs.rerank,
      vl: configs.vl
    }

    updateAIConfigMutation.mutate(aiConfig, {
      onSuccess: (data: any) => {
        // [MODIFIED] 直接使用后端返回的最新配置更新本地状态
        // 这样可以立即显示自动探测的 dimension，而无需等待 refetch
        if (data && data.config_value) {
          const aiData = data.config_value;
          // 直接使用扁平结构
          const chatConfig = aiData.chat
          const embeddingConfig = aiData.embedding
          const rerankConfig = aiData.rerank
          const vlConfig = aiData.vl

          setSavedConfigs(prev => ({
            ...prev,
            chat: deepMerge(initialConfigs.chat, chatConfig),
            embedding: deepMerge(initialConfigs.embedding, embeddingConfig),
            rerank: deepMerge(initialConfigs.rerank, rerankConfig),
            vl: deepMerge(initialConfigs.vl, vlConfig),
          }))
          // 同时更新当前编辑状态，以显示最新值
          setConfigs(prev => ({
            ...prev,
            chat: deepMerge(initialConfigs.chat, chatConfig),
            embedding: deepMerge(initialConfigs.embedding, embeddingConfig),
            rerank: deepMerge(initialConfigs.rerank, rerankConfig),
            vl: deepMerge(initialConfigs.vl, vlConfig),
          }))
        } else {
          // Fallback logic if data missing
          setSavedConfigs(prev => ({
            ...prev,
            chat: { ...configs.chat },
            embedding: { ...configs.embedding },
            rerank: { ...configs.rerank },
            vl: { ...configs.vl }
          }))
        }

        toast.success("AI 模型配置已保存")
      },
      onError: (error) => {
        logError("保存 AI 配置", error)
        toast.error("保存失败，请重试")
      }
    })
  }

  // 使用稳定的深度比较，避免因属性顺序或 undefined/null 差异导致假阳性
  const isAiDirty = (() => {
    const normalize = (obj: any): string => {
      if (obj === null || obj === undefined) return ''
      if (typeof obj !== 'object') return String(obj)
      if (Array.isArray(obj)) return obj.map(normalize).join(',')
      // 对对象的键进行排序，确保顺序一致
      return Object.keys(obj)
        .sort()
        .map(k => `${k}:${normalize(obj[k])}`)
        .join('|')
    }
    const currentStr = normalize({ chat: configs.chat, embedding: configs.embedding, rerank: configs.rerank, vl: configs.vl, botConfig: configs.botConfig })
    const savedStr = normalize({ chat: savedConfigs.chat, embedding: savedConfigs.embedding, rerank: savedConfigs.rerank, vl: savedConfigs.vl, botConfig: savedConfigs.botConfig })
    return currentStr !== savedStr
  })()

  const handleSaveBotConfig = async () => {
    const botConfigData: ApiBotConfigType = {
      ...configs.botConfig,
      webWidget: {
        ...configs.botConfig.webWidget,
        position: configs.botConfig.webWidget.position as WebWidgetConfig.position | undefined,
      }
    }

    updateBotConfigMutation.mutate(botConfigData, {
      onSuccess: () => {
        setSavedConfigs(configs)
      }
    })
  }

  const isModelConfigured = (modelType: "chat" | "embedding" | "rerank" | "vl") => {
    const config = configs[modelType]
    return !!(config.provider && config.model && config.apiKey && config.baseUrl)
  }

  const value: SettingsContextType = {
    configs,
    savedConfigs,
    isLoading,
    isAiDirty,
    handleUpdate,
    handleSave,
    handleSaveBotConfig,
    isModelConfigured,
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider")
  }
  return context
}

