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

import { useTranslations } from "next-intl"
import { AlertCircle, Brain, Clock, Eye, Loader2, RefreshCw, Trash2 } from "lucide-react"
import { Badge, useConfirm } from "@/components/ui"
import type { useVectorizeDocument, useRemoveVector } from "@/hooks"
import type { Document } from "@/lib/sdk/sdk.schemas"

interface VectorStatusCellProps {
  doc: Document
  // 共享的 mutation 实例（整列复用，保持 isPending 联动语义不变）
  vectorizeMutation: ReturnType<typeof useVectorizeDocument>
  removeVectorMutation: ReturnType<typeof useRemoveVector>
  onViewChunks: (docId: number) => void
}

/**
 * 文档向量化状态单元格。
 *
 * 由 documents/page.tsx 内 144 行的 `renderVectorStatus` 抽出；按 vector_status
 * 渲染「未学习 / 已过期 / 排队 / 学习中 / 已学习 / 失败」六态及其操作（重新学习 /
 * 查看分片 / 删除向量）。行为与原内联实现逐字一致。
 */
export function VectorStatusCell({
  doc,
  vectorizeMutation,
  removeVectorMutation,
  onViewChunks,
}: VectorStatusCellProps) {
  const t = useTranslations("Documents")
  const confirm = useConfirm()

  const docVectorStatus = doc.vector_status || "none" as const
  const vectorError = doc.vector_error

  switch (docVectorStatus) {
    case "none" as const:
      return (
        <button
          onClick={() => vectorizeMutation.mutate(doc.id)}
          disabled={vectorizeMutation.isPending}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-400 hover:text-primary hover:bg-primary/5 transition-all whitespace-nowrap flex-shrink-0"
        >
          <Brain className="h-3 w-3 flex-shrink-0" />
          <span>{t("learning.notLearned")}</span>
        </button>
      )
    case "outdated" as const:
      return (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => vectorizeMutation.mutate(doc.id)}
            disabled={vectorizeMutation.isPending}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-amber-500 bg-amber-50 hover:bg-amber-100 border border-amber-200/50 transition-all whitespace-nowrap flex-shrink-0"
            title={t("learning.clickToRelearn_outdated")}
          >
            <RefreshCw className="h-2.5 w-2.5 flex-shrink-0" />
            <span>{t("learning.outdated")}</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onViewChunks(doc.id)
            }}
            className="p-1 rounded-md text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
            title={t("list.viewChunks")}
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={async (e) => {
              e.stopPropagation()
              if (await confirm({ description: t("learning.confirmDeleteVector"), variant: "destructive" })) {
                removeVectorMutation.mutate(doc.id)
              }
            }}
            disabled={removeVectorMutation.isPending}
            className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title={t("list.deleteVector")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )
    case "pending" as const:
      return (
        <Badge
          variant="outline"
          className="inline-flex items-center text-[10px] font-bold px-1.5 py-0 h-4.5 border-none bg-amber-50 text-amber-600 shadow-none cursor-pointer hover:bg-amber-100 whitespace-nowrap flex-shrink-0"
          onClick={() => removeVectorMutation.mutate(doc.id)}
          title={t("learning.clickToCancel")}
        >
          <Clock className="h-2.5 w-2.5 mr-0.5 flex-shrink-0" />
          {t("learning.queuing")}
        </Badge>
      )
    case "processing" as const:
      return (
        <Badge
          variant="outline"
          className="inline-flex items-center text-[10px] font-bold px-1.5 py-0 h-4.5 border-none bg-blue-50 text-blue-600 shadow-none whitespace-nowrap flex-shrink-0"
        >
          <Loader2 className="h-2.5 w-2.5 mr-0.5 flex-shrink-0 animate-spin" />
          {t("learning.learning")}
        </Badge>
      )
    case "completed" as const:
      return (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => vectorizeMutation.mutate(doc.id)}
            disabled={vectorizeMutation.isPending}
            className="group/relearn inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-200 border border-emerald-100/50 hover:border-emerald-200 shadow-sm active:scale-95 transition-all whitespace-nowrap flex-shrink-0 cursor-pointer min-w-[60px]"
            title={t("learning.clickToRelearn")}
          >
            <span className="flex items-center gap-1 group-hover/relearn:hidden">
              <Brain className="h-2.5 w-2.5 mr-0.5 flex-shrink-0" />
              <span>{t("learning.learned")}</span>
            </span>
            <span className="hidden group-hover/relearn:flex items-center gap-1">
              <RefreshCw className="h-2.5 w-2.5 mr-0.5 flex-shrink-0" />
              <span>{t("learning.relearnShort")}</span>
            </span>
          </button>

          {/* 查看分片 */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onViewChunks(doc.id)
            }}
            className="p-1 rounded-md text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
            title={t("list.viewChunks")}
          >
            <Eye className="h-3.5 w-3.5" />
          </button>

          {/* 删除向量 */}
          <button
            onClick={async (e) => {
              e.stopPropagation()
              if (await confirm({ description: t("learning.confirmDeleteVector"), variant: "destructive" })) {
                removeVectorMutation.mutate(doc.id)
              }
            }}
            disabled={removeVectorMutation.isPending}
            className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title={t("list.deleteVector")}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )
    case "failed" as const:
      return (
        <button
          onClick={() => vectorizeMutation.mutate(doc.id)}
          disabled={vectorizeMutation.isPending}
          className="inline-flex items-center gap-1 whitespace-nowrap flex-shrink-0"
          title={vectorError || t("learning.clickToRelearn")}
        >
          <Badge
            variant="outline"
            className="inline-flex items-center text-[10px] font-bold px-1.5 py-0 h-4.5 border-none bg-red-50 text-red-500 shadow-none whitespace-nowrap"
          >
            <AlertCircle className="h-2.5 w-2.5 mr-0.5 flex-shrink-0" />
            {t("learning.failed")}
          </Badge>
          <RefreshCw className="h-3 w-3 text-slate-400 hover:text-primary flex-shrink-0" />
        </button>
      )
    default:
      return null
  }
}
