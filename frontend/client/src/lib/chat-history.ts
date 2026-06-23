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

import { z } from "zod"
import type { ChatMessageOutput } from "@/lib/sdk/sdk.schemas"
import type { Message } from "@/types"
import { toTimings, type RawTrace } from "@/components/ai/format"

// ==================== 后端历史消息的「松散字段」校验 ====================
// 这些字段在 SDK 里是宽松/未类型化的 JSON 边界。用 zod 安全解析替代散落的 `as` 强转：
// 解析失败时回退到安全默认（不抛错、不污染前端类型），坏数据被丢弃而非以错误类型流入。

const traceSchema = z.object({
  ttfb: z.number().optional(),
  first_token: z.number().optional(),
  total: z.number().optional(),
})

const additionalKwargsSchema = z.object({
  usage_metadata: z.object({ total_tokens: z.number().optional() }).optional(),
  trace: traceSchema.optional(),
})

const toolCallSchema = z.object({
  id: z.string(),
  function: z.object({ name: z.string().optional(), arguments: z.unknown().optional() }).optional(),
  name: z.string().optional(),
  elapsed_ms: z.number().optional(),
})

const sourceSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  title: z.string().optional(),
  siteId: z.number().optional(),
  documentId: z.number().optional(),
})

type ParsedToolCall = z.infer<typeof toolCallSchema>

/** 解析 assistant.additional_kwargs（usage / trace）；非法输入回退为空对象。 */
function parseAdditionalKwargs(value: unknown): z.infer<typeof additionalKwargsSchema> {
  return additionalKwargsSchema.safeParse(value).data ?? {}
}

/** 逐元素解析 tool_calls，丢弃不合法项；非数组回退为空。 */
function parseToolCalls(value: unknown): ParsedToolCall[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    const parsed = toolCallSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}

/** 逐元素解析 sources，丢弃不合法项；非数组回退为空。 */
function parseSources(value: unknown): z.infer<typeof sourceSchema>[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    const parsed = sourceSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}

// 每个 ReAct turn 里跨多条 assistant 行累积的中间状态
interface TurnState {
  toolCalls: ParsedToolCall[]
  content: string[]
  totalTokens: number
  hasUsage: boolean
  trace: RawTrace | null
}

const EMPTY_TURN: TurnState = {
  toolCalls: [],
  content: [],
  totalTokens: 0,
  hasUsage: false,
  trace: null,
}

// reduce 的累加器
interface Acc {
  result: Message[]
  assistantSeq: number
  turn: TurnState
}

/**
 * 把后端返回的历史消息序列转换为前端 Message[] 格式。
 *
 * 后端序列通常为：user → assistant(tool_calls) → tool → assistant(content)
 * 前端只需一条 assistant 消息，tool_calls 信息合并到最终回复消息上。
 */
export function formatHistoryMessages(
  threadId: string,
  historyMessages: ChatMessageOutput[]
): Message[] {
  // 先收集所有 tool 结果（role=tool）到 map，后续合并
  const toolResultMap = new Map<string, string>()
  for (const msg of historyMessages) {
    if (msg.role === "tool" && msg.tool_call_id && msg.content) {
      toolResultMap.set(msg.tool_call_id, msg.content)
    }
  }

  const { result } = historyMessages.reduce<Acc>(
    (acc, m, i) => {
      if (m.role === "tool") return acc // 已收集到 toolResultMap

      if (m.role === "user") {
        // 异常 turn（中断 / 没生成 final assistant）后状态可能滞留，下一条 user
        // 进来时主动重置，避免上一轮的 tool_calls / usage / trace 泄漏到这一轮
        return {
          ...acc,
          turn: { ...EMPTY_TURN },
          result: [
            ...acc.result,
            {
              id: m.id || `${threadId}-${i}`,
              role: "user" as const,
              content: m.content || "",
            },
          ],
        }
      }

      if (m.role === "assistant") {
        const ak = parseAdditionalKwargs(m.additional_kwargs)
        const addedTokens = ak.usage_metadata?.total_tokens ?? 0
        const trace = ak.trace ?? acc.turn.trace

        const toolCallsArr = parseToolCalls(m.tool_calls)

        // 中间 assistant 行（只有 tool_calls，无 final content）：合并后继续
        if (toolCallsArr.length) {
          return {
            ...acc,
            turn: {
              toolCalls: [...acc.turn.toolCalls, ...toolCallsArr],
              content: m.content?.trim() ? [...acc.turn.content, m.content] : acc.turn.content,
              totalTokens: acc.turn.totalTokens + addedTokens,
              hasUsage: acc.turn.hasUsage || addedTokens > 0,
              trace,
            },
          }
        }

        // Final assistant 行：发射合并后的消息，重置 turn 状态
        const mappedSources = parseSources(m.sources).map(s => ({
          id: String(s.id ?? ""),
          title: s.title ?? "",
          siteId: s.siteId,
          documentId: s.documentId,
        }))

        const finalContent = [...acc.turn.content, m.content || ""].filter(Boolean).join("\n\n")
        const totalTokens = acc.turn.totalTokens + addedTokens
        const hasUsage = acc.turn.hasUsage || addedTokens > 0
        const timings = toTimings(trace)

        const assistantMsg: Message = {
          id: m.id || `${threadId}-${i}`,
          role: "assistant" as const,
          content: finalContent,
          messageSeq: acc.assistantSeq,
          ...(acc.turn.toolCalls.length > 0
            ? {
                toolCalls: acc.turn.toolCalls.map(tc => ({
                  id: tc.id,
                  type: "function" as const,
                  function: {
                    name: tc.function?.name || tc.name || "unknown",
                    arguments:
                      typeof tc.function?.arguments === "string"
                        ? tc.function.arguments
                        : JSON.stringify(tc.function?.arguments || "{}"),
                  },
                  status: "completed" as const,
                  result: toolResultMap.get(tc.id),
                  ...(typeof tc.elapsed_ms === "number" ? { elapsedMs: tc.elapsed_ms } : {}),
                })),
              }
            : {}),
          ...(mappedSources.length > 0 ? { sources: mappedSources } : {}),
          ...(timings ? { timings } : {}),
          ...(hasUsage ? { usage: { totalTokens } } : {}),
        }

        return {
          result: [...acc.result, assistantMsg],
          assistantSeq: acc.assistantSeq + 1,
          turn: { ...EMPTY_TURN },
        }
      }

      return acc
    },
    { result: [], assistantSeq: 0, turn: { ...EMPTY_TURN } },
  )

  return result
}
