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
import { MODEL_TYPES, initialConfigs } from "@/types/settings"

type RuntimeModelType = typeof MODEL_TYPES[number]

export function useModelConfigLogic(type: RuntimeModelType, onSuccess?: () => void) {
  const { configs, handleUpdate, handleSave, scope, platformDefaults, platformFallback } = useSettings()
  const testConnection = useTestConnection(scope)

  const config = configs[type] || initialConfigs[type]
  const hasPlatformResource = !!(platformDefaults && platformDefaults[type] && platformDefaults[type].api_key)
  // [✨ 亮点] 如果租户还没有在该模型上显式保存配置 (config.mode 为 undefined)
  // 且当前正处于后端标记的 Fallback 状态，则默认 UI Tab 选在 "platform" 上。
  // 这保证了用户点击进入模型时，看到的是他们当前实际正在使用的资源。
  const mode = config.mode || (platformFallback[type] ? "platform" : "custom")

  const handleModeChange = (newMode: "custom" | "platform") => {
    handleUpdate(type, "mode", newMode)
  }

  const handleTest = () => {
    testConnection.mutate(
      { modelType: type, config },
      {
        onSuccess: (data: unknown) => {
          toast.success("Connection test successful")
          if (
            data &&
            typeof data === 'object' &&
            'dimension' in data &&
            typeof (data as { dimension?: unknown }).dimension === 'number'
          ) {
            handleUpdate(type, "dimension", (data as { dimension: number }).dimension)
          }
        },
        onError: (err) => {
          toast.error(err.message || "Connection test failed")
        }
      }
    )
  }

  // api_key 看起来还是脱敏占位符 (含 ****)，说明用户没改密钥——
  // 直接保存即可，后端 _merge_securely 会保留原值，无需再跑一次 test connection
  // (否则会把脱敏值发去真连，触发 "Missing credentials" 假性失败)
  const isApiKeyMasked = (key: unknown): boolean =>
    typeof key === "string" && key.includes("****")

  const handleSaveWithCheck = async () => {
    if (mode === "platform") {
      try {
        await handleSave(type, { mode })
        onSuccess?.()
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Save failed")
      }
      return
    }

    // 用户未改动 api_key (仍是脱敏占位)，跳过测试，直接走保存
    if (isApiKeyMasked(config.api_key)) {
      try {
        await handleSave(type, { mode })
        onSuccess?.()
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Save failed")
      }
      return
    }

    try {
      const data = await testConnection.mutateAsync({ modelType: type, config })
      // 与 handleTest 一致：如果测试返回了 dimension（如 embedding 模型），更新 UI 状态
      // 同时通过 overrides 直接传入 handleSave，避免 setState 异步时序问题
      const overrides: Record<string, string | number | boolean | Record<string, unknown>> = {}
      if (
        data &&
        typeof data === 'object' &&
        'dimension' in data &&
        typeof (data as { dimension?: unknown }).dimension === 'number'
      ) {
        const dim = (data as { dimension: number }).dimension
        handleUpdate(type, "dimension", dim)
        overrides.dimension = dim
      }
      await handleSave(type, { ...overrides, mode })
      onSuccess?.()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Connection test error, cannot save")
    }
  }

  return {
    config,
    baseConfig: {
      model: config.model,
      api_key: config.api_key,
      base_url: config.base_url,
      dimension: config.dimension,
      extra_body: config.extra_body
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
