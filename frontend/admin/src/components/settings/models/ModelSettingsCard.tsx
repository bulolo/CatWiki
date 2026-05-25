// Copyright 2026 CatWiki Authors
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

import { Card, CardContent } from "@/components/ui"
import { useTranslations } from "next-intl"
import { CircuitBoard } from "lucide-react"
import { ManualModeConfig } from "./ManualModeConfig"
import { ShieldCheck } from "lucide-react"
import { type SettingsTabId } from "@/types/settings"
import { useState, useEffect } from "react"

interface ModelSettingsCardProps {
  onSelectModel: (model: SettingsTabId) => void
  activeTab: SettingsTabId
}

export function ModelSettingsCard({ onSelectModel, activeTab }: ModelSettingsCardProps) {
  const t = useTranslations("Models")

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-5">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm ring-1 ring-primary/20">
            <CircuitBoard className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">{t("title")}</h2>
            <p className="text-sm text-slate-500 font-medium">{t("description")}</p>
          </div>
        </div>
      </div>


      <Card className="border-border/60 min-h-[500px] overflow-hidden">
        <CardContent className="pt-6">
          <ManualModeConfig onSelectModel={onSelectModel} activeTab={activeTab} />
        </CardContent>
      </Card>
    </div>
  )
}

