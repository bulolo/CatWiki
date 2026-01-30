/**
 * 模型配置卡片组件 - 用于手动模式下的模型选择
 */

"use client"

import { Badge } from "@/components/ui/badge"
import { LucideIcon } from "lucide-react"
import type { ModelConfig } from "@/types"

interface ModelConfigCardProps {
  id: string
  title: string
  subtitle: string
  icon: LucideIcon
  color: string
  iconColor: string
  description: string
  required: boolean
  config: ModelConfig
  isConfigured: boolean
  isActive: boolean
  onClick: () => void
}

export function ModelConfigCard({
  title,
  subtitle,
  icon: Icon,
  color,
  iconColor,
  description,
  required,
  config,
  isConfigured,
  isActive,
  onClick,
}: ModelConfigCardProps) {
  return (
    <button
      onClick={onClick}
      className={`p-5 rounded-2xl border-2 transition-all text-left hover:shadow-lg bg-white ${
        isActive 
          ? "border-primary ring-2 ring-primary/20" 
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl ${color} relative`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
            <div className={`absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${
              isConfigured ? "bg-emerald-500" : "bg-slate-300"
            }`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900">{title}</h3>
              <Badge 
                variant={required ? "default" : "outline"} 
                className={`text-[9px] px-1.5 py-0 h-4 ${
                  required 
                    ? "bg-red-100 text-red-700 border-red-200" 
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {required ? "必选" : "可选"}
              </Badge>
            </div>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">{subtitle}</p>
          </div>
        </div>
      </div>
      <p className="text-xs text-slate-600 mb-3">{description}</p>
      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isConfigured ? "bg-emerald-500" : "bg-slate-300"}`} />
          <span className="text-[10px] text-slate-400">
            {isConfigured ? "已配置" : "未配置"}
          </span>
        </div>
        <Badge variant="secondary" className="text-[10px] bg-slate-100">
          {config.provider || "未设置"}
        </Badge>
      </div>
    </button>
  )
}

