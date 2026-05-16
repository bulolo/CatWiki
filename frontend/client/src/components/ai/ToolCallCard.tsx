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

"use client"

import { Search, CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ToolCall } from "@/types"

import { useTranslations } from "next-intl"

interface ToolCallCardProps {
  toolCalls: ToolCall[]
  className?: string
  /** Called when a completed tool call pill is clicked */
  onToolCallClick?: (toolCall: ToolCall) => void
}

/**
 * Tool Call 展示组件 - 简洁胶囊式设计
 * 完成状态的工具调用可点击查看检索结果
 */
export function ToolCallCard({ toolCalls, className, onToolCallClick }: ToolCallCardProps) {
  const t = useTranslations("ToolCall")
  const tResult = useTranslations("ToolResult")
  if (!toolCalls || toolCalls.length === 0) return null

  return (
    <div className={cn("flex flex-wrap gap-2 mb-3", className)}>
      {toolCalls.map((tc) => {
        const func = tc.function
        const name = func?.name || tc.name || "unknown"
        const displayName = t(name as any) || name

        let query = ""
        try {
          const argsRaw = func?.arguments || tc.args || "{}"
          const args = typeof argsRaw === 'string' ? JSON.parse(argsRaw) : argsRaw
          query = args?.query || ""
        } catch { /* ignore */ }

        const isRunning = tc.status === "running" || tc.status === "pending"
        const isCompleted = tc.status === "completed"
        const isClickable = isCompleted && !!onToolCallClick

        let chunkCount = 0
        if (isCompleted && tc.result) {
          try {
            const parsed = JSON.parse(tc.result)
            if (Array.isArray(parsed)) chunkCount = parsed.length
          } catch { /* ignore */ }
        }

        return (
          <div
            key={tc.id}
            onClick={isClickable ? () => onToolCallClick(tc) : undefined}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300",
              isRunning && "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200/60 shadow-sm",
              isCompleted && "bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border border-emerald-200/60",
              !tc.status && "bg-slate-50 text-slate-600 border border-slate-200",
              isClickable && "cursor-pointer hover:shadow-md hover:border-emerald-300 active:scale-[0.97]"
            )}
          >
            {isRunning ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isCompleted ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <Search className="h-3 w-3" />
            )}
            <span>
              {displayName}
              {query && (
                <span className="opacity-70 ml-1">&quot;{query.length > 15 ? query.slice(0, 15) + "..." : query}&quot;</span>
              )}
              {chunkCount > 0 && (
                <span className="opacity-50 ml-1">· {chunkCount} {tResult("chunks")}</span>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}
