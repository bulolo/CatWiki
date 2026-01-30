/**
 * 模型配置字段组件 - 手动模式下的详细配置表单
 */

"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Save, ShieldCheck } from "lucide-react"
import type { ModelConfig } from "@/types"

interface ModelConfigFieldsProps {
  type: "chat" | "embedding" | "rerank" | "vl"
  config: ModelConfig
  onUpdate: (field: string, value: string) => void
  onSave: () => void
}

const MODEL_TYPE_LABELS = {
  chat: "对话",
  embedding: "向量",
  rerank: "重排",
  vl: "视觉"
}

export function ModelConfigFields({ type, config, onUpdate, onSave }: ModelConfigFieldsProps) {
  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">模型提供商</label>
          <Select 
            value={config.provider} 
            onValueChange={(val) => onUpdate("provider", val)}
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
            onChange={(e) => onUpdate("model", e.target.value)}
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
          onChange={(e) => onUpdate("apiKey", e.target.value)}
          placeholder="sk-..."
          className="bg-white font-mono"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">API Base URL</label>
        <Input 
          value={config.baseUrl} 
          onChange={(e) => onUpdate("baseUrl", e.target.value)}
          placeholder="https://api.openai.com/v1"
          className="bg-white font-mono"
        />
      </div>

      <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
        <div className="bg-slate-50 px-4 py-2 rounded-xl flex items-center gap-3">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <p className="text-[10px] text-slate-500">
            API Key 已加密存储。请确保该供应商余额充足。
          </p>
        </div>
        <Button 
          onClick={onSave} 
          className="flex items-center gap-2 h-10 px-6 rounded-xl shadow-md"
        >
          <Save className="h-4 w-4" />
          保存{MODEL_TYPE_LABELS[type]}配置
        </Button>
      </div>
    </div>
  )
}

