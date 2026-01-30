/**
 * 设置页面的状态管理 Context
 * 统一管理配置状态、更新逻辑和保存操作
 */

"use client"

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react"
import { toast } from "sonner"
import { useAllConfigs, useUpdateAIConfig, useUpdateBotConfig } from "@/hooks"
import { type AIModelConfig, type BotConfig as ApiBotConfigType, AIConfigUpdate, AutoModeConfig as AutoModeConfigType, WebWidgetConfig } from "@/lib/api-client"
import { logError } from "@/lib/error-handler"
import { PROVIDER_BASE_URLS } from "@/constants/constants"
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
  handleModeChange: (mode: "auto" | "manual") => void
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
        loadedConfigs = {
          ...loadedConfigs,
          mode: allConfigsData.aiConfig.mode || initialConfigs.mode,
          autoConfig: deepMerge(initialConfigs.autoConfig, allConfigsData.aiConfig.autoConfig),
          manualConfig: {
            chat: deepMerge(initialConfigs.manualConfig.chat, allConfigsData.aiConfig.manualConfig?.chat),
            embedding: deepMerge(initialConfigs.manualConfig.embedding, allConfigsData.aiConfig.manualConfig?.embedding),
            rerank: deepMerge(initialConfigs.manualConfig.rerank, allConfigsData.aiConfig.manualConfig?.rerank),
            vl: deepMerge(initialConfigs.manualConfig.vl, allConfigsData.aiConfig.manualConfig?.vl),
          }
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

      // 处理自动模式配置
      if (type === "autoConfig") {
        if (field === "provider" || field === "apiKey") {
          newConfigs.autoConfig = { ...prev.autoConfig, [field]: value }
        } else {
          newConfigs.autoConfig = {
            ...prev.autoConfig,
            models: { ...prev.autoConfig.models, [field]: value }
          }
        }
      }
      // 处理手动模式配置
      else if (type === "chat" || type === "embedding" || type === "rerank" || type === "vl") {
        const updatedConfig = { ...prev.manualConfig[type], [field]: value }

        // 如果改变的是 provider，则自动更新对应的 baseUrl
        if (field === "provider" && typeof value === "string" && PROVIDER_BASE_URLS[value] !== undefined) {
          updatedConfig.baseUrl = PROVIDER_BASE_URLS[value]
        }

        newConfigs.manualConfig = {
          ...prev.manualConfig,
          [type]: updatedConfig
        }
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
      // 处理模式切换
      else if (type === "mode") {
        newConfigs.mode = value as "auto" | "manual"
      }

      return newConfigs
    })
  }

  const handleSave = async () => {
    // 构建完整的 AI 配置对象
    const aiConfig: AIModelConfig = {
      mode: configs.mode as AIConfigUpdate.mode,
      autoConfig: {
        ...configs.autoConfig,
        provider: configs.autoConfig.provider as AutoModeConfigType.provider,
      },
      manualConfig: configs.manualConfig,
    }

    updateAIConfigMutation.mutate(aiConfig, {
      onSuccess: () => {
        setSavedConfigs(prev => ({
          ...prev,
          mode: configs.mode,
          autoConfig: { ...configs.autoConfig },
          manualConfig: { ...configs.manualConfig }
        }))
        toast.success("AI 模型及其模式配置已保存")
      },
      onError: (error) => {
        logError("保存 AI 配置", error)
        toast.error("保存失败，请重试")
      }
    })
  }

  const handleModeChange = (mode: "auto" | "manual") => {
    // 仅更新本地状态，不触发 API 调用
    handleUpdate("mode", "", mode)
  }

  const isAiDirty = JSON.stringify({
    mode: configs.mode,
    autoConfig: configs.autoConfig,
    manualConfig: configs.manualConfig
  }) !== JSON.stringify({
    mode: savedConfigs.mode,
    autoConfig: savedConfigs.autoConfig,
    manualConfig: savedConfigs.manualConfig
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
    const config = configs.manualConfig[modelType]
    return !!(config.provider && config.model && config.apiKey && config.baseUrl)
  }

  const value: SettingsContextType = {
    configs,
    savedConfigs,
    isLoading,
    isAiDirty,
    handleUpdate,
    handleSave,
    handleModeChange,
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

