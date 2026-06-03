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

import { Bot, Sparkles, User, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { Streamdown } from "streamdown"
import type { Message, ToolCall } from "@/types"
import type { ClientSite } from "@/lib/sdk/sdk.schemas"
import { MessageActions, type NegativeReason } from "./MessageActions"
import { MessageSources } from "./MessageSources"
import { TimingFooter } from "./TimingFooter"
import { ToolCallCard } from "./ToolCallCard"

export type FeedbackHandler = (
  message: Message,
  rating: "up" | "down" | null,
  reason: NegativeReason | null,
) => void

interface MessageBubbleProps {
  message: Message
  isLoading: boolean
  allSites?: ClientSite[]
  onToolCallClick: (tc: ToolCall) => void
  variant: "compact" | "full"
  /** 当前消息的反馈提交回调；缺省则 👍/👎 仅本地 state，不持久化 */
  onFeedback?: FeedbackHandler
}

/** 助手消息正下方的 meta 行：👍👎 + 性能数据。仅对话已完成且有内容时显示。 */
function MessageMetaRow({
  message,
  compact = false,
  onFeedback,
}: {
  message: Message
  compact?: boolean
  onFeedback?: FeedbackHandler
}) {
  if (message.role !== "assistant") return null
  // 正在工具调用 / 流式输出时不显示，避免视觉抖动
  if (message.status === "streaming" || message.status === "tool_calling") return null
  if (!message.content) return null

  const hasStats = !!(
    message.timings?.ttfbMs ||
    message.timings?.firstTokenMs ||
    message.timings?.totalMs ||
    message.usage?.totalTokens
  )

  return (
    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 pl-1 mt-1 animate-in fade-in duration-300">
      <MessageActions
        onFeedback={
          onFeedback ? (rating, reason) => onFeedback(message, rating, reason) : undefined
        }
      />
      {hasStats && <div className="h-3 w-px bg-slate-200" />}
      {hasStats && (
        <TimingFooter
          timings={message.timings}
          usage={message.usage}
          compact={compact}
          className="!mt-0"
        />
      )}
    </div>
  )
}

function CompactBubble({ message, isLoading, allSites, onToolCallClick, onFeedback }: Omit<MessageBubbleProps, "variant">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 max-w-[85%]",
        message.role === "user" ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "rounded-xl md:rounded-2xl px-3 md:px-5 py-2 md:py-3 shadow-sm",
          message.role === "user" ? "bg-primary text-white" : "bg-white border border-slate-100",
        )}
      >
        <div
          className={cn(
            "text-sm md:text-[15px] leading-relaxed",
            message.role === "assistant"
              ? "prose prose-slate prose-sm max-w-none prose-p:leading-relaxed"
              : "",
          )}
        >
          {message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0 && (
            <ToolCallCard toolCalls={message.toolCalls} onToolCallClick={onToolCallClick} />
          )}
          {message.content && (
            <Streamdown
              isAnimating={isLoading && message.role === "assistant" && message.status === "streaming"}
            >
              {message.content}
            </Streamdown>
          )}
          <MessageSources sources={message.sources} allSites={allSites} />
        </div>
      </div>
      <MessageMetaRow message={message} compact onFeedback={onFeedback} />
    </div>
  )
}

function FullBubble({ message, isLoading, allSites, onToolCallClick, onFeedback }: Omit<MessageBubbleProps, "variant">) {
  return (
    <div className="flex flex-col gap-2 max-w-[85%]">
      <div
        className={cn(
          "rounded-2xl md:rounded-3xl px-4 md:px-6 py-3 md:py-4 shadow-sm",
          message.role === "user" ? "bg-primary text-white" : "bg-slate-50 border border-slate-100",
        )}
      >
        <div
          className={cn(
            "text-sm md:text-[16px] leading-relaxed",
            message.role === "assistant"
              ? "prose prose-slate max-w-none prose-p:leading-relaxed"
              : "",
          )}
        >
          {message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0 && (
            <ToolCallCard toolCalls={message.toolCalls} onToolCallClick={onToolCallClick} />
          )}
          {message.role === "assistant" && !message.content && !message.toolCalls?.length ? (
            <div className="flex gap-1 md:gap-1.5 items-center py-2 h-6">
              <div className="w-1 h-1 md:w-1.5 md:h-1.5 bg-slate-400 rounded-full animate-bounce" />
              <div className="w-1 h-1 md:w-1.5 md:h-1.5 bg-slate-400 rounded-full animate-bounce delay-75" />
              <div className="w-1 h-1 md:w-1.5 md:h-1.5 bg-slate-400 rounded-full animate-bounce delay-150" />
            </div>
          ) : message.content ? (
            <Streamdown
              isAnimating={isLoading && message.role === "assistant" && message.status === "streaming"}
            >
              {message.content}
            </Streamdown>
          ) : null}
        </div>
      </div>
      <MessageMetaRow message={message} onFeedback={onFeedback} />
      <MessageSources sources={message.sources} allSites={allSites} />
    </div>
  )
}

export function MessageBubble({ message, isLoading, allSites, onToolCallClick, onFeedback, variant }: MessageBubbleProps) {
  const compact = variant === "compact"

  return (
    <div
      className={cn(
        compact
          ? "flex gap-2 md:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
          : "flex gap-3 md:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500",
        message.role === "user" ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* 头像 */}
      <div
        className={cn(
          "flex items-center justify-center shrink-0 shadow-sm",
          compact
            ? "w-7 h-7 md:w-8 md:h-8 rounded-lg md:rounded-xl"
            : "w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl",
          message.role === "assistant"
            ? "bg-primary text-white"
            : "bg-white border border-slate-200 text-slate-600",
        )}
      >
        {message.role === "assistant" ? (
          <Sparkles className={compact ? "h-3.5 w-3.5 md:h-4 md:w-4" : "h-4 w-4 md:h-5 md:w-5"} />
        ) : compact ? (
          <User className="h-3.5 w-3.5 md:h-4 md:w-4" />
        ) : (
          <MessageSquare className="h-4 w-4 md:h-5 md:w-5" />
        )}
      </div>

      {compact ? (
        <CompactBubble
          message={message}
          isLoading={isLoading}
          allSites={allSites}
          onToolCallClick={onToolCallClick}
          onFeedback={onFeedback}
        />
      ) : (
        <FullBubble
          message={message}
          isLoading={isLoading}
          allSites={allSites}
          onToolCallClick={onToolCallClick}
          onFeedback={onFeedback}
        />
      )}
    </div>
  )
}

/** 等待第一个 token 到达时的占位 loading 行 */
export function ChatLoadingIndicator({ compact }: { compact: boolean }) {
  if (compact) {
    return (
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
    )
  }
  return (
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
  )
}
