"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronRight, LayoutGrid, Hash, MessageSquare, X, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { MenuItem } from "@/types"
import { useTheme } from "@/contexts"

interface SidebarProps {
  items: MenuItem[]
  selectedId?: string
  onSelect?: (item: MenuItem | { id: string, type: 'special' }) => void
  isOpen?: boolean
  onClose?: () => void
  siteName?: string
}

// 递归收集所有合集的 ID（移到组件外部避免重复创建）
function getAllCollectionIds(menuItems: MenuItem[]): string[] {
  const collectionIds: string[] = []
  for (const item of menuItems) {
    if (item.type === "collection") {
      collectionIds.push(item.id)
      if (item.children) {
        collectionIds.push(...getAllCollectionIds(item.children))
      }
    }
  }
  return collectionIds
}

export function Sidebar({ items, selectedId, onSelect, isOpen, onClose, siteName = "知识库" }: SidebarProps) {
  const { themeColor } = useTheme()
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set())

  // 使用 useMemo 缓存所有合集 ID
  const allCollectionIds = useMemo(() => getAllCollectionIds(items), [items])

  // 当 items 加载完成后，默认展开所有合集
  useEffect(() => {
    if (allCollectionIds.length > 0) {
      setExpandedCollections(new Set(allCollectionIds))
    }
  }, [allCollectionIds])

  const toggleCollection = useCallback((id: string) => {
    setExpandedCollections(prev => {
      const newExpanded = new Set(prev)
      if (newExpanded.has(id)) {
        newExpanded.delete(id)
      } else {
        newExpanded.add(id)
      }
      return newExpanded
    })
  }, [])

  const renderItem = (item: MenuItem, level = 0) => {
    const isExpanded = expandedCollections.has(item.id)
    // 只有文档类型才能被选中，合集不应该被选中高亮
    const isSelected = selectedId === item.id && item.type === "article"
    const isCollection = item.type === "collection"

    return (
      <div key={item.id} className="mb-1">
        <div
          className={cn(
            "group flex items-center gap-2 px-3 py-2 cursor-pointer rounded-xl transition-all duration-200",
            isSelected 
              ? "sidebar-item-active" 
              : "hover:bg-slate-200/50 text-slate-600 hover:text-slate-900",
          )}
          style={{ marginLeft: `${level * 12}px` }}
          onClick={() => {
            if (isCollection) {
              toggleCollection(item.id)
            } else {
              onSelect?.(item)
            }
          }}
        >
          {isCollection ? (
            <>
              <div className="p-1 rounded-md bg-slate-200/50 group-hover:bg-white transition-colors">
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 text-slate-500 transition-transform duration-200",
                    isExpanded && "rotate-90"
                  )}
                />
              </div>
              <span className="text-[13px] font-semibold tracking-tight uppercase text-slate-400">
                {item.title}
              </span>
            </>
          ) : (
            <>
              <Hash 
                className={cn("h-4 w-4", isSelected ? "" : "text-slate-400")}
                style={isSelected ? { color: "var(--theme-primary)" } : undefined}
              />
              <span className="text-[14px] flex-1 truncate">{item.title}</span>
            </>
          )}
        </div>
        {isCollection && isExpanded && item.children && (
          <div className="mt-1">
            {item.children.map((child) => renderItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn(
      "w-72 bg-slate-50 border-r border-slate-200 h-full flex flex-col transition-all duration-300",
      "fixed lg:static inset-y-0 left-0 z-50",
      "transform lg:transform-none",
      isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
    )}>
      <div className="p-6">
        <div className="flex items-center gap-3 px-2 mb-8">
          <div 
            className="w-8 h-8 rounded-xl flex items-center justify-center shadow-lg"
            style={{
              backgroundColor: "var(--theme-primary)",
              boxShadow: "0 10px 15px -3px var(--theme-primary-light), 0 4px 6px -2px var(--theme-primary-light)",
            }}
          >
            <LayoutGrid className="text-white h-5 w-5" />
          </div>
          <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-600">
            {siteName}
          </span>
          {/* 移动端关闭按钮 */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden ml-auto h-8 w-8"
            onClick={onClose}
            aria-label="关闭菜单"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* 顶部特殊入口 */}
        <div className="space-y-1">
          <button
            onClick={() => onSelect?.({ id: "ai-home", type: "special" })}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
              selectedId === "ai-home" 
                ? "text-white shadow-lg" 
                : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-900"
            )}
            style={selectedId === "ai-home" ? {
              backgroundColor: "var(--theme-primary)",
              boxShadow: "0 10px 15px -3px var(--theme-primary-light), 0 4px 6px -2px var(--theme-primary-light)",
            } : undefined}
          >
            <div 
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                selectedId === "ai-home" ? "bg-white/20" : "group-hover:bg-white"
              )}
              style={selectedId !== "ai-home" ? {
                backgroundColor: "var(--theme-primary-light)",
              } : undefined}
            >
              <MessageSquare 
                className="h-4 w-4"
                style={selectedId === "ai-home" ? { color: "white" } : { color: "var(--theme-primary)" }}
              />
            </div>
            <span className="text-sm font-semibold">AI 对话</span>
          </button>
        </div>
      </div>
      
      <ScrollArea className="flex-1 px-4">
        <div className="px-2 mb-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
          合集目录
        </div>
        <div className="pb-8">
          {items.map((item) => renderItem(item))}
        </div>
      </ScrollArea>

      <div className="p-4 mt-auto">
        <div className="bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl p-4 text-white shadow-xl shadow-gray-900/20 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:scale-110 transition-transform">
            <Sparkles className="h-12 w-12" />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">AI Powered</p>
          <p className="text-[13px] font-medium leading-snug relative z-10">
            尝试直接在搜索框提问，体验 AI 语义检索。
          </p>
        </div>
      </div>
    </div>
  )
}
