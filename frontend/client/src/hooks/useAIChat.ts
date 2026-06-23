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
import { createStreamReducer, parseSSEStream } from "@/lib/ai-stream"
import { getVisitorId } from "@/lib/visitor"
import { getAuthHeaders } from "@/lib/auth-headers"
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

// 本地占位 thread_id 前缀：服务端真实 response_id 不带此前缀。
const LOCAL_THREAD_PREFIX = "thread-"

function generateThreadId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${LOCAL_THREAD_PREFIX}${crypto.randomUUID()}`
  }
  return `${LOCAL_THREAD_PREFIX}${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/** 是否为本地生成的占位 thread_id（尚未拿到服务端 response_id）。 */
function isLocalThreadId(id: string): boolean {
  return id.startsWith(LOCAL_THREAD_PREFIX)
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
      ...(!isLocalThreadId(threadId) ? { previous_response_id: threadId } : {}),
    }

    // 添加过滤器 (携带 site_id 和 tenant_id 实现双重校验隔离)
    if (selectedSiteId || selectedTenantId) {
      requestBody.filter = {
        site_id: selectedSiteId,
        tenant_id: selectedTenantId
      }
    }

    try {
      const headers = getAuthHeaders(tenantSlug, siteSlug)

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

      // 4. 处理流式响应：parseSSEStream 负责传输/解析，reducer 负责把事件归约为消息更新
      const reader = response.body.getReader()
      const reduce = createStreamReducer()

      for await (const event of parseSSEStream(reader, e => logError("useAIChat:parseStreamChunk", e))) {
        // 单事件归约/更新失败时记录并继续，不中断整条流（与重构前的 per-line try/catch 一致）
        try {
          const { threadId: newThreadId, update } = reduce(event)
          // response.created：用服务端生成的 response_id 替换本地占位 thread_id
          if (newThreadId) setThreadId(newThreadId)
          if (update) updateAssistant(update)
        } catch (e) {
          logError("useAIChat:parseStreamChunk", e)
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
      const headers = getAuthHeaders(tenantSlug, siteSlug)
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
