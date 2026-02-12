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
 * 单个模型配置组件
 * 用于手动模式下配置单个模型的详细参数
 */

"use client"

import { Button } from "@/components/ui/button"
import { PlugZap, Save, Loader2 } from "lucide-react"
import { useModelConfigLogic } from "@/hooks/useModelConfigLogic"
import { PlatformModeView } from "./PlatformModeView"
import { CustomConfigForm } from "./CustomConfigForm"

interface SingleModelConfigProps {
  type: "chat" | "embedding" | "rerank" | "vl"
  onSuccess?: () => void
}

export function SingleModelConfig({ type, onSuccess }: SingleModelConfigProps) {
  const {
    config,
    mode,
    hasPlatformResource,
    isDemoMode,
    isTesting,
    handleModeChange,
    handleTest,
    handleSave,
    handleUpdate
  } = useModelConfigLogic(type, onSuccess)

  return (
    <div className="space-y-6 pt-4">
      {hasPlatformResource && (
        <div className="bg-slate-50 p-1 rounded-lg inline-flex border border-slate-200 mb-2">
          <button
            onClick={() => handleModeChange("custom")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${mode === "custom"
              ? "bg-white text-blue-600 shadow-sm border border-slate-200/50"
              : "text-slate-500 hover:text-slate-700"
              }`}
          >
            自定义配置
          </button>
          <button
            onClick={() => handleModeChange("platform")}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${mode === "platform"
              ? "bg-white text-blue-600 shadow-sm border border-slate-200/50"
              : "text-slate-500 hover:text-slate-700"
              }`}
          >
            使用平台资源
          </button>
        </div>
      )}

      {mode === "platform" ? (
        <PlatformModeView type={type} />
      ) : (
        <CustomConfigForm
          type={type}
          config={config}
          isDemoMode={isDemoMode}
          onUpdate={handleUpdate}
        />
      )}

      <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
        <Button
          variant="outline"
          onClick={handleTest}
          disabled={isTesting || (mode === "custom" && !config.apiKey) || (mode === "platform") || isDemoMode}
          className="text-slate-600"
          title={mode === "platform" ? "平台模式下无需测试连接" : (isDemoMode ? "演示模式下禁用连接测试" : "")}
        >
          {isTesting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <PlugZap className="mr-2 h-4 w-4 text-amber-500" />
          )}
          仅测试连接
        </Button>

        <Button
          onClick={handleSave}
          disabled={isTesting || (mode === "custom" && !config.apiKey) || isDemoMode}
          className="bg-slate-900 hover:bg-slate-800 text-white min-w-[100px]"
          title={isDemoMode ? "演示模式下禁止保存配置" : ""}
        >
          {isTesting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          保存配置
        </Button>
      </div>
    </div>
  )
}
