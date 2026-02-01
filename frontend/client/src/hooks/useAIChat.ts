"use client"

import { useState, useCallback, useRef } from "react"
import { env } from "@/lib/env"
import type { Message, Source } from "@/types"

interface UseAIChatOptions {
  /** 初始消息列表（用于欢迎消息等） */
  initialMessages?: Message[]
  /** 当前选中的站点ID（用于生成 filter） */
  selectedSiteId?: number | null
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

            // Check for citations
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

            const deltaContent = data.choices?.[0]?.delta?.content || ""

            if (deltaContent) {
              accumulatedContent += deltaContent

              // 实时更新 AI 消息内容
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: accumulatedContent }
                    : msg
                )
              )
            }
          } catch (e) {
            console.error("Error parsing stream chunk", e)
          }
        }
      }

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
    }
  }, [threadId, isLoading, selectedSiteId])

  const resetMessages = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setMessages(initialMessagesRef.current)
    setThreadId(generateThreadId()) // 重置时生成新的 thread_id
    setIsLoading(false)
  }, [])

  return {
    messages,
    isLoading,
    sendMessage,
    resetMessages,
    threadId,
  }
}
