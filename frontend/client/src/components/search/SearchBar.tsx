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

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Search, X, Command } from "lucide-react"
import { type MenuItem } from "@/types"
import { useTranslations } from "next-intl"
import type { SearchMode } from "./types"
import { SearchModeTabs } from "./SearchModeTabs"
import { SearchResultsPanel } from "./SearchResultsPanel"
import { SearchFooter } from "./SearchFooter"

interface SearchBarProps {
  items: MenuItem[]
  onSelect?: (item: MenuItem) => void
  onAskAI?: (query: string) => void
}

// 递归扁平化菜单项（移到组件外部）
function flattenMenuItems(items: MenuItem[]): MenuItem[] {
  const flattened: MenuItem[] = []
  for (const item of items) {
    if (item.type === "article") {
      flattened.push(item)
    }
    if (item.children) {
      flattened.push(...flattenMenuItems(item.children))
    }
  }
  return flattened
}

export function SearchBar({ items, onSelect, onAskAI }: SearchBarProps) {
  const t = useTranslations("SearchBar")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<MenuItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchMode, setSearchMode] = useState<SearchMode>("all")
  const containerRef = useRef<HTMLDivElement>(null)

  // 使用 useMemo 缓存扁平化后的文章列表
  const flatArticles = useMemo(() => flattenMenuItems(items), [items])

  // 搜索文章（按标题匹配）
  const searchArticles = useCallback((val: string) => {
    const searchTerm = val.toLowerCase()
    return flatArticles.filter(item =>
      item.title.toLowerCase().includes(searchTerm)
    )
  }, [flatArticles])

  useEffect(() => {
    if (query.trim()) {
      const filtered = searchArticles(query)
      setResults(filtered)
      setIsOpen(true)
      setSelectedIndex(0)
    } else {
      setResults([])
      setIsOpen(false)
    }
  }, [query, searchArticles])

  // 处理快捷键
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        containerRef.current?.querySelector("input")?.focus()
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      const maxIndex = searchMode === "chat" ? 0 : searchMode === "articles" ? results.length - 1 : results.length
      setSelectedIndex(prev => Math.min(prev + 1, maxIndex))
    } else if (e.key === "ArrowUp") {
      const minIndex = searchMode === "articles" ? 1 : 0
      setSelectedIndex(prev => Math.max(prev - 1, minIndex))
    } else if (e.key === "Enter") {
      if (selectedIndex === 0 && searchMode !== "articles") {
        handleAskAI()
      } else if (results[selectedIndex - 1]) {
        handleSelect(results[selectedIndex - 1])
      }
    } else if (e.key === "Escape") {
      setIsOpen(false)
    }
  }

  const handleSelect = (item: MenuItem) => {
    onSelect?.(item)
    setQuery("")
    setIsOpen(false)
  }

  const handleAskAI = () => {
    if (query.trim()) {
      onAskAI?.(query)
      setQuery("")
      setIsOpen(false)
    }
  }

  // 切换模式时重置高亮项：文章模式无 AI 选项，从第 1 项起，其余从第 0 项（AI 选项）起
  const handleModeChange = (mode: SearchMode) => {
    setSearchMode(mode)
    setSelectedIndex(mode === "articles" ? 1 : 0)
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto" ref={containerRef}>
      <div className="group relative">
        <div className="absolute inset-0 bg-primary/5 rounded-2xl blur-xl group-hover:bg-primary/10 transition-all duration-500 opacity-0 group-hover:opacity-100" />
        <div className="relative flex items-center bg-slate-50 rounded-xl md:rounded-2xl px-3 md:px-4 py-1 md:py-1.5 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-primary/40 focus-within:bg-white transition-all shadow-none">
          <Search className="h-4 w-4 text-slate-400 mr-2 md:mr-3 shrink-0" />
          <input
            className="flex-1 bg-transparent border-none outline-none text-sm md:text-[15px] py-1.5 placeholder:text-slate-400"
            placeholder={searchMode === "chat" ? t("placeholderAI") : searchMode === "articles" ? t("placeholderDoc") : t("placeholderAll")}
            value={query || ""}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query && setIsOpen(true)}
            aria-label={t("ariaSearch")}
          />
          <div className="flex items-center gap-2">
            {query && (
              <button
                onClick={() => setQuery("")}
                className="p-1 hover:bg-slate-100 rounded-md shrink-0"
                aria-label={t("ariaClear")}
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            )}
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-slate-100 rounded border border-slate-200 text-[10px] font-medium text-slate-500 shrink-0">
              <Command className="h-3 w-3" />
              <span>K</span>
            </div>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 md:mt-3 left-0 right-0 glass-card rounded-xl md:rounded-2xl shadow-2xl z-50 overflow-hidden border border-slate-200 animate-in fade-in slide-in-from-top-2 duration-200 max-h-[80vh] md:max-h-auto overflow-y-auto">
          <SearchModeTabs searchMode={searchMode} onModeChange={handleModeChange} />
          <SearchResultsPanel
            searchMode={searchMode}
            query={query}
            results={results}
            selectedIndex={selectedIndex}
            onAskAI={handleAskAI}
            onSelect={handleSelect}
            onHover={setSelectedIndex}
          />
          <SearchFooter searchMode={searchMode} />
        </div>
      )}
    </div>
  )
}
