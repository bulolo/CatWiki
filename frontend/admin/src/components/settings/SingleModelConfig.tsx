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
  onSuccess?: () => void
}

export function SingleModelConfig({ type, onSuccess }: SingleModelConfigProps) {
  const { configs, handleUpdate, handleSave } = useSettings()
  const testConnection = useTestConnection()

  // 确保配置存在，如果不存在则使用默认值
  // @ts-ignore
  const config = configs[type] || initialConfigs[type]

  const handleTest = () => {
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
    if (!config.apiKey) {
      toast.error("请先填写 API Key")
      return
    }

    try {
      // 1. 先进行连接测试
      await testConnection.mutateAsync({ modelType: type, config })
      
      // 2. 测试通过后保存 (如果测试失败会抛出异常进入 catch)
      await handleSave()
      
      // 3. 调用成功回调 (返回列表页)
      onSuccess?.()
    } catch (e: any) {
      toast.error(e.message || "连接测试发生错误，无法保存")
    }
  }

  return (
    <div className="space-y-6 pt-4">
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
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
              <path d="M12 9v4"/>
              <path d="M12 17h.01"/>
            </svg>
          </div>
          <div className="space-y-1">
             <p className="font-medium text-amber-800">更改需谨慎</p>
             <p>修改向量模型配置可能导致现有的向量知识库无法检索！</p>
             <p>一旦修改，建议在"文档管理"中对所有文档执行"重新向量化"操作，否则旧数据的向量将与新模型不兼容。</p>
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

