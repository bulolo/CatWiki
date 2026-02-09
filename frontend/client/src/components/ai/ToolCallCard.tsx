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

"use client"

import { Search, CheckCircle2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ToolCall } from "@/types"

interface ToolCallCardProps {
  toolCalls: ToolCall[]
  className?: string
}

// 工具名称映射
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  search_knowledge_base: "搜索知识库",
}

/**
 * Tool Call 展示组件 - 简洁胶囊式设计
 */
export function ToolCallCard({ toolCalls, className }: ToolCallCardProps) {
  if (!toolCalls || toolCalls.length === 0) return null

  return (
    <div className={cn("flex flex-wrap gap-2 mb-3", className)}>
      {toolCalls.map((tc) => {
        const displayName = TOOL_DISPLAY_NAMES[tc.function.name] || tc.function.name
        
        // 解析查询参数
        let query = ""
        try {
          const args = JSON.parse(tc.function.arguments || "{}")
          query = args.query || ""
        } catch {
          // ignore
        }

        const isRunning = tc.status === "running" || tc.status === "pending"
        const isCompleted = tc.status === "completed"

        return (
          <div
            key={tc.id}
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300",
              isRunning && "bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200/60 shadow-sm",
              isCompleted && "bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border border-emerald-200/60",
              !tc.status && "bg-slate-50 text-slate-600 border border-slate-200"
            )}
          >
            {/* 状态图标 */}
            {isRunning ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isCompleted ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <Search className="h-3 w-3" />
            )}
            
            {/* 工具名称 + 查询 */}
            <span>
              {displayName}
              {query && (
                <span className="opacity-70 ml-1">"{query.length > 15 ? query.slice(0, 15) + "..." : query}"</span>
              )}
            </span>
          </div>
        )
      })}
    </div>
  )
}
