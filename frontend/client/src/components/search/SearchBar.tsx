"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Search, X, Bot, FileText, Sparkles, Command, ArrowRight } from "lucide-react"
import { type MenuItem } from "@/types"
import { cn } from "@/lib/utils"

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
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<MenuItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchMode, setSearchMode] = useState<"all" | "chat" | "articles">("all")
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
      const maxIndex = searchMode === "chat" ? 0 : searchMode === "articles" ? results.length - 1 : results.length;
      setSelectedIndex(prev => Math.min(prev + 1, maxIndex))
    } else if (e.key === "ArrowUp") {
      const minIndex = searchMode === "articles" ? 1 : 0;
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

  return (
    <div className="relative w-full max-w-2xl mx-auto" ref={containerRef}>
      <div className="group relative">
        <div className="absolute inset-0 bg-primary/5 rounded-2xl blur-xl group-hover:bg-primary/10 transition-all duration-500 opacity-0 group-hover:opacity-100" />
        <div className="relative flex items-center bg-slate-50 rounded-xl md:rounded-2xl px-3 md:px-4 py-1 md:py-1.5 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-primary/40 focus-within:bg-white transition-all shadow-none">
          <Search className="h-4 w-4 text-slate-400 mr-2 md:mr-3 shrink-0" />
          <input
            className="flex-1 bg-transparent border-none outline-none text-sm md:text-[15px] py-1.5 placeholder:text-slate-400"
            placeholder={searchMode === "chat" ? "向 AI 提问..." : searchMode === "articles" ? "检索文档..." : "搜索或提问..."}
            value={query || ""}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query && setIsOpen(true)}
            aria-label="搜索文档或向 AI 提问"
          />
          <div className="flex items-center gap-2">
            {query && (
              <button 
                onClick={() => setQuery("")} 
                className="p-1 hover:bg-slate-100 rounded-md shrink-0"
                aria-label="清除搜索"
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
          {/* 模式切换 Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100/50 border-b border-slate-100 sticky top-0 z-10">
            <button
              onClick={() => { setSearchMode("all"); setSelectedIndex(0); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 md:gap-2 py-1.5 md:py-2 text-[11px] md:text-[12px] font-medium rounded-lg md:rounded-xl transition-all",
                searchMode === "all" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:bg-white/50"
              )}
            >
              全部
            </button>
            <button
              onClick={() => { setSearchMode("chat"); setSelectedIndex(0); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 md:gap-2 py-1.5 md:py-2 text-[11px] md:text-[12px] font-medium rounded-lg md:rounded-xl transition-all",
                searchMode === "chat" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:bg-white/50"
              )}
            >
              <Sparkles className="h-3 w-3 md:h-3.5 md:w-3.5" />
              <span className="hidden sm:inline">AI 对话</span>
              <span className="sm:hidden">AI</span>
            </button>
            <button
              onClick={() => { setSearchMode("articles"); setSelectedIndex(1); }}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 md:gap-2 py-1.5 md:py-2 text-[11px] md:text-[12px] font-medium rounded-lg md:rounded-xl transition-all",
                searchMode === "articles" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:bg-white/50"
              )}
            >
              <FileText className="h-3 w-3 md:h-3.5 md:w-3.5" />
              文档
            </button>
          </div>

          <div className="p-1.5 md:p-2">
            {/* AI 对话选项 */}
            {(searchMode === "all" || searchMode === "chat") && (
              <div
                className={cn(
                  "flex items-center gap-2 md:gap-3 px-3 md:px-4 py-3 md:py-4 cursor-pointer rounded-lg md:rounded-xl transition-all",
                  selectedIndex === 0 ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.01]" : "hover:bg-slate-50"
                )}
                onClick={handleAskAI}
                onMouseEnter={() => setSelectedIndex(0)}
              >
                <div className={cn("p-1.5 md:p-2 rounded-lg shrink-0", selectedIndex === 0 ? "bg-white/20" : "bg-primary/10")}>
                  <Sparkles className={cn("h-4 w-4 md:h-5 md:w-5", selectedIndex === 0 ? "text-white" : "text-primary")} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <span className="font-semibold text-xs md:text-sm">AI 智能对话</span>
                    <span className={cn("text-[9px] md:text-[10px] px-1 md:px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold", 
                      selectedIndex === 0 ? "bg-white/20 text-white" : "bg-primary/10 text-primary")}>
                      Beta
                    </span>
                  </div>
                  <p className={cn("text-[11px] md:text-xs mt-0.5 opacity-80 truncate", selectedIndex === 0 ? "text-white" : "text-slate-500")}>
                    立即询问 AI："{query}"
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
                  {searchMode === "articles" ? "检索到的文章" : "AI 检索到的文章"}
                </div>
                {results.map((item, index) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 cursor-pointer rounded-lg md:rounded-xl transition-all mx-1",
                      selectedIndex === index + 1 ? "bg-slate-100 text-slate-900" : "hover:bg-slate-50 text-slate-600"
                    )}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index + 1)}
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
                <p className="text-xs md:text-sm text-slate-500">未找到相关文档</p>
              </div>
            )}
          </div>
          
          <div className="bg-slate-50/50 px-3 md:px-4 py-2 md:py-3 border-t border-slate-100 flex items-center justify-between">
            <div className="hidden md:flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded shadow-sm text-slate-500">↑↓</kbd>
                <span>选择</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded shadow-sm text-slate-500">Enter</kbd>
                <span>确认</span>
              </div>
            </div>
            <div className="text-[10px] md:text-[11px] text-primary/60 font-medium flex items-center gap-1 mx-auto md:mx-0">
              <Bot className="h-3 w-3" />
              <span className="hidden md:inline">{searchMode === "chat" ? "AI Chat Mode" : searchMode === "articles" ? "RAG Search Mode" : "AI Powered Search"}</span>
              <span className="md:hidden">AI 驱动</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
