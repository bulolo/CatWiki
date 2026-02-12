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
 * 模型设置主卡片
 * 包含自动/手动模式切换
 */

"use client"

import { Card, CardContent } from "@/components/ui/card"
import { CircuitBoard } from "lucide-react"
import { ManualModeConfig } from "./ManualModeConfig"
import { ShieldCheck } from "lucide-react"
import { type ModelType } from "@/types/settings"
import api from "@/lib/api-client"
import { useState, useEffect } from "react"
import { useDemoMode } from '@/hooks/useHealth'

interface ModelSettingsCardProps {
  onSelectModel: (model: ModelType) => void
  activeTab: ModelType
}

export function ModelSettingsCard({ onSelectModel, activeTab }: ModelSettingsCardProps) {
  const isDemoMode = useDemoMode()

  return (
    <div className="space-y-6">
      {isDemoMode && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">演示模式已开启：为了保护基础设施安全，部分配置项（如 API 地址和模型名称）已进行脱敏处理。</p>
        </div>
      )}
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

