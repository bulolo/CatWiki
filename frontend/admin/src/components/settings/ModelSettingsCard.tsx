/**
 * 模型设置主卡片
 * 包含自动/手动模式切换
 */

"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Zap, Settings, CircuitBoard } from "lucide-react"
import { useSettings } from "@/contexts/SettingsContext"
import { ManualModeConfig } from "./ManualModeConfig"
import { type ModelType } from "@/types/settings"

interface ModelSettingsCardProps {
  onSelectModel: (model: ModelType) => void
  activeTab: ModelType
}

export function ModelSettingsCard({ onSelectModel, activeTab }: ModelSettingsCardProps) {
  const { configs, handleModeChange } = useSettings()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-5">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm ring-1 ring-primary/20">
            <CircuitBoard className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">模型配置</h2>
            <p className="text-sm text-slate-500 font-medium">配置您的 AI 模型参数 (基于 OpenAI 兼容协议)。</p>
          </div>
        </div>
      </div>

      <Card className="border-border/60 shadow-md rounded-2xl min-h-[500px] overflow-hidden">
        <CardContent className="pt-6">
          <ManualModeConfig onSelectModel={onSelectModel} activeTab={activeTab} />
        </CardContent>
      </Card>
    </div>
  )
}

