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

import { useEffect, useMemo, useRef } from "react"
import type { Message } from "@/types"

/**
 * 每当消息列表「语义上」更新时，自动将滚动区域滚到底部。
 * 同时兼容 Radix ScrollArea（通过 data-radix-scroll-area-viewport 选取内部视口）
 * 和普通 div（直接操作 scrollTop）。
 *
 * ⚠️ 不直接监听 messages 数组引用 —— 否则点击工具 pill 打开检索弹窗、
 *   或后端给老消息补 elapsed/result 等"非新增"更新都会强制下滑。
 *   仅当下列任一变更时才滚动：
 *     - 消息条数变化
 *     - 最后一条消息切换（id 变）
 *     - 最后一条消息的正文长度变化（流式追加 token）
 *     - 最后一条消息的工具数量变化（新一轮工具调用）
 *     - 最后一条消息的状态切换（streaming / tool_calling / done）
 */
export function useChatAutoScroll(messages: Message[]) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const signature = useMemo(() => {
    const last = messages[messages.length - 1]
    return [
      messages.length,
      last?.id ?? "",
      last?.content?.length ?? 0,
      last?.toolCalls?.length ?? 0,
      last?.status ?? "",
    ].join("|")
  }, [messages])

  useEffect(() => {
    if (!scrollRef.current) return
    const viewport =
      scrollRef.current.querySelector("[data-radix-scroll-area-viewport]") ??
      scrollRef.current
    viewport.scrollTop = viewport.scrollHeight
  }, [signature])

  return scrollRef
}
