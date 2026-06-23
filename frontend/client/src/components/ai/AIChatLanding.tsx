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

import { useState, useCallback } from "react"
import { Sparkles, Bot, ArrowRight, BookOpen, Plus, History as HistoryIcon } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui"
import { useAIChat, useChatAutoScroll, useToolCallState, useChatInput } from "@/hooks"
import { CHAT_SESSIONS_KEY } from "@/hooks/useChatSessions"
import { MessageList } from "./MessageList"
import { ToolResultDialog } from "./ToolResultDialog"
import { ChatHistorySidebar } from "./ChatHistorySidebar"
import type { ClientSite, QuickQuestion } from "@/lib/sdk/sdk.schemas"
import { useTranslations } from "next-intl"


interface AIChatLandingProps {
  siteName?: string
  siteId?: number | null
  tenantId?: number | null
  tenantSlug?: string | null
  siteSlug?: string | null
  quickQuestions?: QuickQuestion[]
  allSites?: ClientSite[]
}

const QUICK_QUESTION_ICONS = [
  <Sparkles key="0" className="h-4 w-4 text-amber-500" />,
  <BookOpen key="1" className="h-4 w-4 text-blue-500" />,
  <Sparkles key="2" className="h-4 w-4 text-purple-500" />,
]

export function AIChatLanding({ siteName = "CatWiki", siteId, tenantId, tenantSlug, siteSlug, quickQuestions: propQuickQuestions, allSites }: AIChatLandingProps) {
  const t = useTranslations("AIChatLanding")
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const queryClient = useQueryClient()

  const onMessageSent = useCallback(
    () => queryClient.invalidateQueries({ queryKey: [CHAT_SESSIONS_KEY] }),
    [queryClient],
  )
  const { messages, isLoading, sendMessage, threadId, resetMessages, loadSessionMessages, setMessages, submitFeedback } = useAIChat({
    selectedSiteId: siteId,
    selectedTenantId: tenantId,
    tenantSlug,
    siteSlug,
    onMessageSent,
  })
  const chatContainerRef = useChatAutoScroll(messages)
  const { selectedToolCall, setSelectedToolCall, handleResultFetched } = useToolCallState(setMessages)
  const { input, setInput, send: handleSend } = useChatInput(sendMessage, isLoading)

  const quickQuestions = propQuickQuestions?.slice(0, 3).map((q, idx) => ({
    text: q.text,
    icon: QUICK_QUESTION_ICONS[idx],
  })) ?? []

  return (
    <>
    <div className="flex-1 flex bg-white h-full overflow-hidden relative">
      <ChatHistorySidebar
        siteId={siteId}
        currentThreadId={threadId}
        onSelectSession={(tid) => {
          loadSessionMessages(tid)
        }}
        onNewChat={() => {
          resetMessages()
          setIsHistoryOpen(false)
        }}
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />

      {/* Transparent area to handle click-outside */}
      {isHistoryOpen && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onClick={() => setIsHistoryOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* 装饰性背景 */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-[0.03]">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary blur-[100px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500 blur-[100px]" />
        </div>

        {/* 顶部操作按钮 */}
        <div className="absolute top-4 right-4 z-30 flex flex-row-reverse gap-2">
          {!isHistoryOpen && (
            <Button
              variant="outline"
              size="sm"
               className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-sm rounded-xl px-3 transition-all"
              onClick={() => setIsHistoryOpen(true)}
            >
              <HistoryIcon className="h-4 w-4 mr-2" />
              {t("history")}
            </Button>
          )}
          {messages.length > 0 && !isHistoryOpen && (
            <Button
              variant="outline"
              size="sm"
               className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-sm rounded-xl px-3"
              onClick={() => resetMessages()}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("newChat")}
            </Button>
          )}
        </div>

        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 md:px-6 pt-16 md:pt-20 lg:pt-24 relative z-10 overflow-hidden">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center -mt-10 md:-mt-16 lg:-mt-20">
               <div className="w-16 h-16 md:w-20 md:h-20 bg-primary rounded-2xl md:rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-primary/30 mb-6 md:mb-8 animate-in zoom-in duration-500">
                <Bot className="h-8 w-8 md:h-10 md:w-10 text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 mb-3 md:mb-4 tracking-tight text-center px-4">{t("welcome", { siteName })}</h1>
              <p className="text-slate-500 text-sm md:text-base lg:text-lg mb-8 md:mb-10 lg:mb-12 text-center max-w-md px-4">
                {t("description")}
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
              <MessageList
                messages={messages}
                isLoading={isLoading}
                allSites={allSites}
                onToolCallClick={setSelectedToolCall}
                onFeedback={submitFeedback}
                variant="full"
              />
            </div>
          )}

          {/* 底部输入框 */}
          <div className="absolute bottom-6 md:bottom-8 lg:bottom-10 left-0 w-full px-4 md:px-6 pointer-events-none">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(input) }}
              className="max-w-3xl mx-auto w-full glass-card p-1.5 md:p-2 rounded-2xl md:rounded-3xl lg:rounded-[2rem] border-slate-200/50 shadow-2xl pointer-events-auto flex items-center gap-2"
            >
               <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("inputPlaceholder")}
                className="flex-1 bg-transparent border-none outline-none px-4 md:px-6 py-2 md:py-3 text-sm md:text-base lg:text-lg placeholder:text-slate-400 font-sans"
                disabled={isLoading}
                aria-label={t("inputAria")}
              />
              <button
                disabled={!input.trim() || isLoading}
                className="w-10 h-10 md:w-12 md:h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all shrink-0"
                aria-label={t("sendAria")}
              >
                <ArrowRight className="h-5 w-5 md:h-6 md:w-6" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
    <ToolResultDialog
      open={!!selectedToolCall}
      onOpenChange={(open) => !open && setSelectedToolCall(null)}
      toolCall={selectedToolCall}
      threadId={threadId}
      siteId={siteId}
      onResultFetched={handleResultFetched}
    />
  </>
  )
}
