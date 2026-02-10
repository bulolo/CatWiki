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
      // 累积当前轮次的 tool_call (因为可能分多个 chunk 发送)
      let currentToolCall: { id: string; name: string; arguments: string } | null = null
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

            // 2. 处理 status 事件 (工具调用状态) - 这表示一个新的 tool call 开始
            if (data.status === "tool_calling") {
              // 如果有正在进行的 tool call，将其标记为已完成并加入历史
              if (currentToolCall && currentToolCall.id) {
                allCompletedToolCalls.push({ ...currentToolCall })
              }
              // 重置当前 tool call
              currentToolCall = null

              // 构建完整的 toolCalls 列表用于展示
              const displayToolCalls = [
                // 已完成的历史 tool calls
                ...allCompletedToolCalls.map(tc => ({
                  id: tc.id,
                  type: "function" as const,
                  function: { name: tc.name, arguments: tc.arguments },
                  status: "completed" as const
                })),
              ]

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

            // 3. 处理 tool_calls delta
            const toolCallsDeltas = data.choices?.[0]?.delta?.tool_calls
            if (toolCallsDeltas && Array.isArray(toolCallsDeltas)) {
              for (const tcDelta of toolCallsDeltas) {
                // 初始化或更新当前 tool call
                if (!currentToolCall) {
                  currentToolCall = { id: "", name: "", arguments: "" }
                }

                if (tcDelta.id) currentToolCall.id = tcDelta.id
                if (tcDelta.function?.name) currentToolCall.name = tcDelta.function.name
                if (tcDelta.function?.arguments) currentToolCall.arguments += tcDelta.function.arguments
              }

              // 构建完整的 toolCalls 列表
              const displayToolCalls = [
                // 已完成的历史 tool calls
                ...allCompletedToolCalls.map(tc => ({
                  id: tc.id,
                  type: "function" as const,
                  function: { name: tc.name, arguments: tc.arguments },
                  status: "completed" as const
                })),
                // 当前正在进行的 tool call
                ...(currentToolCall ? [{
                  id: currentToolCall.id,
                  type: "function" as const,
                  function: { name: currentToolCall.name, arguments: currentToolCall.arguments },
                  status: "running" as const
                }] : [])
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

            // 4. 处理文本 content delta - 这表示所有 tool calls 已完成
            const deltaContent = data.choices?.[0]?.delta?.content || ""

            if (deltaContent) {
              accumulatedContent += deltaContent

              // 如果有当前进行中的 tool call，将其加入已完成列表
              if (currentToolCall && currentToolCall.id) {
                allCompletedToolCalls.push({ ...currentToolCall })
                currentToolCall = null
              }

              // 所有 tool calls 标记为已完成
              const finalToolCalls = allCompletedToolCalls.length > 0
                ? allCompletedToolCalls.map(tc => ({
                  id: tc.id,
                  type: "function" as const,
                  function: { name: tc.name, arguments: tc.arguments },
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
                      toolCalls: finalToolCalls,
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
      const { messages: historyMessages, citations } = await api.chatSession.getMessages(targetThreadId)

      // 转换后端消息格式到前端格式
      // 需要将工具调用信息合并到最终的 AI 回复消息上
      // 消息序列通常是: user -> assistant(tool_calls) -> tool -> assistant(content)
      // 我们需要把 tool_calls 从第一个 assistant 消息移到最后一个 assistant 消息

      const formattedMessages: Message[] = []
      let pendingToolCalls: any[] = [] // 暂存工具调用信息

      for (let i = 0; i < historyMessages.length; i++) {
        const m = historyMessages[i] as any

        // 跳过 tool 角色的消息（工具返回结果）
        if (m.role === "tool") {
          continue
        }

        // 处理 assistant 消息
        if (m.role === "assistant") {
          // 如果是 content 为空但有 tool_calls 的消息，暂存 tool_calls
          if ((!m.content || m.content === "") && m.tool_calls?.length) {
            pendingToolCalls = [...pendingToolCalls, ...m.tool_calls]
            continue
          }

          // 提取消息自带的引用
          const backendSources = m.sources || []
          const mappedSources = backendSources.map((c: any) => ({
            id: c.id?.toString(),
            title: c.title,
            siteId: c.siteId,
            documentId: c.documentId,
            score: c.score,
            sourceIndex: c.sourceIndex
          }))

          // 如果有实际内容，创建消息并附加之前暂存的 tool_calls 和 引用
          formattedMessages.push({
            id: m.id || `${targetThreadId}-${i}`,
            role: "assistant" as const,
            content: m.content || "",
            // 合并所有暂存的 tool_calls
            ...(pendingToolCalls.length > 0 ? {
              toolCalls: pendingToolCalls.map((tc: any) => ({
                id: tc.id,
                type: "function" as const,
                function: {
                  name: tc.function?.name || "unknown",
                  arguments: typeof tc.function?.arguments === 'string'
                    ? tc.function.arguments
                    : JSON.stringify(tc.function?.arguments || "{}")
                },
                status: "completed" as const
              }))
            } : {}),
            // 附加该消息对应的引用来源
            ...(mappedSources.length > 0 ? { sources: mappedSources } : {}),
            additional_kwargs: m.additional_kwargs
          })
          // 清空暂存
          pendingToolCalls = []
          continue
        }

        // 处理 user 消息
        if (m.role === "user") {
          formattedMessages.push({
            id: m.id || `${targetThreadId}-${i}`,
            role: "user" as const,
            content: m.content || "",
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
