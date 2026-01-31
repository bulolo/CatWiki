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
import { Save, PlugZap, Loader2 } from "lucide-react"
import { useSettings } from "@/contexts/SettingsContext"
import { initialConfigs } from "@/types/settings"
import { useTestConnection } from "@/hooks/useSystemConfig"
import { toast } from "sonner"

interface SingleModelConfigProps {
  type: "chat" | "embedding" | "rerank" | "vl"
}

export function SingleModelConfig({ type }: SingleModelConfigProps) {
  const { configs, handleUpdate, handleSave } = useSettings()
  const testConnection = useTestConnection()

  // 确保配置存在，如果不存在则使用默认值
  // @ts-ignore
  const config = configs[type] || initialConfigs[type]

  const handleTest = () => {
    testConnection.mutate(
      { modelType: type, config }, 
      {
        onSuccess: () => {
          toast.success("连接测试成功")
        },
        onError: (err) => {
          toast.error(err.message || "连接测试失败")
        }
      }
    )
  }

  const handleSaveWithCheck = async () => {
    if (!config.apiKey) {
      toast.error("请先填写 API Key")
      return
    }

    try {
      // 1. 先进行连接测试
      await testConnection.mutateAsync({ modelType: type, config })
      
      // 2. 测试通过后保存 (如果测试失败会抛出异常进入 catch)
      await handleSave()
    } catch (e: any) {
      toast.error(e.message || "连接测试发生错误，无法保存")
    }
  }

  return (
    <div className="space-y-6 pt-4">
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
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">API Base URL</label>
        <Input
          value={config.baseUrl}
          onChange={(e) => handleUpdate(type, "baseUrl", e.target.value)}
          placeholder="https://api.openai.com/v1"
          className="bg-white font-mono"
        />
      </div>

      <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
        <Button 
          variant="outline" 
          onClick={handleTest}
          disabled={testConnection.isPending || !config.apiKey}
          className="text-slate-600"
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
          disabled={testConnection.isPending || !config.apiKey}
          className="bg-slate-900 hover:bg-slate-800 text-white min-w-[100px]"
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

