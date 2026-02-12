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
 * 手动模式配置组件
 * 展示可配置的模型卡片列表
 */

"use client"

import { Badge } from "@/components/ui/badge"
import { Settings, Globe } from "lucide-react"
import { useSettings } from "@/contexts/SettingsContext"
import { type ModelType } from "@/types/settings"
import { MODEL_TYPES_LIST } from "@/constants/models"

interface ManualModeConfigProps {
  onSelectModel: (model: ModelType) => void
  activeTab: ModelType
}

export function ManualModeConfig({ onSelectModel, activeTab }: ManualModeConfigProps) {
  const { savedConfigs, platformFallback } = useSettings()

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
          <Settings className="h-5 w-5 text-blue-500" />
          选择要配置的模型
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          点击下方卡片进入对应模型的详细配置页面
        </p>
        <div className="grid grid-cols-2 gap-4">
          {MODEL_TYPES_LIST.map((item) => {
            // @ts-ignore
            const conf = savedConfigs[item.id as "chat" | "embedding" | "rerank" | "vl"]

            // 使用 savedConfigs 判断配置状态 (避免未保存的修改影响列表显示)
            const isConfigured = conf.mode === 'platform' || !!(conf.provider && conf.model && conf.apiKey && conf.baseUrl)

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
                        <h3 className="font-bold text-slate-900">{item.title}</h3>
                        {(platformFallback[item.id] || conf?.mode === 'platform') && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0.5 h-5 bg-indigo-100 text-indigo-700 border-indigo-200 flex items-center gap-1"
                          >
                            <Globe className="h-3 w-3" />
                            平台共享
                          </Badge>
                        )}
                        <Badge
                          variant={item.required ? "default" : "outline"}
                          className={`text-[9px] px-1.5 py-0 h-4 ${item.required
                            ? "bg-red-100 text-red-700 border-red-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                        >
                          {item.required ? "必选" : "可选"}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider">{item.subtitle}</p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-600 mb-3">{item.description}</p>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${isConfigured ? "bg-emerald-500" : "bg-slate-300"}`} />
                    <span className="text-[10px] text-slate-400">
                      {isConfigured ? "已配置" : "未配置"}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] bg-slate-100">
                    {conf.provider || "未设置"}
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

