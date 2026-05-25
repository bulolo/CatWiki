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
 * 手动模式配置组件
 * 展示可配置的模型卡片列表
 */

"use client"

import { Badge } from "@/components/ui"
import { useTranslations } from "next-intl"
import { Settings, Globe } from "lucide-react"
import { useSettings } from "@/contexts/SettingsContext"
import { type SettingsTabId } from "@/types/settings"
import { MODEL_TYPES_LIST } from "./constants"

interface ManualModeConfigProps {
  onSelectModel: (model: SettingsTabId) => void
  activeTab: SettingsTabId
}

export function ManualModeConfig({ onSelectModel, activeTab }: ManualModeConfigProps) {
  const t = useTranslations("Models")
  const { savedConfigs, platformFallback, platformDefaults } = useSettings()

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
          <Settings className="h-5 w-5 text-blue-500" />
          {t("selectModel")}
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          {t("selectModelDesc")}
        </p>
        <div className="grid grid-cols-2 gap-4">
          {MODEL_TYPES_LIST.map((item) => {
            const type = item.id as "chat" | "embedding" | "rerank"
            // @ts-ignore
            const conf = savedConfigs[type]
            const isPlatform = platformFallback[type] || conf?.mode === "platform"

            // 使用 savedConfigs 判断配置状态 (避免未保存的修改影响列表显示)
            // 如果开启了平台共享，即使租户自己没填 Key，也视为已配置
            const isConfigured = isPlatform || !!(conf.provider && conf.model && conf.api_key && conf.base_url)

            // 获取展示用的 Provider 名称
            const raw = isPlatform ? platformDefaults?.[type]?.provider : conf.provider
            const displayProvider = (raw === "openai" || raw === "openai-compatible") ? "OpenAI Compatible" : (raw || t(isPlatform ? "platformDefault" : "notSet"))

            return (
              <button
                key={item.id}
                onClick={() => onSelectModel(item.id)}
                className={`p-5 rounded-2xl border-2 transition-all text-left hover:shadow-lg bg-white ${activeTab === item.id
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-slate-200 hover:border-slate-300"
                  }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${item.color} relative`}>
                      <item.icon className={`h-5 w-5 ${item.iconColor}`} />
                      {/* 状态指示器 */}
                      <div className={`absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${isConfigured ? "bg-emerald-500" : "bg-slate-300"
                        }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900">{t(`${item.id}Title`)}</h3>
                        {isPlatform && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0.5 h-5 bg-indigo-100 text-indigo-700 border-indigo-200 flex items-center gap-1"
                          >
                            <Globe className="h-3 w-3" />
                            {t("platformShared")}
                          </Badge>
                        )}
                        <Badge
                          variant={item.required ? "default" : "outline"}
                          className={`text-[9px] px-1.5 py-0 h-4 ${item.recommended
                            ? "bg-amber-100 text-amber-700 border-amber-200"
                            : item.required
                              ? "bg-red-100 text-red-700 border-red-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                        >
                          {item.recommended ? t("recommended") : item.required ? t("requiredStatus") : t("optionalStatus")}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">{item.subtitle}</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-600 mb-3">{t(`${item.id}Desc`)}</p>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${isConfigured ? "bg-emerald-500" : "bg-slate-300"}`} />
                    <span className="text-[10px] text-slate-400">
                      {isConfigured ? t("configuredStatus") : t("notConfiguredStatus")}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] bg-slate-100">
                    {displayProvider}
                  </Badge>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

