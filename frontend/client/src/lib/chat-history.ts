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

import type { ChatMessageOutput } from "@/lib/sdk/sdk.schemas"
import type { Message } from "@/types"
import { toTimings, type RawTrace } from "@/components/ai/format"

// 每个 ReAct turn 里跨多条 assistant 行累积的中间状态
interface TurnState {
  toolCalls: Array<{
    id: string
    function?: { name?: string; arguments?: unknown }
    name?: string
    elapsed_ms?: number
  }>
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
        const ak = (m.additional_kwargs ?? {}) as Record<string, unknown>
        const usageMeta = ak.usage_metadata as { total_tokens?: number } | undefined
        const addedTokens = typeof usageMeta?.total_tokens === "number" ? usageMeta.total_tokens : 0
        const trace = (ak.trace as RawTrace | undefined) ?? acc.turn.trace

        const toolCallsArr = m.tool_calls as Array<{
          id: string
          function?: { name?: string; arguments?: unknown }
          name?: string
          elapsed_ms?: number
        }> | undefined

        // 中间 assistant 行（只有 tool_calls，无 final content）：合并后继续
        if (toolCallsArr?.length) {
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
        const backendSources = (m.sources ?? []) as Array<{
          id?: unknown
          title?: unknown
          siteId?: unknown
          documentId?: unknown
        }>
        const mappedSources = backendSources.map(c => ({
          id: String(c.id ?? ""),
          title: c.title as string,
          siteId: c.siteId as number | undefined,
          documentId: c.documentId as number | undefined,
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
