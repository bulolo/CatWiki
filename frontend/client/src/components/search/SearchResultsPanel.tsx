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
import { Search, Sparkles, FileText, ArrowRight } from "lucide-react"
import { type MenuItem } from "@/types"
import { cn } from "@/lib/utils"
import type { SearchMode } from "./types"

interface SearchResultsPanelProps {
  searchMode: SearchMode
  query: string
  results: MenuItem[]
  selectedIndex: number
  onAskAI: () => void
  onSelect: (item: MenuItem) => void
  onHover: (index: number) => void
}

export function SearchResultsPanel({
  searchMode, query, results, selectedIndex, onAskAI, onSelect, onHover,
}: SearchResultsPanelProps) {
  const t = useTranslations("SearchBar")
  return (
    <div className="p-1.5 md:p-2">
      {/* AI 对话选项 */}
      {(searchMode === "all" || searchMode === "chat") && (
        <div
          className={cn(
            "flex items-center gap-2 md:gap-3 px-3 md:px-4 py-3 md:py-4 cursor-pointer rounded-lg md:rounded-xl transition-all",
            selectedIndex === 0 ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.01]" : "hover:bg-slate-50"
          )}
          onClick={onAskAI}
          onMouseEnter={() => onHover(0)}
        >
          <div className={cn("p-1.5 md:p-2 rounded-lg shrink-0", selectedIndex === 0 ? "bg-white/20" : "bg-primary/10")}>
            <Sparkles className={cn("h-4 w-4 md:h-5 md:w-5", selectedIndex === 0 ? "text-white" : "text-primary")} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 md:gap-2">
              <span className="font-semibold text-xs md:text-sm">{t("aiSmartChat")}</span>
              <span className={cn("text-[9px] md:text-[10px] px-1 md:px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold",
                selectedIndex === 0 ? "bg-white/20 text-white" : "bg-primary/10 text-primary")}>
                Beta
              </span>
            </div>
            <p className={cn("text-[11px] md:text-xs mt-0.5 opacity-80 truncate", selectedIndex === 0 ? "text-white" : "text-slate-500")}>
              {t("askAI", { query })}
            </p>
          </div>
          <ArrowRight className={cn("h-4 w-4 opacity-50 shrink-0", selectedIndex === 0 ? "block" : "hidden")} />
        </div>
      )}

      {/* 分隔线 */}
      {searchMode === "all" && results.length > 0 && <div className="h-px bg-slate-100 my-1.5 md:my-2 mx-2" />}

      {/* 文章检索结果 */}
      {(searchMode === "all" || searchMode === "articles") && results.length > 0 && (
        <div className="py-1">
          <div className="px-3 md:px-4 py-1.5 md:py-2 text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest">
            {searchMode === "articles" ? t("searchResultDoc") : t("aiSearchResultDoc")}
          </div>
          {results.map((item, index) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 cursor-pointer rounded-lg md:rounded-xl transition-all mx-1",
                selectedIndex === index + 1 ? "bg-slate-100 text-slate-900" : "hover:bg-slate-50 text-slate-600"
              )}
              onClick={() => onSelect(item)}
              onMouseEnter={() => onHover(index + 1)}
            >
              <div className="p-1 md:p-1.5 bg-slate-200/50 rounded-lg shrink-0">
                <FileText className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </div>
              <span className="text-xs md:text-sm font-medium truncate">{item.title}</span>
            </div>
          ))}
        </div>
      )}

      {query && results.length === 0 && searchMode === "articles" && (
        <div className="p-6 md:p-8 text-center">
          <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-100 rounded-xl md:rounded-2xl flex items-center justify-center mx-auto mb-2 md:mb-3">
            <Search className="h-5 w-5 md:h-6 md:w-6 text-slate-300" />
          </div>
          <p className="text-xs md:text-sm text-slate-500">{t("noDocFound")}</p>
        </div>
      )}
    </div>
  )
}
