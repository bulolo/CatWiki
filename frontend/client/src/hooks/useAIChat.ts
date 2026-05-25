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

import { useState, useCallback, useRef, useEffect, type Dispatch, type SetStateAction } from "react"
import { env } from "@/lib/env"
import { getChatSessionMessages } from "@/lib/sdk/client-chat-sessions"
import { useTranslations } from "next-intl"
import type { Message } from "@/types"
import { formatHistoryMessages } from "@/lib/chat-history"
import { getVisitorId } from "@/lib/visitor"
import { getSiteAccessToken } from "@/lib/site-access-token"
import { logError } from "@/lib/error-handler"

interface UseAIChatOptions {
  /** 初始消息列表（用于欢迎消息等） */
  initialMessages?: Message[]
  /** 当前选中的站点ID（用于生成 filter） */
  selectedSiteId?: number | null
  /** 当前选中的租户ID（用于双重校验隔离） */
  selectedTenantId?: number | null
  /** 当前路由租户标识（用于读取站点访问 token） */
  tenantSlug?: string | null
  /** 当前路由站点标识（用于读取站点访问 token） */
  siteSlug?: string | null
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
  setMessages: Dispatch<SetStateAction<Message[]>>
  /** 直接设置当前 thread_id */
  setThreadId: (id: string) => void
  /** 加载特定会话的消息历史 */
  loadSessionMessages: (threadId: string) => Promise<void>
}

interface ToolCallAccumulator {
  id: string
  name: string
  arguments: string
}

