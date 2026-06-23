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
import { Sparkles, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SearchMode } from "./types"

interface SearchModeTabsProps {
  searchMode: SearchMode
  onModeChange: (mode: SearchMode) => void
}

export function SearchModeTabs({ searchMode, onModeChange }: SearchModeTabsProps) {
  const t = useTranslations("SearchBar")
  return (
    <div className="flex items-center gap-1 p-1 bg-slate-100/50 border-b border-slate-100 sticky top-0 z-10">
      <button
        onClick={() => onModeChange("all")}
        className={cn(
          "flex-1 flex items-center justify-center gap-1 md:gap-2 py-1.5 md:py-2 text-[11px] md:text-[12px] font-medium rounded-lg md:rounded-xl transition-all",
          searchMode === "all" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:bg-white/50"
        )}
      >
        {t("tabAll")}
      </button>
      <button
        onClick={() => onModeChange("chat")}
        className={cn(
          "flex-1 flex items-center justify-center gap-1 md:gap-2 py-1.5 md:py-2 text-[11px] md:text-[12px] font-medium rounded-lg md:rounded-xl transition-all",
          searchMode === "chat" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:bg-white/50"
        )}
      >
        <Sparkles className="h-3 w-3 md:h-3.5 md:w-3.5" />
        <span className="hidden sm:inline">{t("tabAI")}</span>
        <span className="sm:hidden">AI</span>
      </button>
      <button
        onClick={() => onModeChange("articles")}
        className={cn(
          "flex-1 flex items-center justify-center gap-1 md:gap-2 py-1.5 md:py-2 text-[11px] md:text-[12px] font-medium rounded-lg md:rounded-xl transition-all",
          searchMode === "articles" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:bg-white/50"
        )}
      >
        <FileText className="h-3 w-3 md:h-3.5 md:w-3.5" />
        {t("tabDoc")}
      </button>
    </div>
  )
}
