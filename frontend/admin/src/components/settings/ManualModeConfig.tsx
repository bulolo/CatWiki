/**
 * 手动模式配置组件
 * 展示可配置的模型卡片列表
 */

"use client"

import { Badge } from "@/components/ui/badge"
import { Settings, MessageSquare, Layers, RefreshCw, Eye } from "lucide-react"
import { useSettings } from "@/contexts/SettingsContext"
import { type ModelType } from "@/types/settings"

interface ManualModeConfigProps {
  onSelectModel: (model: ModelType) => void
  activeTab: ModelType
}

export function ManualModeConfig({ onSelectModel, activeTab }: ManualModeConfigProps) {
  const { configs, isModelConfigured } = useSettings()

  const modelCards = [
    {
      id: "chat" as ModelType,
      title: "对话模型",
      subtitle: "Chat Model",
      icon: MessageSquare,
      color: "bg-blue-50",
      iconColor: "text-blue-500",
      desc: "用于 AI 对话和内容生成",
      required: true
    },
    {
      id: "embedding" as ModelType,
      title: "向量模型",
      subtitle: "Embedding Model",
      icon: Layers,
      color: "bg-emerald-50",
      iconColor: "text-emerald-500",
      desc: "用于文档向量化和语义检索",
      required: true
    },
    {
      id: "rerank" as ModelType,
      title: "重排序模型",
      subtitle: "Rerank Model",
      icon: RefreshCw,
      color: "bg-purple-50",
      iconColor: "text-purple-500",
      desc: "优化检索结果排序",
      required: true
    },
    {
      id: "vl" as ModelType,
      title: "视觉模型",
      subtitle: "Vision Model",
      icon: Eye,
      color: "bg-orange-50",
      iconColor: "text-orange-500",
      desc: "支持图片理解和多模态",
      required: false
    }
  ]

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
          <Settings className="h-5 w-5 text-blue-500" />
          手动模式 - 选择要配置的模型
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          点击下方卡片进入对应模型的详细配置页面
        </p>
        <div className="grid grid-cols-2 gap-4">
          {modelCards.map((item) => {
            const conf = configs.manualConfig[item.id as "chat" | "embedding" | "rerank" | "vl"]
            const isConfigured = isModelConfigured(item.id as "chat" | "embedding" | "rerank" | "vl")
            
            return (
              <button
                key={item.id}
                onClick={() => onSelectModel(item.id)}
                className={`p-5 rounded-2xl border-2 transition-all text-left hover:shadow-lg bg-white ${
                  activeTab === item.id 
                    ? "border-primary ring-2 ring-primary/20" 
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${item.color} relative`}>
                      <item.icon className={`h-5 w-5 ${item.iconColor}`} />
                      {/* 状态指示器 */}
                      <div className={`absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${
                        isConfigured ? "bg-emerald-500" : "bg-slate-300"
                      }`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900">{item.title}</h3>
                        <Badge 
                          variant={item.required ? "default" : "outline"} 
                          className={`text-[9px] px-1.5 py-0 h-4 ${
                            item.required 
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
                <p className="text-xs text-slate-600 mb-3">{item.desc}</p>
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

