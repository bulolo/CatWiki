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

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PlugZap, Save, Loader2, ShieldCheck } from "lucide-react"
import { useSettings } from "@/contexts/SettingsContext"
import { initialConfigs } from "@/types/settings"
import { useTestConnection } from "@/hooks/useSystemConfig"
import { useDemoMode } from '@/hooks/useHealth'
import { toast } from "sonner"
import { useEffect, useState } from "react"
import api from "@/lib/api-client"

interface SingleModelConfigProps {
  type: "chat" | "embedding" | "rerank" | "vl"
  onSuccess?: () => void
}

export function SingleModelConfig({ type, onSuccess }: SingleModelConfigProps) {
  const { configs, handleUpdate, handleSave, scope, platformDefaults } = useSettings()
  const testConnection = useTestConnection(scope)
  const isDemoMode = useDemoMode()

  // 确保配置存在，如果不存在则使用默认值
  // @ts-ignore
  const config = configs[type] || initialConfigs[type]

  // 检查是否有平台资源可用
  // @ts-ignore
  const hasPlatformResource = !!(platformDefaults && platformDefaults[type] && platformDefaults[type].apiKey)

  // 当前模式
  const mode = config.mode || "custom"

  const handleModeChange = (newMode: "custom" | "platform") => {
    handleUpdate(type, "mode", newMode)
  }

  const handleTest = () => {
    // 如果是平台模式，暂时不支持测试连接（因为 Key 是 masked 的，后端 test 接口可能需要调整支持 tenant_id? 
    // 或者后端 test 接口如果收到 mode=platform 应自动用平台配置测试。
    // 目前后端 update_config 接口还没改 test 逻辑，但 chat 逻辑已改。
    // 简单起见，平台模式下允许“测试”，后端 test 接口若能处理最好，不能处理则可能 fail。
    // 修正：后端 test 接口目前只接收 config json。
    // 如果我们传 mode=platform，后端 test 接口需要懂得去取平台 key。
    // 这是一个潜在坑。暂时先允许，如果报错再说。

    testConnection.mutate(
      { modelType: type, config },
      {
        onSuccess: (data: any) => {
          toast.success("连接测试成功")
          // 如果返回了 dimension，则更新到配置中
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
    // 自定义模式下必须有 Key
    if (mode === "custom" && !config.apiKey) {
      toast.error("请先填写 API Key")
      return
    }

    // 平台模式下，Key 可能为空或 masked，直接保存
    if (mode === "platform") {
      await handleSave()
      onSuccess?.()
      return
    }

    try {
      // 1. 先进行连接测试
      await testConnection.mutateAsync({ modelType: type, config })

      // 2. 测试通过后保存
      await handleSave()

      // 3. 调用成功回调
      onSuccess?.()
    } catch (e: any) {
      toast.error(e.message || "连接测试发生错误，无法保存")
    }
  }

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
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 text-center space-y-3 animate-in fade-in duration-300">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
            <PlugZap className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-blue-900">已托管至平台</h3>
            <p className="text-xs text-blue-700 mt-1 max-w-xs mx-auto">
              当前正在使用平台提供的共享 AI 资源。无需配置 Key 即可直接使用。
            </p>
          </div>

          {/* @ts-ignore */}
          {platformDefaults?.[type]?.model && (
            <div className="inline-block bg-white/60 px-3 py-1 rounded text-xs text-blue-800 border border-blue-100">
              {/* @ts-ignore */}
              当前模型: <span className="font-mono font-semibold">{platformDefaults[type].model}</span>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 自定义配置表单内容 */}
          {isDemoMode && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">演示模式已开启：为了保护基础设施安全，部分配置项（如 API 地址和模型名称）已进行脱敏处理。</p>
            </div>
          )}
          {type === "embedding" && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4 flex gap-3 text-amber-900 text-sm">
              <div className="shrink-0 mt-0.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 text-amber-600"
                >
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                </svg>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-amber-800">更改需谨慎</p>
                <p>修改向量模型配置可能导致现有的向量知识库无法检索！</p>
                <p>一旦修改，建议在&quot;文档管理&quot;中对所有文档执行&quot;重新向量化&quot;操作，否则旧数据的向量将与新模型不兼容。</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">协议类型</label>
              <div className="flex items-center h-10 px-3 rounded-md border border-slate-200 bg-slate-50 text-slate-500 text-sm">
                OpenAI API 兼容协议
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">模型名称</label>
              <Input
                value={config.model}
                onChange={(e) => handleUpdate(type, "model", e.target.value)}
                placeholder="例如: gpt-4, claude-3-opus..."
                className="bg-white"
                readOnly={isDemoMode && config.model === "********"}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">API Key</label>
            <Input
              type="password"
              value={config.apiKey}
              onChange={(e) => handleUpdate(type, "apiKey", e.target.value)}
              placeholder="sk-..."
              className="bg-white font-mono"
              readOnly={isDemoMode && config.apiKey === "********"}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">API Base URL</label>
            <Input
              value={config.baseUrl}
              onChange={(e) => handleUpdate(type, "baseUrl", e.target.value)}
              placeholder="https://api.openai.com/v1"
              className="bg-white font-mono"
              readOnly={isDemoMode && config.baseUrl === "********"}
            />
          </div>

          {type === "embedding" && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">向量维度 (自动获取)</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={config.dimension || ""}
                  disabled={true}
                  placeholder="等待自动探测..."
                  className="bg-slate-50 font-mono text-slate-500"
                />
              </div>
              <p className="text-xs text-slate-500">
                该值将在保存配置时自动从模型提供商探测。
              </p>
            </div>
          )}
        </>
      )}

      <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
        <Button
          variant="outline"
          onClick={handleTest}
          // Platform mode doesn't support test connection for now, maybe disable it?
          // Or let it fail. I'll disable it for platform mode for now to avoid confusion.
          disabled={testConnection.isPending || (mode === "custom" && !config.apiKey) || (mode === "platform") || isDemoMode}
          className="text-slate-600"
          title={mode === "platform" ? "平台模式下无需测试连接" : (isDemoMode ? "演示模式下禁用连接测试" : "")}
        >
          {testConnection.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <PlugZap className="mr-2 h-4 w-4 text-amber-500" />
          )}
          仅测试连接
        </Button>

        <Button
          onClick={handleSaveWithCheck}
          disabled={testConnection.isPending || (mode === "custom" && !config.apiKey) || isDemoMode}
          className="bg-slate-900 hover:bg-slate-800 text-white min-w-[100px]"
          title={isDemoMode ? "演示模式下禁止保存配置" : ""}
        >
          {testConnection.isPending ? (
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

