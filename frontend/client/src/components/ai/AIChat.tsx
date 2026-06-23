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

import { useRef, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  ScrollArea,
} from "@/components/ui"
import { Send, Bot } from "lucide-react"
import type { ClientSite } from "@/lib/sdk/sdk.schemas"
import { useAIChat, useChatAutoScroll, useToolCallState, useChatInput } from "@/hooks"
import { MessageList } from "./MessageList"
import { ToolResultDialog } from "./ToolResultDialog"
import { useTranslations } from "next-intl"

interface AIChatProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialQuery?: string
  siteId?: number | null
  tenantId?: number | null
  tenantSlug?: string | null
  siteSlug?: string | null
  allSites?: ClientSite[]
}

export function AIChat({ open, onOpenChange, initialQuery, siteId, tenantId, tenantSlug, siteSlug, allSites }: AIChatProps) {
  const t = useTranslations("AIChat")
  const { messages, isLoading, sendMessage, threadId, setMessages, submitFeedback } = useAIChat({
    initialMessages: [{
      id: "welcome",
      role: "assistant" as const,
      content: t("welcome"),
    }],
    selectedSiteId: siteId,
    selectedTenantId: tenantId,
    tenantSlug,
    siteSlug,
  })

  const { input, setInput, handleSubmit } = useChatInput(sendMessage, isLoading)
  const scrollAreaRef = useChatAutoScroll(messages)
  const processedQueryRef = useRef<string | null>(null)
  const { selectedToolCall, setSelectedToolCall, handleResultFetched } = useToolCallState(setMessages)

  // 处理初始查询
  useEffect(() => {
    if (open && initialQuery && initialQuery !== "" && processedQueryRef.current !== initialQuery) {
      processedQueryRef.current = initialQuery
      sendMessage(initialQuery)
    }
    if (!open) {
      processedQueryRef.current = null
    }
  }, [open, initialQuery, sendMessage])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl w-full h-[100vh] md:h-[85vh] flex flex-col p-0 glass-card border-slate-200 shadow-2xl overflow-hidden rounded-none md:rounded-3xl m-0 md:m-auto">
          <DialogHeader className="px-4 md:px-8 pt-6 md:pt-8 pb-3 md:pb-4 border-b border-slate-100 bg-white/50">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-primary rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                <Bot className="h-5 w-5 md:h-6 md:w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg md:text-xl font-bold text-slate-900">{t("title")}</DialogTitle>
                <DialogDescription className="text-xs md:text-sm text-slate-500">
                  {t("description")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea
            ref={scrollAreaRef}
            className="flex-1 px-4 md:px-8 py-4 md:py-6 bg-slate-50/30"
          >
            <div className="space-y-4 md:space-y-8 pb-4">
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

          <form onSubmit={handleSubmit} className="p-4 md:p-6 bg-white border-t border-slate-100">
            <div className="relative group">
              <div className="absolute inset-0 bg-primary/5 rounded-xl md:rounded-2xl blur-lg opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative flex gap-2 md:gap-3 p-1.5 md:p-2 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t("inputPlaceholder")}
                  disabled={isLoading}
                  className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 text-sm md:text-[15px] placeholder:text-slate-400"
                />
                <Button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="h-8 w-8 md:h-10 md:w-10 shrink-0 rounded-lg md:rounded-xl shadow-none"
                >
                  <Send className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
