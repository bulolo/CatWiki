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
import { Save, ShieldCheck, PlugZap, Loader2 } from "lucide-react"
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

  const getModelLabel = () => {
    const labels = {
      chat: "对话",
      embedding: "向量",
      rerank: "重排",
      vl: "视觉"
    }
    return labels[type]
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

      <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
        <div className="bg-slate-50 px-4 py-2 rounded-xl flex items-center gap-3 border border-slate-100 italic">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <p className="text-[10px] text-slate-500">
            当前处于手动编辑状态。修改后请点击外层卡片顶部的“保存”按钮生效。
          </p>
        </div>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleTest}
          disabled={testConnection.isPending || !config.apiKey}
          className="text-slate-600"
        >
          {testConnection.isPending ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <PlugZap className="mr-2 h-3 w-3 text-amber-500" />
          )}
          测试连接
        </Button>
      </div>
    </div>
  )
}

