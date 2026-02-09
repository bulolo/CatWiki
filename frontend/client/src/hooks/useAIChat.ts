// Copyright 2024 CatWiki Authors
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

import { useState, useCallback, useRef } from "react"
import { env } from "@/lib/env"
import { api } from "@/lib/api-client"
import type { Message } from "@/types"
import { getVisitorId } from "@/lib/visitor"

interface UseAIChatOptions {
  /** 初始消息列表（用于欢迎消息等） */
  initialMessages?: Message[]
  /** 当前选中的站点ID（用于生成 filter） */
  selectedSiteId?: number | null
  /** 消息发送完成后的回调 */
  onMessageSent?: () => void
}

interface UseAIChatReturn {
  /** 消息列表 */
  messages: Message[]
  /** 是否正在加载 */
  isLoading: boolean
  /** 发送消息 */
  sendMessage: (content: string) => Promise<void>
  /** 重置消息（同时重置 thread_id） */
  resetMessages: () => void
  /** 当前会话ID */
  threadId: string
  /** 直接设置消息列表 */
  setMessages: (messages: Message[]) => void
  /** 直接设置当前 thread_id */
  setThreadId: (id: string) => void
  /** 加载特定会话的消息历史 */
  loadSessionMessages: (threadId: string) => Promise<void>
}

/**
 * 生成唯一的 thread_id
 */
function generateThreadId(): string {
  return `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export function useAIChat(options: UseAIChatOptions = {}): UseAIChatReturn {
  const {
    initialMessages = [],
    selectedSiteId = null,
  } = options

  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const [threadId, setThreadId] = useState<string>(generateThreadId)
  const abortControllerRef = useRef<AbortController | null>(null)

  // 引用初始消息，用于重置
  const initialMessagesRef = useRef<Message[]>(initialMessages)

  const onMessageSent = options.onMessageSent

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return

    setIsLoading(true)

    // 1. 添加用户消息
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: content.trim(),
    }

    // 2. 预先添加一个空的 AI 消息占位符
    const assistantMsgId = (Date.now() + 1).toString()
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
    }

    setMessages(prev => [...prev, userMsg, assistantMsg])

    // 3. 准备请求（持久化模式）
    abortControllerRef.current = new AbortController()

    // 构建请求体 - 只传 thread_id 和 message
    const requestBody: any = {
      thread_id: threadId,
      message: content.trim(),
      stream: true,
      user: getVisitorId(), // 增加 Visitor ID 以支持匿名会话记录
    }

    // 添加过滤器
    if (selectedSiteId) {
      requestBody.filter = {
        site_id: selectedSiteId
      }
    }

    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error("No response body")
      }

      // 4. 处理流式响应
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ""
      // 用于累积 tool_calls (因为可能分多个 chunk 发送)
      const accumulatedToolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        // 处理 SSE 格式数据 (data: {...})
        const lines = chunk.split("\n")

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (!trimmedLine.startsWith("data: ")) continue

          const dataStr = trimmedLine.slice(6)
          if (dataStr === "[DONE]") break

          try {
            const data = JSON.parse(dataStr)

            // 1. 处理 citations
            if (data.citations) {
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === assistantMsgId
                    ? { ...msg, sources: data.citations }
                    : msg
                )
              )
              continue
            }

            // 2. 处理 status 事件 (工具调用状态)
            if (data.status === "tool_calling") {
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === assistantMsgId
                    ? {
                      ...msg,
                      status: "tool_calling",
                      activeToolName: data.tool
                    }
                    : msg
                )
              )
              continue
            }

            // 3. 处理 tool_calls delta
            const toolCallsDeltas = data.choices?.[0]?.delta?.tool_calls
            if (toolCallsDeltas && Array.isArray(toolCallsDeltas)) {
              for (const tcDelta of toolCallsDeltas) {
                const index = tcDelta.index ?? 0
                const existing = accumulatedToolCalls.get(index) || { id: "", name: "", arguments: "" }

                // 累积 tool call 信息
                if (tcDelta.id) existing.id = tcDelta.id
                if (tcDelta.function?.name) existing.name = tcDelta.function.name
                if (tcDelta.function?.arguments) existing.arguments += tcDelta.function.arguments

                accumulatedToolCalls.set(index, existing)
              }

              // 更新消息的 toolCalls
              const toolCallsList = Array.from(accumulatedToolCalls.values()).map(tc => ({
                id: tc.id,
                type: "function" as const,
                function: {
                  name: tc.name,
                  arguments: tc.arguments
                },
                status: "running" as const
              }))

              setMessages(prev =>
                prev.map(msg =>
                  msg.id === assistantMsgId
                    ? { ...msg, toolCalls: toolCallsList, status: "tool_calling" }
                    : msg
                )
              )
              continue
            }

            // 4. 处理文本 content delta
            const deltaContent = data.choices?.[0]?.delta?.content || ""

            if (deltaContent) {
              accumulatedContent += deltaContent

              // 如果有 tool calls，标记为已完成
              const updatedToolCalls = accumulatedToolCalls.size > 0
                ? Array.from(accumulatedToolCalls.values()).map(tc => ({
                  id: tc.id,
                  type: "function" as const,
                  function: {
                    name: tc.name,
                    arguments: tc.arguments
                  },
                  status: "completed" as const
                }))
                : undefined

              // 实时更新 AI 消息内容
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === assistantMsgId
                    ? {
                      ...msg,
                      content: accumulatedContent,
                      status: "streaming",
                      toolCalls: updatedToolCalls || msg.toolCalls,
                      activeToolName: undefined
                    }
                    : msg
                )
              )
            }
          } catch (e) {
            console.error("Error parsing stream chunk", e)
          }
        }
      }

      // 流结束后，清除状态
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMsgId
            ? { ...msg, status: undefined, activeToolName: undefined }
            : msg
        )
      )

    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Chat aborted")
      } else {
        console.error("Chat error:", error)
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMsgId
              ? { ...msg, content: msg.content + "\n\n[发生错误，请重试]" }
              : msg
          )
        )
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
      onMessageSent?.()
    }
  }, [threadId, isLoading, selectedSiteId, onMessageSent])

  const resetMessages = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setMessages(initialMessagesRef.current)
    setThreadId(generateThreadId()) // 重置时生成新的 thread_id
    setIsLoading(false)
  }, [])

  const loadSessionMessages = useCallback(async (targetThreadId: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    setIsLoading(true)
    try {
      const { messages: historyMessages } = await api.chatSession.getMessages(targetThreadId)

      // 转换后端消息格式到前端格式
      const formattedMessages: Message[] = historyMessages.map((m: any, idx) => ({
        id: m.id || `${targetThreadId}-${idx}`,
        role: m.role as "user" | "assistant",
        content: m.content,
      }))

      setMessages(formattedMessages)
      setThreadId(targetThreadId)
    } catch (error) {
      console.error("Failed to load session messages:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    messages,
    isLoading,
    sendMessage,
    resetMessages,
    threadId,
    setMessages,
    setThreadId,
    loadSessionMessages,
  }
}
