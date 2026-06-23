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

import { Bot, X, Send } from "lucide-react"
import { cn, hexToHslString } from "@/lib/utils"
import { useAIChat, useChatAutoScroll, useToolCallState, useChatInput } from "@/hooks"
import { useTranslations } from "next-intl"
import { MessageList } from "./MessageList"
import { ToolResultDialog } from "./ToolResultDialog"
import { ScrollArea } from "@/components/ui"
import type { ClientSite } from "@/lib/sdk/sdk.schemas"

const FALLBACK_PRIMARY_COLOR = "#3b82f6"

interface ChatWidgetProps {
  title: string
  welcomeMessage?: string
  primaryColor: string
  position: "left" | "right"
  isOpen: boolean
  onToggle: (isOpen: boolean) => void
  siteId?: number | null
  allSites?: ClientSite[]
}

export function ChatWidget({
  title,
  welcomeMessage,
  primaryColor,
  position,
  isOpen,
  onToggle,
  siteId,
  allSites,
}: ChatWidgetProps) {
  const t = useTranslations("ChatWidget")
  const { messages, isLoading, sendMessage, threadId, setMessages, submitFeedback } = useAIChat({
    initialMessages: [
      {
        id: "welcome",
        role: "assistant",
        content: welcomeMessage || t("defaultWelcome"),
      },
    ],
    selectedSiteId: siteId,
  })
  const { input, setInput, send } = useChatInput(sendMessage, isLoading)
  const scrollAreaRef = useChatAutoScroll(messages)
  const { selectedToolCall, setSelectedToolCall, handleResultFetched } = useToolCallState(setMessages)

  const bgColor = primaryColor || FALLBACK_PRIMARY_COLOR
  // 把站点品牌色注入 --primary，让复用的 MessageBubble（bg-primary）跟随品牌色
  const brandHsl = hexToHslString(bgColor)
  const brandStyle = brandHsl ? ({ "--primary": brandHsl } as React.CSSProperties) : undefined

  return (
    <>
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
                  <span className="font-extrabold text-sm tracking-wide">{title || t("defaultTitle")}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                    <span className="text-[10px] text-white/80 font-medium tracking-tight">{t("online")}</span>
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
            <div className="p-5 space-y-6" style={brandStyle}>
              <div className="text-center pb-2">
                <span className="px-3 py-1 bg-slate-100/80 rounded-full text-[10px] text-slate-400 font-bold uppercase tracking-widest">{t("today")}</span>
              </div>

              <MessageList
                messages={messages}
                isLoading={isLoading}
                allSites={allSites}
                onToolCallClick={setSelectedToolCall}
                onFeedback={submitFeedback}
                variant="compact"
              />
            </div>
          </ScrollArea>

          {/* Input Box */}
          <div className="p-4 bg-white border-t border-slate-100 shrink-0">
            <div className="flex items-center gap-3 bg-slate-100/50 hover:bg-slate-100 transition-colors border border-slate-200/50 rounded-[18px] p-2 pl-4 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={t("inputPlaceholder")}
                className="flex-1 bg-transparent border-none py-2 text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                onClick={() => send()}
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

    <ToolResultDialog
      toolCall={selectedToolCall}
      threadId={threadId}
      siteId={siteId}
      open={!!selectedToolCall}
      onOpenChange={(open) => { if (!open) setSelectedToolCall(null) }}
      onResultFetched={handleResultFetched}
    />
    </>
  )
}
