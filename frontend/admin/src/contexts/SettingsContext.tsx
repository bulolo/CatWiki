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
 * 设置页面的状态管理 Context
 * 统一管理配置状态、更新逻辑和保存操作
 */

"use client"

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react"
import { toast } from "sonner"
import { useAIConfig, useUpdateAIConfig } from "@/hooks"
import { type AIModelConfig, AIConfigUpdate } from "@/lib/api-client"
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

// 统一配置合并逻辑
const mergeAIConfigs = (backendData: any, initial: AIConfigs): AIConfigs => {
  return {
    ...initial,
    chat: deepMerge(initial.chat, backendData?.chat),
    embedding: deepMerge(initial.embedding, backendData?.embedding),
    rerank: deepMerge(initial.rerank, backendData?.rerank),
    vl: deepMerge(initial.vl, backendData?.vl),
  }
}

interface SettingsContextType {
  // 配置状态
  configs: AIConfigs
  savedConfigs: AIConfigs
  isLoading: boolean
  isAiDirty: boolean
  scope: 'platform' | 'tenant'

  // 更新函数
  handleUpdate: (type: string, field: string, value: string | boolean | number) => void
  handleSave: () => Promise<void>
  revertToSavedConfig: (modelType: "chat" | "embedding" | "rerank" | "vl") => void

  // 工具函数
  isModelConfigured: (modelType: "chat" | "embedding" | "rerank" | "vl") => boolean
  platformFallback: Record<string, boolean>
  platformDefaults: AIConfigs | null
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children, scope = 'tenant' }: { children: ReactNode, scope?: 'platform' | 'tenant' }) {
  const [configs, setConfigs] = useState<AIConfigs>(initialConfigs)
  const [savedConfigs, setSavedConfigs] = useState<AIConfigs>(initialConfigs)
  const [platformFallback, setPlatformFallback] = useState<Record<string, boolean>>({})
  const [platformDefaults, setPlatformDefaults] = useState<AIConfigs | null>(null)
  const isSwitchingMode = useRef(false)

  // 使用 React Query hooks
  const { data: aiConfigData, isLoading } = useAIConfig(scope)
  const updateAIConfigMutation = useUpdateAIConfig(scope)

  // 当配置数据加载完成时，合并到本地状态
  useEffect(() => {
    if (aiConfigData) {
      let loadedConfigs: AIConfigs = { ...initialConfigs }

      // aiConfigData is SystemConfigResponse
      if (aiConfigData.config_value) {
        const aiData = aiConfigData.config_value as any
        loadedConfigs = mergeAIConfigs(aiData, initialConfigs)

        // 提取元数据
        if (aiData._meta?.is_platform_fallback) {
          setPlatformFallback(aiData._meta.is_platform_fallback)
        } else {
          setPlatformFallback({})
        }
      }

      // 提取平台默认配置
      // @ts-ignore
      if (aiConfigData.platform_defaults) {
        // @ts-ignore
        setPlatformDefaults(aiConfigData.platform_defaults as AIConfigs)
      } else {
        setPlatformDefaults(null)
      }

      setConfigs(loadedConfigs)
      setSavedConfigs(loadedConfigs)
    }
  }, [aiConfigData])

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

      return newConfigs
    })
  }

  const handleSave = async () => {
    // 构建完整的 AI 配置对象 (扁平结构)
    const aiConfig = {
      chat: configs.chat,
      embedding: configs.embedding,
      rerank: configs.rerank,
      vl: configs.vl
    }

    updateAIConfigMutation.mutate(aiConfig as any, {
      onSuccess: (data: any) => {
        if (data && data.config_value) {
          const aiData = data.config_value;
          const updated = mergeAIConfigs(aiData, initialConfigs)

          setSavedConfigs(updated)
          setConfigs(updated)

          if (aiData._meta?.is_platform_fallback) {
            setPlatformFallback(aiData._meta.is_platform_fallback)
          }

          // 更新平台默认配置 (虽然通常不变，但为了数据一致性)
          if (data.platform_defaults) {
            setPlatformDefaults(data.platform_defaults as AIConfigs)
          }
        } else {
          setSavedConfigs({ ...configs })
        }

        toast.success("AI 模型配置已保存")
      },
      onError: (error) => {
        logError("保存 AI 配置", error)
        toast.error("保存失败，请重试")
      }
    })
  }

  const revertToSavedConfig = (modelType: "chat" | "embedding" | "rerank" | "vl") => {
    setConfigs(prev => ({
      ...prev,
      [modelType]: deepMerge({}, savedConfigs[modelType])
    }))
  }

  const isAiDirty = (() => {
    const normalize = (obj: any): string => {
      if (obj === null || obj === undefined) return ''
      if (typeof obj !== 'object') return String(obj)
      if (Array.isArray(obj)) return obj.map(normalize).join(',')
      return Object.keys(obj)
        .filter(k => obj[k] !== undefined && obj[k] !== null) // Filter out null/undefined keys
        .sort()
        .map(k => `${k}:${normalize(obj[k])}`)
        .join('|')
    }
    const currentStr = normalize({ chat: configs.chat, embedding: configs.embedding, rerank: configs.rerank, vl: configs.vl })
    const savedStr = normalize({ chat: savedConfigs.chat, embedding: savedConfigs.embedding, rerank: savedConfigs.rerank, vl: savedConfigs.vl })
    return currentStr !== savedStr
  })()

  const isModelConfigured = (modelType: "chat" | "embedding" | "rerank" | "vl") => {
    const config = configs[modelType]

    // 如果使用了平台资源，则视为已配置
    if (config.mode === "platform") {
      return true
    }

    // 自定义模式下必须填写所有必填项
    return !!(config.provider && config.model && config.apiKey && config.baseUrl)
  }

  const value: SettingsContextType = {
    configs,
    savedConfigs,
    isLoading,
    isAiDirty,
    scope,
    handleUpdate,
    handleSave,
    revertToSavedConfig,
    isModelConfigured,
    platformFallback,
    platformDefaults
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

