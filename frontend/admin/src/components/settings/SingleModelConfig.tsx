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
import { Save, ShieldCheck } from "lucide-react"
import { useSettings } from "@/contexts/SettingsContext"
import { initialConfigs } from "@/types/settings"

interface SingleModelConfigProps {
  type: "chat" | "embedding" | "rerank" | "vl"
}

export function SingleModelConfig({ type }: SingleModelConfigProps) {
  const { configs, handleUpdate, handleSave } = useSettings()

  // 确保配置存在，如果不存在则使用默认值
  const config = configs.manualConfig[type] || initialConfigs.manualConfig[type]

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
          <label className="text-sm font-semibold text-slate-700">模型提供商</label>
          <Select
            value={config.provider}
            onValueChange={(val) => handleUpdate(type, "provider", val)}
          >
            <SelectTrigger className="w-full bg-white">
              <SelectValue placeholder="选择提供商" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="deepseek">DeepSeek (深度求索)</SelectItem>
              <SelectItem value="siliconflow">SiliconFlow (硅基流动)</SelectItem>
              <SelectItem value="moonshot">月之暗面 (Moonshot)</SelectItem>
              <SelectItem value="bailian">阿里云百炼 (Qwen)</SelectItem>
              <SelectItem value="volcengine">火山引擎 (豆包)</SelectItem>
              <SelectItem value="openai">OpenAI / 兼容代理</SelectItem>
              <SelectItem value="local">Local (Ollama / vLLM)</SelectItem>
            </SelectContent>
          </Select>
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
      </div>
    </div>
  )
}

