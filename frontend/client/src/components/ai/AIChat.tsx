// Copyright 2024 CatWiki Authors
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

import { useRef, useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Bot, User, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { Site } from "@/lib/sdk/models/Site"
import { Streamdown } from "streamdown"
import { useAIChat } from "@/hooks"
import { MessageSources } from "./MessageSources"
import { ToolCallCard } from "./ToolCallCard"

interface AIChatProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialQuery?: string
  siteId?: number | null
  allSites?: Site[]
}

const WELCOME_MESSAGE = {
  id: "welcome",
  role: "assistant" as const,
  content: "你好！我是 catWiki 的 AI 助手，有什么可以帮助你的吗？",
}

export function AIChat({ open, onOpenChange, initialQuery, siteId, allSites }: AIChatProps) {
  const { messages, isLoading, sendMessage } = useAIChat({
    initialMessages: [WELCOME_MESSAGE],
    selectedSiteId: siteId,
  })

  const [input, setInput] = useState("")
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  // 用于记录已处理的 initialQuery，避免重复发送
  const processedQueryRef = useRef<string | null>(null)

  // 自动滚动
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') || scrollAreaRef.current;
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages])

  // 处理初始查询
  useEffect(() => {
    if (open && initialQuery && initialQuery !== "" && processedQueryRef.current !== initialQuery) {
      processedQueryRef.current = initialQuery
      sendMessage(initialQuery)
    }
    // 对话框关闭时重置
    if (!open) {
      processedQueryRef.current = null
    }
  }, [open, initialQuery, sendMessage])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-full h-[100vh] md:h-[85vh] flex flex-col p-0 glass-card border-slate-200 shadow-2xl overflow-hidden rounded-none md:rounded-3xl m-0 md:m-auto">
        <DialogHeader className="px-4 md:px-8 pt-6 md:pt-8 pb-3 md:pb-4 border-b border-slate-100 bg-white/50">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-primary rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
              <Bot className="h-5 w-5 md:h-6 md:w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg md:text-xl font-bold text-slate-900">AI 智能助手</DialogTitle>
              <DialogDescription className="text-xs md:text-sm text-slate-500">
                基于 RAG 技术的语义检索与问答
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea
          ref={scrollAreaRef}
          className="flex-1 px-4 md:px-8 py-4 md:py-6 bg-slate-50/30"
        >
          <div className="space-y-4 md:space-y-8 pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-2 md:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300",
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div className={cn(
                  "w-7 h-7 md:w-8 md:h-8 rounded-lg md:rounded-xl flex items-center justify-center shrink-0 shadow-sm",
                  message.role === "assistant" ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-600"
                )}>
                  {message.role === "assistant" ? <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4" /> : <User className="h-3.5 w-3.5 md:h-4 md:w-4" />}
                </div>

                <div className={cn(
                  "max-w-[85%] rounded-xl md:rounded-2xl px-3 md:px-5 py-2 md:py-3 shadow-sm",
                  message.role === "user"
                    ? "bg-primary text-white"
                    : "bg-white border border-slate-100"
                )}>
                  <div className={cn(
                    "text-sm md:text-[15px] leading-relaxed",
                    message.role === "assistant" ? "prose prose-slate prose-sm max-w-none prose-p:leading-relaxed" : ""
                  )}>
                    {/* Tool Call 展示 */}
                    {message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0 && (
                      <ToolCallCard toolCalls={message.toolCalls} />
                    )}
                    
                    {/* 消息内容 */}
                    {message.content && (
                      <Streamdown isAnimating={isLoading && message.role === "assistant" && message.status === "streaming"}>
                        {message.content}
                      </Streamdown>
                    )}
                    <MessageSources sources={message.sources} allSites={allSites} />
                  </div>
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-2 md:gap-4 animate-pulse">
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg md:rounded-xl bg-primary/20 flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary/40" />
                </div>
                <div className="bg-white border border-slate-100 rounded-xl md:rounded-2xl px-4 md:px-6 py-3 md:py-4 w-20 md:w-24 flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce delay-75" />
                  <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce delay-150" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <form onSubmit={handleSubmit} className="p-4 md:p-6 bg-white border-t border-slate-100">
          <div className="relative group">
            <div className="absolute inset-0 bg-primary/5 rounded-xl md:rounded-2xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
            <div className="relative flex gap-2 md:gap-3 p-1.5 md:p-2 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl focus-within:ring-2 focus-within:ring-primary/20 transition-all">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="询问关于知识库内容的问题..."
                disabled={isLoading}
                className="flex-1 bg-transparent border-none focus-visible:ring-0 text-sm md:text-[15px] shadow-none"
                aria-label="输入您的问题"
              />
              <Button
                type="submit"
                disabled={!input.trim() || isLoading}
                size="icon"
                className="rounded-lg md:rounded-xl shadow-lg shadow-primary/20 h-9 w-9 md:h-10 md:w-10"
                aria-label="发送消息"
              >
                <Send className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </Button>
            </div>
          </div>
          <p className="mt-2 md:mt-3 text-[10px] md:text-[11px] text-center text-slate-400">
            AI 可能会产生误差，建议参考原始文档。
          </p>
        </form>
      </DialogContent>
    </Dialog>
  )
}
