/**
 * 模型设置主卡片
 * 包含自动/手动模式切换
 */

"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Zap, Settings, CircuitBoard } from "lucide-react"
import { useSettings } from "@/contexts/SettingsContext"
import { AutoModeConfig } from "./AutoModeConfig"
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
            <p className="text-sm text-slate-500 font-medium">选择自动模式快速配置，或手动模式自定义每个模型。</p>
          </div>
        </div>
      </div>

      <Card className="border-border/60 shadow-md rounded-2xl min-h-[500px] overflow-hidden">
        <CardContent className="pt-6">
          <Tabs
            value={configs.mode}
            onValueChange={(value) => handleModeChange(value as "auto" | "manual")}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-6 h-12 bg-slate-100">
              <TabsTrigger
                value="auto"
                className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                <Zap className="h-4 w-4" />
                <span className="font-semibold">自动模式</span>
              </TabsTrigger>
              <TabsTrigger
                value="manual"
                className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                <Settings className="h-4 w-4" />
                <span className="font-semibold">手动模式</span>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="auto" className="mt-0">
              <AutoModeConfig />
            </TabsContent>
            <TabsContent value="manual" className="mt-0">
              <ManualModeConfig onSelectModel={onSelectModel} activeTab={activeTab} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

