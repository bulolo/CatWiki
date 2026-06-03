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

import type { Message, ToolCall } from "@/types"
import type { ClientSite } from "@/lib/sdk/sdk.schemas"
import { MessageBubble, ChatLoadingIndicator, type FeedbackHandler } from "./MessageBubble"

interface MessageListProps {
  messages: Message[]
  isLoading: boolean
  allSites?: ClientSite[]
  onToolCallClick: (tc: ToolCall) => void
  /**
   * compact — AIChat 弹窗（小头像，来源在气泡内）
   * full    — AIChatLanding 全页面（大头像，内联思考态，来源在气泡外）
   */
  variant?: "compact" | "full"
  /** 反馈提交回调；缺省则 👍/👎 仅本地 state */
  onFeedback?: FeedbackHandler
}

export function MessageList({
  messages,
  isLoading,
  allSites,
  onToolCallClick,
  variant = "full",
  onFeedback,
}: MessageListProps) {
  const compact = variant === "compact"

  return (
    <>
      {messages.map(message => (
        <MessageBubble
          key={message.id}
          message={message}
          isLoading={isLoading}
          allSites={allSites}
          onToolCallClick={onToolCallClick}
          onFeedback={onFeedback}
          variant={variant}
        />
      ))}
      {isLoading && messages[messages.length - 1]?.role === "user" && (
        <ChatLoadingIndicator compact={compact} />
      )}
    </>
  )
}
