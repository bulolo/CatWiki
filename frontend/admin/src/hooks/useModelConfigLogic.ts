import { useSettings } from "@/contexts/SettingsContext"
import { useTestConnection } from "@/hooks/useSystemConfig"
import { useDemoMode } from '@/hooks/useHealth'
import { toast } from "sonner"
import { ModelType, initialConfigs } from "@/types/settings"

export function useModelConfigLogic(type: ModelType, onSuccess?: () => void) {
  const { configs, handleUpdate, handleSave, scope, platformDefaults } = useSettings()
  const testConnection = useTestConnection(scope)
  const isDemoMode = useDemoMode()

  // @ts-ignore
  const config = configs[type] || initialConfigs[type]
  // @ts-ignore
  const hasPlatformResource = !!(platformDefaults && platformDefaults[type] && platformDefaults[type].apiKey)
  const mode = config.mode || "custom"

  const handleModeChange = (newMode: "custom" | "platform") => {
    handleUpdate(type, "mode", newMode)
  }

  const handleTest = () => {
    testConnection.mutate(
      { modelType: type, config },
      {
        onSuccess: (data: any) => {
          toast.success("连接测试成功")
          if (data && data.dimension) {
            handleUpdate(type, "dimension", data.dimension)
          }
        },
        onError: (err) => {
          toast.error(err.message || "连接测试失败")
        }
      }
    )
  }

  const handleSaveWithCheck = async () => {
    if (mode === "custom" && !config.apiKey) {
      toast.error("请先填写 API Key")
      return
    }

    if (mode === "platform") {
      await handleSave()
      onSuccess?.()
      return
    }

    try {
      await testConnection.mutateAsync({ modelType: type, config })
      await handleSave()
      onSuccess?.()
    } catch (e: any) {
      toast.error(e.message || "连接测试发生错误，无法保存")
    }
  }

  return {
    config,
    baseConfig: {
      model: config.model,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      dimension: config.dimension
    },
    mode,
    hasPlatformResource,
    isDemoMode,
    isTesting: testConnection.isPending,
    handleModeChange,
    handleTest,
    handleSave: handleSaveWithCheck,
    handleUpdate
  }
}
