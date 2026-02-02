"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Pagination } from "@/components/ui/pagination"
import {
  MessageSquare,
  ChevronLeft,
  User,
  Bot,
  Clock,
  Trash2,
  Loader2,
  MessagesSquare,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { ChatSessionResponse } from "@/lib/sdk/models/ChatSessionResponse"
import type { app__api__admin__endpoints__chat_sessions__ChatMessage as ChatMessage } from "@/lib/sdk/models/app__api__admin__endpoints__chat_sessions__ChatMessage"
import { Streamdown } from "streamdown"
import { MessageSources } from "./MessageSources"

interface SiteChatHistoryProps {
  siteId: number
  siteName: string
}

export function SiteChatHistory({ siteId, siteName }: SiteChatHistoryProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [selectedSession, setSelectedSession] = useState<ChatSessionResponse | null>(null)

  // 获取会话列表
  const { data: sessionsData, isLoading: sessionsLoading, refetch } = useQuery({
    queryKey: ["chat-sessions", siteId, currentPage, pageSize],
    queryFn: () => api.chatSessions.adminListChatSessions({
      siteId,
      page: currentPage,
      size: pageSize,
    }),
  })

  // 获取选中会话的消息
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ["chat-messages", selectedSession?.thread_id],
    queryFn: () => api.chatSessions.adminGetChatMessages({
      threadId: selectedSession!.thread_id,
    }),
    enabled: !!selectedSession,
  })

  const handleDeleteSession = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("确定要删除这个会话吗？")) return

    try {
      await api.chatSessions.adminDeleteChatSession({ threadId })
      toast.success("会话已删除")
      refetch()
      if (selectedSession?.thread_id === threadId) {
        setSelectedSession(null)
      }
    } catch (error) {
      toast.error("删除失败")
    }
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const sessions = sessionsData?.items || []
  const totalSessions = sessionsData?.total || 0
  const messages = messagesData?.messages || []

  return (
    <div className="h-full flex flex-col">
      <Card className="border-slate-200/60 shadow-none rounded-xl overflow-hidden flex-1 flex flex-col">
        <CardHeader className="border-b border-slate-50 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 border border-indigo-100">
              <MessagesSquare className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base font-bold">历史会话</CardTitle>
              <CardDescription className="text-xs">
                查看 {siteName} 的所有 AI 会话记录
              </CardDescription>
            </div>
            {selectedSession && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSession(null)}
                className="gap-1.5"
              >
                <ChevronLeft className="h-4 w-4" />
                返回列表
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 p-0 min-h-0">
          {selectedSession ? (
            // 消息详情视图
            <div className="h-full flex flex-col">
              <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100 shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm text-slate-900 truncate max-w-md">
                      {selectedSession.title || "未命名对话"}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedSession.message_count} 条消息 • {formatDate(selectedSession.created_at)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {selectedSession.thread_id.slice(0, 8)}...
                  </Badge>
                </div>
              </div>

              <ScrollArea className="flex-1 p-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                    <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">暂无消息记录</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg: ChatMessage, index: number) => (
                      <div
                        key={index}
                        className={cn(
                          "flex gap-3",
                          msg.role === "user" ? "flex-row-reverse" : ""
                        )}
                      >
                        <div
                          className={cn(
                            "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                            msg.role === "user"
                              ? "bg-primary/10 text-primary"
                              : "bg-slate-100 text-slate-600"
                          )}
                        >
                          {msg.role === "user" ? (
                            <User className="h-4 w-4" />
                          ) : (
                            <Bot className="h-4 w-4" />
                          )}
                        </div>
                        <div
                          className={cn(
                            "max-w-[80%] space-y-1",
                            msg.role === "user" ? "items-end" : "items-start"
                          )}
                        >
                          <div
                            className={cn(
                              "rounded-xl px-4 py-2.5 text-sm",
                              msg.role === "user"
                                ? "bg-primary text-white"
                                : "bg-slate-100 text-slate-800"
                            )}
                          >
                            <div className={cn(
                              "text-sm leading-relaxed",
                              msg.role === "assistant" ? "prose prose-slate prose-sm max-w-none prose-p:leading-relaxed" : ""
                            )}>
                              <Streamdown>{msg.content}</Streamdown>
                              {msg.role === "assistant" && (msg as any).sources && (
                                <MessageSources sources={(msg as any).sources} />
                              )}
                            </div>
                          </div>
                          {((msg as any).created_at || (msg as any).createdAt) && (
                            <p className={cn(
                              "text-[10px] text-slate-400 px-1",
                              msg.role === "user" ? "text-right" : "text-left"
                            )}>
                              {formatDate((msg as any).created_at || (msg as any).createdAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          ) : (
            // 会话列表视图
            <div className="h-full flex flex-col">
              {sessionsLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                  <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">暂无对话记录</p>
                </div>
              ) : (
                <>
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-2">
                      {sessions.map((session: ChatSessionResponse) => (
                        <div
                          key={session.thread_id}
                          onClick={() => setSelectedSession(session)}
                          className="group flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-primary/30 hover:bg-primary/5 cursor-pointer transition-all"
                        >
                          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <MessageSquare className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm text-slate-900 truncate">
                              {session.title || "未命名对话"}
                            </h4>
                            <p className="text-xs text-slate-500 truncate mt-0.5">
                              {session.last_message || "暂无消息"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {session.message_count} 条
                              </Badge>
                              <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-end gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(session.updated_at)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50"
                              onClick={(e) => handleDeleteSession(session.thread_id, e)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {totalSessions > pageSize && (
                    <div className="border-t border-slate-100 px-4 py-3 shrink-0">
                      <Pagination
                        currentPage={currentPage}
                        totalPages={Math.ceil(totalSessions / pageSize)}
                        totalItems={totalSessions}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={setPageSize}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
