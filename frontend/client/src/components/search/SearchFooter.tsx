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
import { Bot } from "lucide-react"
import type { SearchMode } from "./types"

interface SearchFooterProps {
  searchMode: SearchMode
}

export function SearchFooter({ searchMode }: SearchFooterProps) {
  const t = useTranslations("SearchBar")
  return (
    <div className="bg-slate-50/50 px-3 md:px-4 py-2 md:py-3 border-t border-slate-100 flex items-center justify-between">
      <div className="hidden md:flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded shadow-sm text-slate-500">↑↓</kbd>
          <span>{t("select")}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded shadow-sm text-slate-500">Enter</kbd>
          <span>{t("confirm")}</span>
        </div>
      </div>
      <div className="text-[10px] md:text-[11px] text-primary/60 font-medium flex items-center gap-1 mx-auto md:mx-0">
        <Bot className="h-3 w-3" />
        <span className="hidden md:inline">{searchMode === "chat" ? t("modeChat") : searchMode === "articles" ? t("modeRag") : t("modeAiSearch")}</span>
        <span className="md:hidden">{t("aiPowered")}</span>
      </div>
    </div>
  )
}
