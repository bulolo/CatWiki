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

import { useState, useEffect } from "react"
import { MessageSquare, Trash2, Plus, X, Search, Clock, Bot, History as HistoryIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useChatSessions } from "@/hooks/useChatSessions"

interface ChatHistorySidebarProps {
  siteId?: number | null
  tenantId?: number | null
  currentThreadId?: string
  onSelectSession: (threadId: string) => void
  onNewChat: () => void
  isOpen: boolean
  onClose: () => void
  refreshTrigger?: number
}



export function ChatHistorySidebar({
  siteId,
  currentThreadId,
  onSelectSession,
  onNewChat,
  isOpen,
  onClose,
  refreshTrigger = 0,
  tenantId
}: ChatHistorySidebarProps) {
  const { sessions, isLoading, deleteSession, refresh, searchSessions } = useChatSessions({ siteId, tenantId })

  // 监听外部刷新信号
  useEffect(() => {
    if (refreshTrigger > 0) {
      refresh()
    }
  }, [refreshTrigger, refresh])

  const [searchQuery, setSearchQuery] = useState("")

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      searchSessions(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, searchSessions])

  const handleSelect = (threadId: string) => {
    onSelectSession(threadId)
    // 不再自动关闭，让用户手动收起
  }

  const handleDelete = async (e: React.MouseEvent, threadId: string) => {
    e.stopPropagation()
    if (confirm("确定要删除这段对话吗？")) {
      await deleteSession(threadId)
      if (currentThreadId === threadId) {
        onNewChat()
      }
    }
  }

  return (
    <div
      className={cn(
        "fixed top-20 right-4 z-50 w-80 max-h-[calc(100vh-8rem)] bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl transform transition-all duration-300 ease-in-out",
        isOpen ? "translate-y-0 opacity-100 scale-100" : "translate-y-4 opacity-0 scale-95 pointer-events-none"
      )}
    >
      <div className="flex flex-col h-full max-h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-slate-900">
            <HistoryIcon className="h-5 w-5 text-primary" />
            <span>历史会话</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1"
            onClick={onClose}
          >
            <span className="text-xs">收起</span>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* New Chat Button */}
        <div className="p-4">
          <Button
            onClick={onNewChat}
            className="w-full flex items-center gap-2 shadow-sm rounded-xl py-6"
          >
            <Plus className="h-4 w-4" />
            开启新对话
          </Button>
        </div>

        {/* Search */}
        <div className="px-4 pb-2">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="搜索会话..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Sessions List */}
        <ScrollArea className="flex-1 min-h-0 px-2 overflow-y-auto">
          <div className="space-y-1 p-2">
            {isLoading && sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 opacity-50">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-xs">加载中...</span>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">{searchQuery ? "未找到相关会话" : "暂无历史会话"}</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.thread_id}
                  onClick={() => handleSelect(session.thread_id)}
                  className={cn(
                    "group flex flex-col p-3 rounded-xl cursor-pointer transition-all border border-transparent hover:bg-slate-50 relative",
                    currentThreadId === session.thread_id
                      ? "bg-slate-50 border-slate-100 ring-1 ring-primary/10 shadow-sm"
                      : "hover:border-slate-100"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-semibold truncate mb-1",
                        currentThreadId === session.thread_id ? "text-primary" : "text-slate-700"
                      )}>
                        {session.title || "新对话"}
                      </p>
                      <p className="text-xs text-slate-500 line-clamp-1 break-all">
                        {session.last_message || "暂无消息内容"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      <Clock className="h-3 w-3" />
                      {new Date(session.updated_at).toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                      })}
                    </div>

                    <button
                      onClick={(e) => handleDelete(e, session.thread_id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 hover:text-red-500 rounded-md transition-all"
                      aria-label="删除会话"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t border-slate-50 bg-slate-50/50">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Bot className="h-4 w-4" />
            <span>会话记录将自动保存</span>
          </div>
        </div>
      </div>
    </div>
  )
}
