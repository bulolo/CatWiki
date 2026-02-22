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

import { useSettings } from "@/contexts/SettingsContext"
import { useTestConnection } from "@/hooks/useSystemConfig"
import { toast } from "sonner"
import { ModelType, initialConfigs } from "@/types/settings"

export function useModelConfigLogic(type: ModelType, onSuccess?: () => void) {
  const { configs, handleUpdate, handleSave, scope, platformDefaults } = useSettings()
  const testConnection = useTestConnection(scope)

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
    isTesting: testConnection.isPending,
    handleModeChange,
    handleTest,
    handleSave: handleSaveWithCheck,
    handleUpdate
  }
}
