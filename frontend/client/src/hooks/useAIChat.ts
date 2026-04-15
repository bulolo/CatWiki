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

import { useState, useCallback, useRef } from "react"
import { env } from "@/lib/env"
import { api } from "@/lib/api-client"
import { useTranslations } from "next-intl"
import type { Message } from "@/types"
import { getVisitorId } from "@/lib/visitor"

interface UseAIChatOptions {
  /** 初始消息列表（用于欢迎消息等） */
  initialMessages?: Message[]
  /** 当前选中的站点ID（用于生成 filter） */
  selectedSiteId?: number | null
  /** 当前选中的租户ID（用于双重校验隔离） */
  selectedTenantId?: number | null
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
    selectedTenantId = null,
  } = options

  const t = useTranslations("Errors")
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

    // 构建标准 Responses API 请求体
    const requestBody: Record<string, unknown> = {
      input: content.trim(),
      stream: true,
      user: getVisitorId(),
      ...(threadId ? { previous_response_id: threadId } : {}),
    }

    // 添加过滤器 (携带 site_id 和 tenant_id 实现双重校验隔离)
    if (selectedSiteId || selectedTenantId) {
      requestBody.filter = {
        site_id: selectedSiteId,
        tenant_id: selectedTenantId
      }
    }

    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/v1/chat/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // X-Tenant-Slug 已通过 requestBody.filter 传递，此处移除 Header
        },
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
      // 累积当前轮次的 tool_call (因为可能分多个 chunk 发送)
      interface ToolCallAccumulator {
        id: string
        name: string
        arguments: string
      }
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
                      activeToolName: data.tool,
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

            // 4. 工具调用结束
            if (eventType === "response.tool_call.completed") {
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === assistantMsgId
                    ? { ...msg, activeToolName: undefined }
                    : msg
                )
              )
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
                      activeToolName: undefined
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

    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") {
        console.log("Chat aborted")
      } else {
        console.warn("Chat error:", error)
        const errorMessage = error instanceof Error ? error.message : t("unknownError")
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMsgId
              ? { ...msg, content: msg.content || `⚠️ ${errorMessage}` }
              : msg
          )
        )
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
      onMessageSent?.()
    }
  }, [threadId, isLoading, selectedSiteId, selectedTenantId, onMessageSent, t])

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
      // 需要将工具调用信息合并到最终的 AI 回复消息上
      // 消息序列通常是: user -> assistant(tool_calls) -> tool -> assistant(content)
      // 我们需要把 tool_calls 从第一个 assistant 消息移到最后一个 assistant 消息

      const formattedMessages: Message[] = []
      let pendingToolCalls: Array<{ id: string; function?: { name?: string; arguments?: unknown }; name?: string }> = [] // 暂存工具调用信息

      for (let i = 0; i < historyMessages.length; i++) {
        const m = historyMessages[i] as Record<string, unknown>

        // 跳过 tool 角色的消息（工具返回结果）
        if (m.role === "tool") {
          continue
        }

        // 处理 assistant 消息
        if (m.role === "assistant") {
          // 如果是 content 为空但有 tool_calls 的消息，暂存 tool_calls
          const toolCallsArr = m.tool_calls as Array<{ id: string; function?: { name?: string; arguments?: unknown }; name?: string }> | undefined
          if ((!m.content || m.content === "") && toolCallsArr?.length) {
            pendingToolCalls = [...pendingToolCalls, ...toolCallsArr]
            continue
          }

          // 提取消息自带的引用
          const backendSources = (m.sources || []) as Array<Record<string, unknown>>
          const mappedSources = backendSources.map((c) => ({
            id: String(c.id ?? ''),
            title: c.title as string,
            siteId: c.siteId as number | undefined,
            documentId: c.documentId as number | undefined,
          }))

          // 如果有实际内容，创建消息并附加之前暂存的 tool_calls 和 引用
          formattedMessages.push({
            id: (m.id as string) || `${targetThreadId}-${i}`,
            role: "assistant" as const,
            content: (m.content as string) || "",
            // 合并所有暂存的 tool_calls
            ...(pendingToolCalls.length > 0 ? {
              toolCalls: pendingToolCalls.map((tc) => ({
                id: tc.id,
                type: "function" as const,
                function: {
                  name: tc.function?.name || tc.name || "unknown",
                  arguments: typeof tc.function?.arguments === 'string'
                    ? tc.function.arguments
                    : JSON.stringify(tc.function?.arguments || "{}")
                },
                status: "completed" as const
              }))
            } : {}),
            // 附加该消息对应的引用来源
            ...(mappedSources.length > 0 ? { sources: mappedSources } : {}),
            additional_kwargs: m.additional_kwargs as Record<string, unknown> | undefined
          })
          // 清空暂存
          pendingToolCalls = []
          continue
        }

        // 处理 user 消息
        if (m.role === "user") {
          formattedMessages.push({
            id: (m.id as string) || `${targetThreadId}-${i}`,
            role: "user" as const,
            content: (m.content as string) || "",
          })
        }
      }

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
