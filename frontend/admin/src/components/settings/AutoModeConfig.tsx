/**
 * 自动模式配置组件
 * 用于快速配置 AI 模型，选择云端提供商一键配置
 */

"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Zap, MessageSquare, Layers, RefreshCw, Eye, Save } from "lucide-react"
import { useSettings } from "@/contexts/SettingsContext"
import { BAILIAN_MODEL_OPTIONS } from "@/constants/constants"

export function AutoModeConfig() {
  const { configs, handleUpdate, handleSave } = useSettings()

  return (
    <div className="space-y-6">
      <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-blue-900 mb-2 flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          自动模式配置 (智能预设)
        </h3>
        <p className="text-sm text-blue-700 mb-4">
          选择您的云端提供商并填写 API Key，系统将自动配置 Chat、Embedding、Rerank 和 VL 模型。
        </p>

        <div className="bg-white rounded-xl p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">预设提供商</label>
              <Select
                value={configs.autoConfig.provider}
                onValueChange={(val) => handleUpdate("autoConfig", "provider", val)}
              >
                <SelectTrigger className="w-full bg-white">
                  <SelectValue placeholder="选择提供商" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bailian">阿里云百炼 (推荐)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">API Key</label>
              <Input
                type="password"
                value={configs.autoConfig.apiKey}
                onChange={(e) => handleUpdate("autoConfig", "apiKey", e.target.value)}
                placeholder="输入您的 API Key"
                className="bg-white"
              />
            </div>
          </div>

          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-6">
            <h4 className="text-sm font-bold text-blue-900 mb-4">自动模式模型选择：</h4>
            <div className="grid grid-cols-2 gap-4">
              {/* Chat Model */}
              <ModelSelector
                icon={MessageSquare}
                label="Chat"
                value={configs.autoConfig.models.chat}
                options={BAILIAN_MODEL_OPTIONS.chat}
                required
                isConfigured={!!configs.autoConfig.apiKey}
                onValueChange={(val) => handleUpdate("autoConfig", "chat", val)}
              />

              {/* Embedding Model */}
              <ModelSelector
                icon={Layers}
                label="Embedding"
                value={configs.autoConfig.models.embedding}
                options={BAILIAN_MODEL_OPTIONS.embedding}
                required
                isConfigured={!!configs.autoConfig.apiKey}
                onValueChange={(val) => handleUpdate("autoConfig", "embedding", val)}
              />

              {/* Rerank Model */}
              <ModelSelector
                icon={RefreshCw}
                label="Rerank"
                value={configs.autoConfig.models.rerank}
                options={BAILIAN_MODEL_OPTIONS.rerank}
                required
                isConfigured={!!configs.autoConfig.apiKey}
                onValueChange={(val) => handleUpdate("autoConfig", "rerank", val)}
              />

              {/* Vision Model */}
              <ModelSelector
                icon={Eye}
                label="Vision (VL)"
                value={configs.autoConfig.models.vl}
                options={BAILIAN_MODEL_OPTIONS.vl}
                required={false}
                isConfigured={!!configs.autoConfig.apiKey}
                onValueChange={(val) => handleUpdate("autoConfig", "vl", val)}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

interface ModelSelectorProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  options: readonly { label: string; value: string }[]
  required: boolean
  isConfigured: boolean
  onValueChange: (value: string) => void
}

function ModelSelector({ icon: Icon, label, value, options, required, isConfigured, onValueChange }: ModelSelectorProps) {
  const iconColors = {
    Chat: "text-blue-500",
    Embedding: "text-emerald-500",
    Rerank: "text-purple-500",
    "Vision (VL)": "text-orange-500"
  }

  const iconColor = iconColors[label as keyof typeof iconColors] || "text-slate-500"

  return (
    <div className="space-y-1.5 bg-white p-3 rounded-xl border border-blue-50 shadow-sm relative">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${isConfigured ? "bg-emerald-500" : "bg-slate-300"}`} />
          <Badge
            variant={required ? "default" : "outline"}
            className={`text-[8px] px-1.5 py-0 h-4 ${required
              ? "bg-red-100 text-red-700 border-red-200"
              : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
          >
            {required ? "必选" : "可选"}
          </Badge>
        </div>
      </div>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-8 border-none bg-slate-50 text-xs font-semibold">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

