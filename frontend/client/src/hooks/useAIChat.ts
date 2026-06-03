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
import type { Message, ToolCall } from "@/types"
import { formatHistoryMessages } from "@/lib/chat-history"
import { toTimings } from "@/components/ai/format"
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
  /** 提交一条消息的 👍/👎 反馈；rating=null 撤销 */
  submitFeedback: (
    message: Message,
    rating: "up" | "down" | null,
    reason?: "incorrect" | "irrelevant" | "incomplete" | "slow" | null,
  ) => Promise<void>
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

/** 把一个累加好的 tool call 转成 ToolCall，保留 prev 上已经写入的扩展字段
 * （elapsedMs / chunkCount）—— 任何 rebuild 路径都用它，避免重复维护多份。 */
function buildCompletedTool(
  raw: ToolCallAccumulator,
  prevTools: ToolCall[] | undefined,
): ToolCall {
  const prev = prevTools?.find(t => t.id === raw.id)
  return {
    id: raw.id,
    type: "function",
    function: { name: raw.name, arguments: raw.arguments },
    status: "completed",
    ...(prev?.elapsedMs != null ? { elapsedMs: prev.elapsedMs } : {}),
    ...(prev?.chunkCount != null ? { chunkCount: prev.chunkCount } : {}),
  }
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
    // messageSeq = 本 thread 内已有的 assistant 消息条数（0-based），后端按这个
    // 序号定位 chat_messages.id；用 setMessages 函数式更新读最新 prev，避免
    // useCallback 闭包持有旧 messages
    setMessages(prev => {
      const assistantSeq = prev.filter(m => m.role === "assistant").length
      const assistantMsg: Message = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        messageSeq: assistantSeq,
      }
      return [...prev, userMsg, assistantMsg]
    })

    // 把"按 id 找到占位 assistant 消息并 patch"这个 setMessages 模式收成一个调用，
    // 所有事件处理段共用，避免 7-8 次重复 prev.map + 三元判断
    const updateAssistant = (updater: (msg: Message) => Message) =>
      setMessages(prev => prev.map(m => (m.id === assistantMsgId ? updater(m) : m)))

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
      let hasPipelineTrace = false
      let currentToolCall: ToolCallAccumulator | null = null
      // 保存所有历史 tool calls（已完成的）
      const allCompletedToolCalls: ToolCallAccumulator[] = []

      // 把当前累加完的 tool call 推入 completed 列表并清空累加器
      const flushCurrentTool = () => {
        if (currentToolCall?.id) {
          allCompletedToolCalls.push({ ...currentToolCall })
        }
        currentToolCall = null
      }

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
              updateAssistant(msg => ({ ...msg, sources: data.sources }))
              continue
            }

            // 2. 工具调用开始 —— 累加器里若已有完整 tool（id 齐），先 flush 入栈
            if (eventType === "response.tool_call.started") {
              flushCurrentTool()
              updateAssistant(msg => {
                const display = allCompletedToolCalls.map(tc =>
                  buildCompletedTool(tc, msg.toolCalls),
                )
                return {
                  ...msg,
                  status: "tool_calling",
                  toolCalls: display.length > 0 ? display : undefined,
                }
              })
              continue
            }

            // 3. 工具调用 delta（累积 id/name/arguments）
            if (eventType === "response.tool_call.delta") {
              const tc = data.tool_call || {}
              if (!currentToolCall) currentToolCall = { id: "", name: "", arguments: "" }
              if (tc.id) currentToolCall.id = tc.id
              if (tc.function?.name) currentToolCall.name = tc.function.name
              if (tc.function?.arguments) currentToolCall.arguments += tc.function.arguments

              const running = currentToolCall
              updateAssistant(msg => ({
                ...msg,
                status: "tool_calling",
                toolCalls: [
                  ...allCompletedToolCalls.map(t => buildCompletedTool(t, msg.toolCalls)),
                  {
                    id: running.id,
                    type: "function" as const,
                    function: { name: running.name, arguments: running.arguments },
                    status: "running" as const,
                  },
                ],
              }))
              continue
            }

            // 4. 工具调用结束 —— 后端可能带 elapsed_ms（trace 开启时）/ chunk_count /
            // tool_call_id。优先按 id 精确对位，缺失时退化为 allCompletedToolCalls 末尾
            // 匹配（兼容并行场景）；任意一个数据字段存在即更新
            if (eventType === "response.tool_call.completed") {
              const elapsedMs: number | undefined =
                typeof data.elapsed_ms === "number" ? data.elapsed_ms : undefined
              const chunkCount: number | undefined =
                typeof data.chunk_count === "number" ? data.chunk_count : undefined
              if (elapsedMs == null && chunkCount == null) continue

              const tcidFromEvent: string | undefined =
                typeof data.tool_call_id === "string" ? data.tool_call_id : undefined
              const idToUpdate =
                tcidFromEvent && allCompletedToolCalls.some(t => t.id === tcidFromEvent)
                  ? tcidFromEvent
                  : allCompletedToolCalls[allCompletedToolCalls.length - 1]?.id
              if (!idToUpdate) continue

              updateAssistant(msg => ({
                ...msg,
                toolCalls: msg.toolCalls?.map(t =>
                  t.id === idToUpdate
                    ? {
                        ...t,
                        ...(elapsedMs != null ? { elapsedMs } : {}),
                        ...(chunkCount != null ? { chunkCount } : {}),
                        status: "completed" as const,
                      }
                    : t,
                ),
              }))
              continue
            }

            // 4.5 站点开启 trace 时收到的管线 timing 卡片
            if (eventType === "response.pipeline_trace") {
              hasPipelineTrace = true
              const timings = toTimings(data.trace)
              if (timings) updateAssistant(msg => ({ ...msg, timings }))
              continue
            }

            // 4.6 流末尾的 response.completed —— 携带 usage（input/output/total tokens）
            // 仅在收到过 pipeline_trace 事件时渲染（即站点 show_pipeline_trace=true）
            if (eventType === "response.completed") {
              const usage = data.response?.usage
              if (hasPipelineTrace && usage && typeof usage.total_tokens === "number") {
                updateAssistant(msg => ({
                  ...msg,
                  usage: { totalTokens: usage.total_tokens },
                }))
              }
              continue
            }

            // 5. 文本增量
            if (eventType === "response.output_text.delta") {
              const delta: string = data.delta || ""
              if (!delta) continue

              accumulatedContent += delta
              flushCurrentTool()

              updateAssistant(msg => ({
                ...msg,
                content: accumulatedContent,
                status: "streaming",
                toolCalls:
                  allCompletedToolCalls.length > 0
                    ? allCompletedToolCalls.map(tc => buildCompletedTool(tc, msg.toolCalls))
                    : undefined,
              }))
              continue
            }

            // 6. 错误事件
            if (eventType === "response.error") {
              updateAssistant(msg => ({
                ...msg,
                content: msg.content || `⚠️ ${data.error}`,
              }))
            }
          } catch (e) {
            logError("useAIChat:parseStreamChunk", e)
          }
        }
      }

      // 流结束后只清除 streaming 状态；timings / usage / 工具 elapsedMs 已由
      // response.pipeline_trace / response.completed / response.tool_call.completed
      // 各自的事件处理段写入；站点未开启 trace 时它们会保持 undefined（前端自然不渲染）
      updateAssistant(msg => ({ ...msg, status: undefined }))

    } catch (error: unknown) {
      const isAbort = error instanceof DOMException && error.name === "AbortError"
      if (isAbort) return // 用户主动取消，沿用已有占位消息，不写错误提示
      logError("useAIChat:sendMessage", error)
      const errorMessage = error instanceof Error ? error.message : t("unknownError")
      updateAssistant(msg => ({
        ...msg,
        content: msg.content || `⚠️ ${errorMessage}`,
      }))
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

  const submitFeedback = useCallback(async (
    message: Message,
    rating: "up" | "down" | null,
    reason?: "incorrect" | "irrelevant" | "incomplete" | "slow" | null,
  ) => {
    if (message.messageSeq == null) return
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      const token = getSiteAccessToken(tenantSlug, siteSlug)
      if (token) headers["X-Site-Access-Token"] = token
      await fetch(`${env.NEXT_PUBLIC_API_URL}/v1/chat/feedback`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          thread_id: threadId,
          message_seq: message.messageSeq,
          member_id: getVisitorId(),
          rating,
          reason: rating === "down" ? (reason ?? null) : null,
        }),
      })
    } catch (e) {
      logError("useAIChat:submitFeedback", e)
    }
  }, [threadId, tenantSlug, siteSlug])

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
    submitFeedback,
  }
}
