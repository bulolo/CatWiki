"use client"

import { useState, useRef, useEffect } from "react"
import { Sparkles, MessageSquare, Bot, ArrowRight, BookOpen } from "lucide-react"
import { Streamdown } from "streamdown"
import { cn } from "@/lib/utils"
// import { QUICK_QUESTIONS } from "@/constants/constants" // Removed unused import
import { useAIChat } from "@/hooks"
import { MessageSources } from "./MessageSources"
import type { QuickQuestion } from "@/lib/sdk/models/QuickQuestion"

interface AIChatLandingProps {
  siteName?: string
  siteId?: number | null
  quickQuestions?: QuickQuestion[]
}

export function AIChatLanding({ siteName = "CatWiki", siteId, quickQuestions: propQuickQuestions }: AIChatLandingProps) {
  const { messages, isLoading, sendMessage } = useAIChat({
    selectedSiteId: siteId,
  })
  
  const [input, setInput] = useState("")
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Use props or default to empty array (or fallback logic if needed, but per plan we use dynamic)
  // Logic from page.tsx: Sparkles, BookOpen, Sparkles
  const quickQuestions = propQuickQuestions?.slice(0, 3).map((q, idx) => ({
    text: q.text,
    icon: idx === 0 ? <Sparkles className="h-4 w-4 text-amber-500" /> : idx === 1 ? <BookOpen className="h-4 w-4 text-blue-500" /> : <Sparkles className="h-4 w-4 text-purple-500" />,
  })) ?? []

  const handleSend = (text: string) => {
    if (!text.trim() || isLoading) return
    sendMessage(text)
    setInput("")
  }

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div className="flex-1 flex flex-col bg-white h-full overflow-hidden relative">
      {/* 装饰性背景 */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-[0.03]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500 blur-[100px]" />
      </div>

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 md:px-6 pt-16 md:pt-20 lg:pt-24 relative z-10 overflow-hidden">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center -mt-10 md:-mt-16 lg:-mt-20">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-primary rounded-2xl md:rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-primary/30 mb-6 md:mb-8 animate-in zoom-in duration-500">
              <Bot className="h-8 w-8 md:h-10 md:w-10 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 mb-3 md:mb-4 tracking-tight text-center px-4">您好，我是 {siteName} AI</h1>
            <p className="text-slate-500 text-sm md:text-base lg:text-lg mb-8 md:mb-10 lg:mb-12 text-center max-w-md px-4">
              您可以问我任何关于知识库内容的问题，或者让我帮您在文档中检索相关信息。
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 w-full">
              {quickQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(q.text)}
                  className="p-3 md:p-4 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl hover:bg-white hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all text-left group"
                >
                  <div className="mb-2 md:mb-3 p-1.5 md:p-2 bg-white rounded-lg md:rounded-xl w-fit shadow-sm group-hover:scale-110 transition-transform">
                    {q.icon}
                  </div>
                  <p className="text-xs md:text-sm font-semibold text-slate-700 leading-snug">{q.text}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-4 md:space-y-8 pb-32 pt-4 scroll-smooth pr-2 scrollbar-hide">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3 md:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500",
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div className={cn(
                  "w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                  message.role === "assistant" ? "bg-primary text-white" : "bg-white border border-slate-200 text-slate-600"
                )}>
                  {message.role === "assistant" ? <Sparkles className="h-4 w-4 md:h-5 md:w-5" /> : <MessageSquare className="h-4 w-4 md:h-5 md:w-5" />}
                </div>
                
                <div className="flex flex-col gap-2 max-w-[85%]">
                  <div className={cn(
                    "rounded-2xl md:rounded-3xl px-4 md:px-6 py-3 md:py-4 shadow-sm",
                    message.role === "user"
                      ? "bg-primary text-white"
                      : "bg-slate-50 border border-slate-100"
                  )}>
                    <div className={cn(
                      "text-sm md:text-[16px] leading-relaxed",
                      message.role === "assistant" ? "prose prose-slate max-w-none prose-p:leading-relaxed" : ""
                    )}>
                      {message.role === "assistant" && !message.content ? (
                        <div className="flex gap-1 md:gap-1.5 items-center py-2 h-6">
                          <div className="w-1 h-1 md:w-1.5 md:h-1.5 bg-slate-400 rounded-full animate-bounce" />
                          <div className="w-1 h-1 md:w-1.5 md:h-1.5 bg-slate-400 rounded-full animate-bounce delay-75" />
                          <div className="w-1 h-1 md:w-1.5 md:h-1.5 bg-slate-400 rounded-full animate-bounce delay-150" />
                        </div>
                      ) : (
                        <Streamdown isAnimating={isLoading && message.role === "assistant"}>
                          {message.content}
                        </Streamdown>
                      )}
                    </div>
                  </div>
                  <MessageSources sources={message.sources} />
                </div>
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3 md:gap-6 animate-pulse">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-primary/20 flex items-center justify-center">
                  <Bot className="h-4 w-4 md:h-5 md:w-5 text-primary/40" />
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl md:rounded-3xl px-6 md:px-8 py-4 md:py-6 w-24 md:w-32 flex gap-1 md:gap-1.5 items-center">
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-primary/40 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-primary/40 rounded-full animate-bounce delay-75" />
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-primary/40 rounded-full animate-bounce delay-150" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 底部输入框 */}
        <div className="absolute bottom-6 md:bottom-8 lg:bottom-10 left-0 w-full px-4 md:px-6 pointer-events-none">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
            className="max-w-3xl mx-auto w-full glass-card p-1.5 md:p-2 rounded-2xl md:rounded-3xl lg:rounded-[2rem] border-slate-200/50 shadow-2xl pointer-events-auto flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="问问 AI 助手..."
              className="flex-1 bg-transparent border-none outline-none px-4 md:px-6 py-2 md:py-3 text-sm md:text-base lg:text-lg placeholder:text-slate-400 font-sans"
              disabled={isLoading}
              aria-label="输入您的问题"
            />
            <button
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 md:w-12 md:h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all shrink-0"
              aria-label="发送消息"
            >
              <ArrowRight className="h-5 w-5 md:h-6 md:w-6" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

