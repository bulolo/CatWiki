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

import { useState, useEffect, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { Streamdown } from "streamdown"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui"
import { Search, CheckCircle2, Loader2, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { getChatToolResult } from "@/lib/sdk/client-chat-sessions"
import { getVisitorId } from "@/lib/visitor"
import type { ToolCall } from "@/types"

interface ToolResultDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  toolCall: ToolCall | null
  threadId: string
  siteId?: number | null
  /** Callback to cache fetched result back into the ToolCall */
  onResultFetched?: (toolCallId: string, result: string) => void
}

interface Chunk {
  source_index?: number
  title?: string
  content?: string
  metadata?: { score?: number; author?: string; chunk_index?: number; document_id?: number }
}

export function ToolResultDialog({ open, onOpenChange, toolCall, threadId, siteId, onResultFetched }: ToolResultDialogProps) {
  const t = useTranslations("ToolResult")
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set())

  // 已有 result 直接复用，否则向后端拉取（带重试，因 stream 收尾后后端入库可能略有延迟）
  const needsFetch = open && !!toolCall && !toolCall.result && !!threadId
  const { data: fetchedResult, isFetching, isError } = useQuery({
    queryKey: ["tool-result", threadId, toolCall?.id],
    queryFn: async () => {
      const data = await getChatToolResult(threadId, toolCall!.id, {
        member_id: getVisitorId(),
        site_id: siteId ?? undefined,
      })
      const content = typeof data?.content === "string" ? data.content : null
      if (!content) throw new Error("tool result not ready") // 触发重试
      return content
    },
    enabled: needsFetch,
    retry: 2,
    retryDelay: 1500,
    staleTime: Infinity,
  })

  const result = toolCall?.result ?? fetchedResult ?? null
  const loading = needsFetch && isFetching && !fetchedResult
  const fetchError = needsFetch && isError && !fetchedResult

  // 拉取成功后回写到 message 缓存
  useEffect(() => {
    if (fetchedResult && toolCall) onResultFetched?.(toolCall.id, fetchedResult)
  }, [fetchedResult, toolCall, onResultFetched])

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) setExpandedChunks(new Set())
    onOpenChange(isOpen)
  }

  const chunks = useMemo<Chunk[]>(() => {
    if (!result) return []
    try {
      const parsed = JSON.parse(result)
      return Array.isArray(parsed) ? parsed : []
    } catch { return [] }
  }, [result])

  const query = useMemo(() => {
    try { return JSON.parse(toolCall?.function?.arguments || "{}").query || "" } catch { return "" }
  }, [toolCall?.function?.arguments])

  const toggleChunk = (i: number) => {
    setExpandedChunks(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-50 rounded-lg">
              <Search className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold">{t("title")}</DialogTitle>
              {query && <DialogDescription className="mt-0.5">「{query}」</DialogDescription>}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">{t("loading")}</span>
            </div>
          ) : chunks.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span className="text-[11px] font-semibold text-emerald-600">{chunks.length} {t("chunks")}</span>
              </div>
              {chunks.map((chunk, i) => {
                const meta = chunk.metadata || {}
                const score = meta.score != null ? (meta.score * 100).toFixed(1) : null
                const isExpanded = expandedChunks.has(i)
                const contentText = chunk.content || ""
                return (
                  <div key={i} className="border border-slate-200/60 rounded-xl overflow-hidden bg-white shadow-sm">
                    <button
                      onClick={() => toggleChunk(i)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50/80 hover:bg-slate-100/80 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-mono font-bold text-white bg-slate-400 rounded px-1.5 py-0.5 shrink-0">#{chunk.source_index ?? i + 1}</span>
                        <span className="text-xs font-semibold text-slate-800 truncate">{chunk.title || "Untitled"}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {meta.author && <span className="text-[10px] text-slate-400 hidden sm:inline">{meta.author}</span>}
                        {score && (
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded",
                            Number(score) >= 50 ? "bg-emerald-50 text-emerald-600" :
                            Number(score) >= 30 ? "bg-amber-50 text-amber-600" :
                            "bg-slate-100 text-slate-500"
                          )}>{score}%</span>
                        )}
                        <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", isExpanded && "rotate-180")} />
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="px-4 py-3 border-t border-slate-100">
                        <div className="text-xs text-slate-600 leading-relaxed prose prose-slate prose-xs max-w-none prose-p:my-1 prose-headings:my-1.5 prose-ul:my-1 prose-li:my-0">
                          <Streamdown>{contentText}</Streamdown>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : result ? (
            <div className="text-xs text-slate-600 whitespace-pre-wrap break-words font-mono leading-relaxed">{result}</div>
          ) : fetchError ? (
            <div className="text-center py-16 text-sm text-red-500 italic">{t("fetchError")}</div>
          ) : (
            <div className="text-center py-16 text-sm text-muted-foreground italic">{t("empty")}</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
