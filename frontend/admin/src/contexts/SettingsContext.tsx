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
import { type AIConfigs, type ModelType, type BotConfig, initialConfigs } from "@/types/settings"

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

  // 当配置数据加载完成时，合并到本地状态
  useEffect(() => {
    if (allConfigsData) {
      let loadedConfigs: AIConfigs = { ...initialConfigs }

      if (allConfigsData.aiConfig) {
        // [MODIFIED] 处理后端可能返回的旧数据结构 (auto/manual wrapper)
        // 如果返回的数据有 manualConfig 字段，说明是旧结构，我们提取 manualConfig
        const aiData = allConfigsData.aiConfig as any
        
        let chatConfig = aiData.chat
        let embeddingConfig = aiData.embedding
        let rerankConfig = aiData.rerank
        let vlConfig = aiData.vl

        // 兼容旧结构
        if (aiData.manualConfig) {
             chatConfig = aiData.manualConfig.chat
             embeddingConfig = aiData.manualConfig.embedding
             rerankConfig = aiData.manualConfig.rerank
             vlConfig = aiData.manualConfig.vl
        }

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
      if (type === "chat" || type === "embedding" || type === "rerank" || type === "vl") {
        // @ts-ignore
        const modelConfig = prev[type]
        const updatedConfig = { ...modelConfig, [field]: value }
        // @ts-ignore
        newConfigs[type] = updatedConfig
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
    // @ts-ignore
    const aiConfig: AIModelConfig = {
        chat: configs.chat,
        embedding: configs.embedding,
        rerank: configs.rerank,
        vl: configs.vl
    }

    updateAIConfigMutation.mutate(aiConfig, {
      onSuccess: () => {
        setSavedConfigs(prev => ({
          ...prev,
          chat: { ...configs.chat },
          embedding: { ...configs.embedding },
          rerank: { ...configs.rerank },
          vl: { ...configs.vl }
        }))
        toast.success("AI 模型配置已保存")
      },
      onError: (error) => {
        logError("保存 AI 配置", error)
        toast.error("保存失败，请重试")
      }
    })
  }

  const isAiDirty = JSON.stringify({
    chat: configs.chat,
    embedding: configs.embedding,
    rerank: configs.rerank,
    vl: configs.vl
  }) !== JSON.stringify({
    chat: savedConfigs.chat,
    embedding: savedConfigs.embedding,
    rerank: savedConfigs.rerank,
    vl: savedConfigs.vl
  })

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
    // @ts-ignore
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

