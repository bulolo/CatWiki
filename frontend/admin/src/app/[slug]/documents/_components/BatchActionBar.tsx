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
import { Archive, Brain, FolderInput, Send, Trash2, X } from "lucide-react"

interface BatchActionBarProps {
  selectedCount: number
  onMove: () => void
  onPublish: () => void
  onUnpublish: () => void
  onVectorize: () => void
  onDelete: () => void
  onExit: () => void
  /** move / publish / unpublish 共用 batchUpdate mutation 的 pending */
  updatePending: boolean
  vectorizePending: boolean
  deletePending: boolean
}

/** 批量操作浮动工具栏。由 documents/page.tsx 内联实现抽出，行为一致。 */
export function BatchActionBar({
  selectedCount,
  onMove,
  onPublish,
  onUnpublish,
  onVectorize,
  onDelete,
  onExit,
  updatePending,
  vectorizePending,
  deletePending,
}: BatchActionBarProps) {
  const t = useTranslations("Documents")

  return (
    <div className="fixed bottom-6 md:bottom-10 left-2 right-2 md:left-0 md:right-0 flex justify-center z-50 pointer-events-none">
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto w-full md:w-auto">
        <div className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 md:py-2.5 bg-white text-slate-900 rounded-xl md:rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.12),0_0_1px_rgba(0,0,0,0.2)] border border-slate-200/60 backdrop-blur-xl">
          {/* 选中计数 */}
          <div className="flex items-center gap-1.5 md:gap-2.5 px-2 md:px-3 border-r border-slate-100 mr-0.5 md:mr-1">
            <div className="flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary text-white text-[10px] md:text-[11px] font-bold shadow-sm shadow-primary/20">
              {selectedCount}
            </div>
            <span className="text-xs md:text-sm font-semibold text-slate-600 tracking-tight hidden sm:inline">
              {t("batchBar.selected", { count: selectedCount }).replace(selectedCount.toString(), "").trim()}
            </span>
          </div>

          {/* 操作按钮组 */}
          <div className="flex items-center gap-0.5 md:gap-1 flex-1 md:flex-none overflow-x-auto">
            {selectedCount > 0 ? (
              <>
                <button
                  onClick={onMove}
                  disabled={updatePending}
                  className="flex items-center gap-1 md:gap-2 px-2 md:px-3.5 py-1.5 md:py-2 hover:bg-slate-50 active:bg-slate-100 rounded-lg md:rounded-xl text-xs md:text-sm font-medium text-slate-700 transition-all disabled:opacity-50 group whitespace-nowrap"
                  title={t("actions.move")}
                >
                  <FolderInput className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-400 group-hover:text-primary transition-colors" />
                  <span className="hidden md:inline">{t("actions.move")}</span>
                </button>
                <button
                  onClick={onPublish}
                  disabled={updatePending}
                  className="flex items-center gap-1 md:gap-2 px-2 md:px-3.5 py-1.5 md:py-2 hover:bg-emerald-50 active:bg-emerald-100 rounded-lg md:rounded-xl text-xs md:text-sm font-medium text-emerald-600 transition-all disabled:opacity-50 whitespace-nowrap"
                  title={t("batchBar.publish")}
                >
                  <Send className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span className="hidden md:inline">{t("batchBar.publish")}</span>
                </button>
                <button
                  onClick={onUnpublish}
                  disabled={updatePending}
                  className="flex items-center gap-1 md:gap-2 px-2 md:px-3.5 py-1.5 md:py-2 hover:bg-amber-50 active:bg-amber-100 rounded-lg md:rounded-xl text-xs md:text-sm font-medium text-amber-600 transition-all disabled:opacity-50 whitespace-nowrap"
                  title={t("batchBar.unpublish")}
                >
                  <Archive className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span className="hidden md:inline">{t("batchBar.unpublish")}</span>
                </button>
                <button
                  onClick={onVectorize}
                  disabled={vectorizePending}
                  className="flex items-center gap-1 md:gap-2 px-2 md:px-3.5 py-1.5 md:py-2 hover:bg-blue-50 active:bg-blue-100 rounded-lg md:rounded-xl text-xs md:text-sm font-medium text-blue-600 transition-all disabled:opacity-50 whitespace-nowrap"
                  title={t("batchBar.vectorize")}
                >
                  <Brain className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span className="hidden md:inline">{t("batchBar.vectorize")}</span>
                </button>
                <button
                  onClick={onDelete}
                  disabled={deletePending}
                  className="flex items-center gap-1 md:gap-2 px-2 md:px-3.5 py-1.5 md:py-2 hover:bg-red-50 active:bg-red-100 rounded-lg md:rounded-xl text-xs md:text-sm font-medium text-red-500 transition-all disabled:opacity-50 whitespace-nowrap"
                  title={t("batchBar.delete")}
                >
                  <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                  <span className="hidden md:inline">{t("batchBar.delete")}</span>
                </button>
              </>
            ) : (
              <span className="text-[10px] md:text-xs text-slate-400 px-2 md:px-6 py-1.5 md:py-2">{t("batchBar.selectItems")}</span>
            )}
          </div>

          <div className="w-px h-4 md:h-5 bg-slate-100 mx-0.5 md:mx-1" />

          {/* 退出按钮 */}
          <button
            onClick={onExit}
            className="flex items-center justify-center w-7 h-7 md:w-9 md:h-9 hover:bg-slate-50 active:bg-slate-100 rounded-lg md:rounded-xl text-slate-400 hover:text-slate-600 transition-all shrink-0"
            title={t("actions.cancel")}
          >
            <X className="h-3.5 w-3.5 md:h-4 md:w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
