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

import { useState, useCallback, type Dispatch, type SetStateAction } from "react"
import type { Message, ToolCall } from "@/types"

/**
 * 管理 ToolResultDialog 的选中状态，并提供写回工具调用结果的回调。
 * AIChat 和 AIChatLanding 共用相同逻辑，统一在此维护。
 */
export function useToolCallState(setMessages: Dispatch<SetStateAction<Message[]>>) {
  const [selectedToolCall, setSelectedToolCall] = useState<ToolCall | null>(null)

  const handleResultFetched = useCallback(
    (toolCallId: string, result: string) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.toolCalls
            ? {
                ...msg,
                toolCalls: msg.toolCalls.map(tc =>
                  tc.id === toolCallId ? { ...tc, result } : tc
                ),
              }
            : msg
        )
      )
    },
    [setMessages]
  )

  return { selectedToolCall, setSelectedToolCall, handleResultFetched }
}
