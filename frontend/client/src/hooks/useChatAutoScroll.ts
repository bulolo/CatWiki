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

import { useEffect, useRef } from "react"
import type { Message } from "@/types"

/**
 * 每当消息列表更新时，自动将滚动区域滚到底部。
 * 同时兼容 Radix ScrollArea（通过 data-radix-scroll-area-viewport 选取内部视口）
 * 和普通 div（直接操作 scrollTop）。
 */
export function useChatAutoScroll(messages: Message[]) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scrollRef.current) return
    const viewport =
      scrollRef.current.querySelector("[data-radix-scroll-area-viewport]") ??
      scrollRef.current
    viewport.scrollTop = viewport.scrollHeight
  }, [messages])

  return scrollRef
}
