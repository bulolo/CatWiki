/**
 * 网页挂件预览组件
 * 模拟真实挂件在页面的展示效果
 */

"use client"

import { useState } from "react"
import { Bot, X, Send, User, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface ChatWidgetPreviewProps {
  title: string
  welcomeMessage: string
  primaryColor: string
  position: "left" | "right"
  onClose?: () => void
}

export function ChatWidgetPreview({
  title,
  welcomeMessage,
  primaryColor,
  position,
  onClose,
}: ChatWidgetPreviewProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<{ role: "assistant" | "user"; content: string }[]>([
    { role: "assistant", content: welcomeMessage || "您好！我是 AI 助手，有什么可以帮您？" },
  ])
  const [input, setInput] = useState("")

  const handleSend = () => {
    if (!input.trim()) return
    const newMessages = [...messages, { role: "user" as const, content: input }]
    setMessages(newMessages)
    setInput("")

    // 模拟 AI 回复
    setTimeout(() => {
      setMessages(prev => [...prev, { role: "assistant", content: "谢谢您的提问！这是一个预览演示。在实际部署后，我将整合您的知识库为您提供专业的解答。" }])
    }, 1000)
  }

  // 计算高对比度文本色或浅色背景
  const bgColor = primaryColor || "#3b82f6"

  return (
    <div className={cn(
      "fixed bottom-24 z-[9999] flex flex-col gap-5 transition-all duration-500 ease-in-out",
      position === "left" ? "left-8" : "right-8"
    )}>
      {/* 聊天窗口 */}
      {isOpen && (
        <div className="w-[380px] h-[600px] bg-white/95 backdrop-blur-xl rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-white/20 flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-300 origin-bottom-right">
          {/* 头部 - 渐变与玻璃拟态 */}
          <div
            className="p-5 text-white relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${bgColor}, ${bgColor}dd)`,
            }}
          >
            {/* 背景装饰球 */}
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
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/20 rounded-xl transition-all active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 消息区域 - 优雅的滚动条和间距 */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-gradient-to-b from-slate-50/50 to-white scrollbar-hide">
            <div className="text-center pb-2">
              <span className="px-3 py-1 bg-slate-100/80 rounded-full text-[10px] text-slate-400 font-bold uppercase tracking-widest">今天</span>
            </div>

            {messages.map((msg: { role: "assistant" | "user"; content: string }, i: number) => (

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
                    ? "bg-white text-slate-700 rounded-tl-none border border-slate-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]"
                    : "bg-slate-800 text-white rounded-tr-none shadow-md"
                )} style={msg.role === "user" ? { backgroundColor: bgColor } : {}}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          {/* 输入框 - 现代化设计 */}
          <div className="p-4 bg-white border-t border-slate-50">
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
                disabled={!input.trim()}
                className={cn(
                  "w-10 h-10 text-white rounded-xl shadow-lg flex items-center justify-center transition-all",
                  input.trim() ? "hover:scale-105 active:scale-95 opacity-100" : "opacity-40 cursor-not-allowed"
                )}
                style={{ backgroundColor: bgColor }}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5 opacity-30 group">
              <Bot size={10} className="text-slate-900 group-hover:rotate-12 transition-transform" />
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Powered by CatWiki Core</span>
            </div>
          </div>
        </div>
      )}

      {/* 触发按钮 - 更具品牌感的动态按钮 */}
      <div className={cn(
        "flex flex-col gap-3 transition-all duration-300",
        position === "left" ? "items-start" : "items-end"
      )}>
        {/* 提示气泡 */}
        {!isOpen && messages.length === 1 && (
          <div className={cn(
            "bg-slate-900 text-white px-5 py-3.5 rounded-[20px] shadow-2xl text-[13px] font-semibold animate-in slide-in-from-bottom-2 duration-500 flex items-center gap-2 border border-white/10",
            position === "left" ? "rounded-bl-none origin-left" : "rounded-br-none origin-right"
          )} onClick={() => setIsOpen(true)}>
            <span className="flex items-center gap-2">
              <Sparkles size={14} className="text-amber-400 animate-pulse" />
              有什么可以帮您？
            </span>
          </div>
        )}

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-16 h-16 rounded-[22px] shadow-[0_15px_30px_rgba(0,0,0,0.2)] flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all duration-300 group relative overflow-hidden"
          style={{ backgroundColor: bgColor }}
        >
          {/* 按钮内光泽效果 */}
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

      {/* 预览提示条 */}
      <div className={cn(
        "absolute -top-14 flex items-center gap-3 px-4 py-2 bg-slate-900/90 backdrop-blur-md text-white rounded-2xl text-[11px] shadow-2xl border border-white/10 animate-in slide-in-from-top-4 duration-700",
        position === "left" ? "left-0" : "right-0"
      )}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-ping"></div>
          <span className="font-bold tracking-tight">预览模式</span>
        </div>
        <div className="w-px h-3 bg-white/20"></div>
        <button
          onClick={onClose}
          className="hover:text-sky-400 transition-colors flex items-center gap-1 font-medium"
        >
          关闭
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