function generateThreadId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `thread-${crypto.randomUUID()}`
  }
  return `thread-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

export function useAIChat(options: UseAIChatOptions = {}): UseAIChatReturn {
  const {
    initialMessages = [],
    selectedSiteId = null,
    selectedTenantId = null,
    tenantSlug = null,
    siteSlug = null,
  } = options

  const t = useTranslations("Errors")
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const [threadId, setThreadId] = useState<string>(generateThreadId)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isLoadingRef = useRef(false)

  // 用 ref 追踪可能每渲染变化的值，避免 sendMessage useCallback 依赖不稳定引用
  const initialMessagesRef = useRef<Message[]>(initialMessages)
  const onMessageSentRef = useRef(options.onMessageSent)
  useEffect(() => { initialMessagesRef.current = initialMessages }, [initialMessages])
  useEffect(() => { onMessageSentRef.current = options.onMessageSent }, [options.onMessageSent])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoadingRef.current) return

    isLoadingRef.current = true
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

    // 构建标准 Responses API 请求体
    const requestBody: Record<string, unknown> = {
      input: content.trim(),
      stream: true,
      user: getVisitorId(),
      // 只有服务端返回的真实 response ID 才作为 previous_response_id，本地占位 ID 不传
      ...(!threadId.startsWith("thread-") ? { previous_response_id: threadId } : {}),
    }

    // 添加过滤器 (携带 site_id 和 tenant_id 实现双重校验隔离)
    if (selectedSiteId || selectedTenantId) {
      requestBody.filter = {
        site_id: selectedSiteId,
        tenant_id: selectedTenantId
      }
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      const token = getSiteAccessToken(tenantSlug, siteSlug)
      if (token) headers["X-Site-Access-Token"] = token

      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/v1/chat/responses`, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMsg = errorData?.msg || response.statusText
        throw new Error(errorMsg)
      }

      if (!response.body) {
        throw new Error("No response body")
      }

      // 4. 处理流式响应
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulatedContent = ""
      let currentToolCall: ToolCallAccumulator | null = null
      // 保存所有历史 tool calls（已完成的）
      const allCompletedToolCalls: Array<{ id: string; name: string; arguments: string }> = []

      let lineBuffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        lineBuffer += decoder.decode(value, { stream: true })
        const lines = lineBuffer.split("\n")
        lineBuffer = lines.pop() || ""

        for (const line of lines) {

          const trimmedLine = line.trim()
          if (!trimmedLine.startsWith("data: ")) continue

          const dataStr = trimmedLine.slice(6)
          if (dataStr === "[DONE]") break

          try {
            const data = JSON.parse(dataStr)
            const eventType: string = data.type

            // 0. response.created — 拿到服务端生成的 response_id 作为新 thread_id
            if (eventType === "response.created") {
              if (data.response?.id) setThreadId(data.response.id)
              continue
            }

            // 1. 知识库来源
            if (eventType === "response.knowledge_sources") {
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === assistantMsgId
                    ? { ...msg, sources: data.sources }
                    : msg
                )
              )
              continue
            }

            // 2. 工具调用开始
            if (eventType === "response.tool_call.started") {
              if (currentToolCall?.id) {
                const tc = currentToolCall as { id: string; name: string; arguments: string }
                allCompletedToolCalls.push({ id: tc.id, name: tc.name, arguments: tc.arguments })
              }
              currentToolCall = null

              const displayToolCalls = allCompletedToolCalls.map(tc => ({
                id: tc.id,
                type: "function" as const,
                function: { name: tc.name, arguments: tc.arguments },
                status: "completed" as const
              }))

              setMessages(prev =>
                prev.map(msg =>
                  msg.id === assistantMsgId
                    ? {
                      ...msg,
                      status: "tool_calling",
                      toolCalls: displayToolCalls.length > 0 ? displayToolCalls : undefined
                    }
                    : msg
                )
              )
              continue
            }

            // 3. 工具调用 delta（累积 id/name/arguments）
            if (eventType === "response.tool_call.delta") {
              const tc = data.tool_call || {}
              if (!currentToolCall) currentToolCall = { id: "", name: "", arguments: "" }
              if (tc.id) currentToolCall.id = tc.id
              if (tc.function?.name) currentToolCall.name = tc.function.name
              if (tc.function?.arguments) currentToolCall.arguments += tc.function.arguments

              const running = currentToolCall as { id: string; name: string; arguments: string }
              const displayToolCalls = [
                ...allCompletedToolCalls.map(t => ({
                  id: t.id, type: "function" as const,
                  function: { name: t.name, arguments: t.arguments },
                  status: "completed" as const
                })),
                { id: running.id, type: "function" as const,
                  function: { name: running.name, arguments: running.arguments },
                  status: "running" as const }
              ]
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === assistantMsgId
                    ? { ...msg, toolCalls: displayToolCalls, status: "tool_calling" }
                    : msg
                )
              )
              continue
            }

            // 4. 工具调用结束（无 UI 变更，仅作为流程标记）
            if (eventType === "response.tool_call.completed") {
              continue
            }

            // 5. 文本增量
            if (eventType === "response.output_text.delta") {
              const delta: string = data.delta || ""
              if (!delta) continue

              accumulatedContent += delta

              if (currentToolCall?.id) {
                const tc = currentToolCall as { id: string; name: string; arguments: string }
                allCompletedToolCalls.push({ id: tc.id, name: tc.name, arguments: tc.arguments })
                currentToolCall = null
              }

              const finalToolCalls = allCompletedToolCalls.length > 0
                ? allCompletedToolCalls.map(tc => ({
                  id: tc.id,
                  type: "function" as const,
                  function: { name: tc.name, arguments: tc.arguments },
                  status: "completed" as const
                }))
                : undefined

              setMessages(prev =>
                prev.map(msg =>
                  msg.id === assistantMsgId
                    ? {
                      ...msg,
                      content: accumulatedContent,
                      status: "streaming",
                      toolCalls: finalToolCalls,
                    }
                    : msg
                )
              )
              continue
            }

            // 6. 错误事件
            if (eventType === "response.error") {
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: msg.content || `⚠️ ${data.error}` }
                    : msg
                )
              )
            }
          } catch (e) {
            logError("useAIChat:parseStreamChunk", e)
          }
        }
      }

      // 流结束后，清除状态
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMsgId
            ? { ...msg, status: undefined }
            : msg
        )
      )

    } catch (error: unknown) {
      const isAbort = error instanceof DOMException && error.name === "AbortError"
      if (isAbort) return // 用户主动取消，沿用已有占位消息，不写错误提示
      logError("useAIChat:sendMessage", error)
      const errorMessage = error instanceof Error ? error.message : t("unknownError")
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMsgId
            ? { ...msg, content: msg.content || `⚠️ ${errorMessage}` }
            : msg
        )
      )
    } finally {
      isLoadingRef.current = false
      setIsLoading(false)
      abortControllerRef.current = null
      onMessageSentRef.current?.()
    }
  }, [threadId, selectedSiteId, selectedTenantId, tenantSlug, siteSlug, t])

  const resetMessages = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    isLoadingRef.current = false
    setMessages(initialMessagesRef.current)
    setThreadId(generateThreadId())
    setIsLoading(false)
  }, [])

  const loadSessionMessages = useCallback(async (targetThreadId: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    isLoadingRef.current = true
    setIsLoading(true)
    try {
      const session = await getChatSessionMessages(targetThreadId, {
        member_id: getVisitorId(),
        site_id: selectedSiteId ?? undefined,
      })
      const formattedMessages = formatHistoryMessages(targetThreadId, session?.messages ?? [])
      setMessages(formattedMessages)
      setThreadId(targetThreadId)
    } catch (error) {
      logError("useAIChat:loadSessionMessages", error)
    } finally {
      isLoadingRef.current = false
      setIsLoading(false)
    }
  }, [selectedSiteId])

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
