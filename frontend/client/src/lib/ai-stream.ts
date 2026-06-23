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

/**
 * AI 对话流式响应处理。
 *
 * 把 useAIChat 里原本耦合在 sendMessage 里的「SSE 传输 + 8 分支事件状态机」拆成两个可单测单元：
 *   - parseSSEStream：纯传输 —— 逐行缓冲、剥离 `data: ` 前缀、`[DONE]` 终止、JSON.parse。
 *   - createStreamReducer：状态机 —— 持有单次流的累加状态（文本 / 工具调用），
 *     把每个事件归约为对 assistant 占位消息的增量更新（update）或新的 thread_id。
 */

import type { Message, Source, ToolCall } from "@/types"
import { toTimings, type RawTrace } from "@/components/ai/format"

/** Responses API 的 SSE 事件类型常量，集中维护，取代散落的字符串字面量比较。 */
export const SSE_EVENTS = {
  created: "response.created",
  knowledgeSources: "response.knowledge_sources",
  toolCallStarted: "response.tool_call.started",
  toolCallDelta: "response.tool_call.delta",
  toolCallCompleted: "response.tool_call.completed",
  pipelineTrace: "response.pipeline_trace",
  completed: "response.completed",
  outputTextDelta: "response.output_text.delta",
  error: "response.error",
} as const

/** 单个 SSE 事件 data 的形状（仅声明实际访问到的字段）。 */
export interface SSERawEvent {
  type: string
  response?: { id?: string; usage?: { total_tokens?: number } }
  sources?: Source[]
  tool_call?: { id?: string; function?: { name?: string; arguments?: string } }
  elapsed_ms?: number
  chunk_count?: number
  tool_call_id?: string
  trace?: RawTrace
  delta?: string
  error?: string
}

interface ToolCallAccumulator {
  id: string
  name: string
  arguments: string
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

/**
 * 解析 SSE 流，逐个 yield 已 JSON.parse 的事件对象。
 *
 * 负责行缓冲与协议细节；遇到 `[DONE]` 终止；单行 parse 失败通过 onParseError 上报但不中断流。
 */
export async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onParseError: (e: unknown) => void,
): AsyncGenerator<SSERawEvent> {
  const decoder = new TextDecoder()
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
      if (dataStr === "[DONE]") return

      try {
        yield JSON.parse(dataStr) as SSERawEvent
      } catch (e) {
        onParseError(e)
      }
    }
  }
}

/** 单个事件归约后的产物：更新占位 assistant 消息，和/或产生新的 thread_id。 */
export interface StreamEventResult {
  threadId?: string
  update?: (msg: Message) => Message
}

/**
 * 创建一个 SSE 事件归约器。
 *
 * 返回的 handle(event) 是「准纯函数」：给定内部累加状态与事件，确定性地产出 StreamEventResult。
 * 累加状态（文本 / 当前工具调用 / 已完成工具调用列表）刻意留在闭包内，因为它是单次流的本地状态，
 * 不属于 React state。每次新流都应 new 一个 reducer。
 */
export function createStreamReducer() {
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

  return function handle(data: SSERawEvent): StreamEventResult {
    switch (data.type) {
      // 0. response.created — 拿到服务端生成的 response_id 作为新 thread_id
      case SSE_EVENTS.created:
        return data.response?.id ? { threadId: data.response.id } : {}

      // 1. 知识库来源
      case SSE_EVENTS.knowledgeSources:
        return { update: msg => ({ ...msg, sources: data.sources }) }

      // 2. 工具调用开始 —— 累加器里若已有完整 tool（id 齐），先 flush 入栈
      case SSE_EVENTS.toolCallStarted: {
        flushCurrentTool()
        return {
          update: msg => {
            const display = allCompletedToolCalls.map(tc =>
              buildCompletedTool(tc, msg.toolCalls),
            )
            return {
              ...msg,
              status: "tool_calling",
              toolCalls: display.length > 0 ? display : undefined,
            }
          },
        }
      }

      // 3. 工具调用 delta（累积 id/name/arguments）
      case SSE_EVENTS.toolCallDelta: {
        const tc = data.tool_call || {}
        if (!currentToolCall) currentToolCall = { id: "", name: "", arguments: "" }
        if (tc.id) currentToolCall.id = tc.id
        if (tc.function?.name) currentToolCall.name = tc.function.name
        if (tc.function?.arguments) currentToolCall.arguments += tc.function.arguments

        const running = currentToolCall
        return {
          update: msg => ({
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
          }),
        }
      }

      // 4. 工具调用结束 —— 后端可能带 elapsed_ms（trace 开启时）/ chunk_count /
      // tool_call_id。优先按 id 精确对位，缺失时退化为 allCompletedToolCalls 末尾
      // 匹配（兼容并行场景）；任意一个数据字段存在即更新
      case SSE_EVENTS.toolCallCompleted: {
        const elapsedMs: number | undefined =
          typeof data.elapsed_ms === "number" ? data.elapsed_ms : undefined
        const chunkCount: number | undefined =
          typeof data.chunk_count === "number" ? data.chunk_count : undefined
        if (elapsedMs == null && chunkCount == null) return {}

        const tcidFromEvent: string | undefined =
          typeof data.tool_call_id === "string" ? data.tool_call_id : undefined
        const idToUpdate =
          tcidFromEvent && allCompletedToolCalls.some(t => t.id === tcidFromEvent)
            ? tcidFromEvent
            : allCompletedToolCalls[allCompletedToolCalls.length - 1]?.id
        if (!idToUpdate) return {}

        return {
          update: msg => ({
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
          }),
        }
      }

      // 4.5 站点开启 trace 时收到的管线 timing 卡片
      case SSE_EVENTS.pipelineTrace: {
        hasPipelineTrace = true
        const timings = toTimings(data.trace)
        return timings ? { update: msg => ({ ...msg, timings }) } : {}
      }

      // 4.6 流末尾的 response.completed —— 携带 usage（input/output/total tokens）
      // 仅在收到过 pipeline_trace 事件时渲染（即站点 show_pipeline_trace=true）
      case SSE_EVENTS.completed: {
        const usage = data.response?.usage
        if (hasPipelineTrace && usage && typeof usage.total_tokens === "number") {
          const totalTokens = usage.total_tokens
          return { update: msg => ({ ...msg, usage: { totalTokens } }) }
        }
        return {}
      }

      // 5. 文本增量
      case SSE_EVENTS.outputTextDelta: {
        const delta: string = data.delta || ""
        if (!delta) return {}

        accumulatedContent += delta
        flushCurrentTool()

        return {
          update: msg => ({
            ...msg,
            content: accumulatedContent,
            status: "streaming",
            toolCalls:
              allCompletedToolCalls.length > 0
                ? allCompletedToolCalls.map(tc => buildCompletedTool(tc, msg.toolCalls))
                : undefined,
          }),
        }
      }

      // 6. 错误事件
      case SSE_EVENTS.error:
        return { update: msg => ({ ...msg, content: msg.content || `⚠️ ${data.error}` }) }

      default:
        return {}
    }
  }
}
