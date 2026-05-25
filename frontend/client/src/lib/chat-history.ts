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

  const result: Message[] = []
  let pendingToolCalls: Array<{
    id: string
    function?: { name?: string; arguments?: unknown }
    name?: string
  }> = []
  let pendingContent: string[] = []

  for (let i = 0; i < historyMessages.length; i++) {
    const m = historyMessages[i]

    if (m.role === "tool") continue // 已收集到 toolResultMap

    if (m.role === "assistant") {
      const toolCallsArr = m.tool_calls as Array<{
        id: string
        function?: { name?: string; arguments?: unknown }
        name?: string
      }> | undefined

      if (toolCallsArr?.length) {
        pendingToolCalls = [...pendingToolCalls, ...toolCallsArr]
        if (m.content?.trim()) pendingContent.push(m.content)
        continue
      }

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

      const finalContent = [...pendingContent, m.content || ""].filter(Boolean).join("\n\n")

      result.push({
        id: m.id || `${threadId}-${i}`,
        role: "assistant" as const,
        content: finalContent,
        ...(pendingToolCalls.length > 0
          ? {
              toolCalls: pendingToolCalls.map(tc => ({
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
              })),
            }
          : {}),
        ...(mappedSources.length > 0 ? { sources: mappedSources } : {}),
      })

      pendingToolCalls = []
      pendingContent = []
      continue
    }

    if (m.role === "user") {
      result.push({
        id: m.id || `${threadId}-${i}`,
        role: "user" as const,
        content: m.content || "",
      })
    }
  }

  return result
}
