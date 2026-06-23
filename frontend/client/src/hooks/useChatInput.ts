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

import { useCallback, useState, type FormEvent } from "react"

/**
 * 对话输入框状态 + 发送逻辑，三个对话容器（AIChat / AIChatLanding / ChatWidget）共用。
 *
 * - `send(text?)`：发送指定文本，缺省则发送当前输入框内容；空白或加载中时忽略，发送后清空。
 * - `handleSubmit`：表单 onSubmit 包装（preventDefault + send 当前输入）。
 */
export function useChatInput(sendMessage: (content: string) => void, isLoading: boolean) {
  const [input, setInput] = useState("")

  const send = useCallback((text?: string) => {
    const content = text ?? input
    if (!content.trim() || isLoading) return
    sendMessage(content)
    setInput("")
  }, [input, isLoading, sendMessage])

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault()
    send()
  }, [send])

  return { input, setInput, send, handleSubmit }
}
