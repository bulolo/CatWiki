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

import { Search, CheckCircle2, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ToolCall } from "@/types"

interface ToolCallCardProps {
  toolCalls: ToolCall[]
  className?: string
}

// 工具名称映射为友好显示名
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  search_knowledge_base: "搜索知识库",
}

// 工具图标映射
const TOOL_ICONS: Record<string, React.ReactNode> = {
  search_knowledge_base: <Search className="h-4 w-4" />,
}

/**
 * Tool Call 展示卡片
 * 显示 AI 正在调用的工具及其状态
 */
export function ToolCallCard({ toolCalls, className }: ToolCallCardProps) {
  if (!toolCalls || toolCalls.length === 0) return null

  return (
    <div className={cn("space-y-2 mb-3", className)}>
      {toolCalls.map((tc) => {
        const displayName = TOOL_DISPLAY_NAMES[tc.function.name] || tc.function.name
        const icon = TOOL_ICONS[tc.function.name] || <Search className="h-4 w-4" />
        
        // 解析参数
        let parsedArgs: Record<string, any> = {}
        try {
          parsedArgs = JSON.parse(tc.function.arguments || "{}")
        } catch {
          // ignore
        }

        const isRunning = tc.status === "running" || tc.status === "pending"
        const isCompleted = tc.status === "completed"
        const isError = tc.status === "error"

        return (
          <div
            key={tc.id}
            className={cn(
              "flex items-start gap-3 px-4 py-3 rounded-xl border transition-all",
              isRunning && "bg-blue-50 border-blue-200 animate-pulse",
              isCompleted && "bg-green-50 border-green-200",
              isError && "bg-red-50 border-red-200",
              !tc.status && "bg-slate-50 border-slate-200"
            )}
          >
            {/* 图标 */}
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              isRunning && "bg-blue-100 text-blue-600",
              isCompleted && "bg-green-100 text-green-600",
              isError && "bg-red-100 text-red-600",
              !tc.status && "bg-slate-100 text-slate-600"
            )}>
              {icon}
            </div>

            {/* 内容 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-slate-800">
                  {displayName}
                </span>
                {/* 状态指示器 */}
                {isRunning && (
                  <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />
                )}
                {isCompleted && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                )}
                {isError && (
                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                )}
              </div>

              {/* 查询参数 */}
              {parsedArgs.query && (
                <p className="text-xs text-slate-500 truncate">
                  查询: <span className="text-slate-700">{parsedArgs.query}</span>
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
