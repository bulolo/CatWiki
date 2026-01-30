"use client"

import { useState, useRef, useEffect } from "react"
import { Bot, X, Send, User, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAIChat } from "@/hooks"
import { Streamdown } from "streamdown"
import { MessageSources } from "@/components/ai/MessageSources"
import { ScrollArea } from "@/components/ui/scroll-area"

interface ChatWidgetProps {
  title: string
  welcomeMessage?: string
  primaryColor: string
  position: "left" | "right"
  isOpen: boolean
  onToggle: (isOpen: boolean) => void
}

export function ChatWidget({
  title,
  welcomeMessage,
  primaryColor,
  position,
  isOpen,
  onToggle,
}: ChatWidgetProps) {
  const { messages, isLoading, sendMessage } = useAIChat({
    initialMessages: [
      {
        id: "welcome",
        role: "assistant",
        content: welcomeMessage || "您好！我是 AI 助手，有什么可以帮您？",
      },
    ],
  })
  const [input, setInput] = useState("")
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto scroll
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') || scrollAreaRef.current;
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    sendMessage(input)
    setInput("")
  }

  const bgColor = primaryColor || "#3b82f6"

  return (
    <div className={cn(
      "fixed inset-0 flex flex-col justify-end p-4 pointer-events-none",
      position === "left" ? "items-start" : "items-end"
    )}>
      {/* Chat Window */}
      {isOpen && (
        <div className="w-full max-w-[380px] h-[600px] bg-white rounded-[24px] border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300 origin-bottom-right pointer-events-auto mb-4">
          {/* Header */}
          <div
            className="p-5 text-white relative overflow-hidden shrink-0"
            style={{
              background: `linear-gradient(135deg, ${bgColor}, ${bgColor}dd)`,
            }}
          >
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>

            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-inner border border-white/20">
                  <Bot className="w-6 h-6" />
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-sm tracking-wide">{title || "AI 智能客服"}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                    <span className="text-[10px] text-white/80 font-medium tracking-tight">在线咨询中</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => onToggle(false)}
                className="p-2 hover:bg-white/20 rounded-xl transition-all active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <ScrollArea ref={scrollAreaRef} className="flex-1 bg-gradient-to-b from-slate-50/50 to-white">
            <div className="p-5 space-y-6">
              <div className="text-center pb-2">
                <span className="px-3 py-1 bg-slate-100/80 rounded-full text-[10px] text-slate-400 font-bold uppercase tracking-widest">今天</span>
              </div>

              {messages.map((msg, i) => (
                <div key={i} className={cn(
                  "flex gap-3 max-w-[90%] group",
                  msg.role === "user" ? "ml-auto flex-row-reverse" : "animate-in slide-in-from-left-2 duration-300"
                )}>
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-sm transition-transform group-hover:scale-110",
                    msg.role === "assistant" ? "bg-slate-800" : ""
                  )} style={msg.role === "assistant" ? { backgroundColor: bgColor } : { backgroundColor: "#1e293b" }}>
                    {msg.role === "assistant" ? <Bot size={16} /> : <User size={16} />}
                  </div>
                  <div className={cn(
                    "p-4 rounded-[20px] text-[13px] leading-relaxed relative",
                    msg.role === "assistant"
                      ? "bg-white text-slate-700 rounded-tl-none border border-slate-100 shadow-[0_2px_10_rgba(0,0,0,0.02)]"
                      : "bg-slate-800 text-white rounded-tr-none shadow-md"
                  )} style={msg.role === "user" ? { backgroundColor: bgColor } : {}}>
                    <Streamdown isAnimating={isLoading && msg.role === "assistant"}>
                      {msg.content}
                    </Streamdown>
                    <MessageSources sources={(msg as any).sources} />
                  </div>
                </div>
              ))}
              
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-slate-200">
                    <Bot size={16} className="text-slate-400" />
                  </div>
                  <div className="bg-white border border-slate-100 rounded-[20px] px-4 py-3 w-20 flex gap-1 items-center">
                    <div className="w-1 h-1 bg-slate-300 rounded-full animate-bounce" />
                    <div className="w-1 h-1 bg-slate-300 rounded-full animate-bounce delay-75" />
                    <div className="w-1 h-1 bg-slate-300 rounded-full animate-bounce delay-150" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input Box */}
          <div className="p-4 bg-white border-t border-slate-100 shrink-0">
            <div className="flex items-center gap-3 bg-slate-100/50 hover:bg-slate-100 transition-colors border border-slate-200/50 rounded-[18px] p-2 pl-4 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="键入您要咨询的内容..."
                className="flex-1 bg-transparent border-none py-2 text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className={cn(
                  "w-10 h-10 text-white rounded-xl shadow-lg flex items-center justify-center transition-all",
                  input.trim() && !isLoading ? "hover:scale-105 active:scale-95 opacity-100" : "opacity-40 cursor-not-allowed"
                )}
                style={{ backgroundColor: bgColor }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5 opacity-30 group">
              <Bot size={10} className="text-slate-900 group-hover:rotate-12 transition-transform" />
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Powered by CatWiki</span>
            </div>
          </div>
        </div>
      )}

      {/* Trigger Button */}
      <div className={cn(
        "flex flex-col gap-3 transition-all duration-300 pointer-events-auto",
        position === "left" ? "items-start" : "items-end"
      )}>
        <button
          onClick={() => onToggle(!isOpen)}
          className="w-16 h-16 rounded-[22px] flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all duration-300 group relative overflow-hidden"
          style={{ backgroundColor: bgColor }}
        >
          <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent"></div>
          <div className="relative z-10">
            {isOpen ? (
              <X size={28} className="animate-in spin-in-90 duration-300" />
            ) : (
              <div className="relative">
                <Bot size={34} className="group-hover:rotate-6 transition-transform" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full"></span>
              </div>
            )}
          </div>
        </button>
      </div>
    </div>
  )
}
