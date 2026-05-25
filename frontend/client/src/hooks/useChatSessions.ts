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

import { useCallback, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { clearAllChatSessions, deleteChatSession, listChatSessions } from "@/lib/sdk/client-chat-sessions"
import { getVisitorId } from "@/lib/visitor"

interface UseChatSessionsOptions {
  siteId?: number | null
}

export const CHAT_SESSIONS_KEY = "chat-sessions" as const

export function useChatSessions(options: UseChatSessionsOptions = {}) {
  const { siteId } = options
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState("")
  const memberId = getVisitorId()

  const queryKey = [CHAT_SESSIONS_KEY, siteId ?? null, memberId, keyword] as const

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      listChatSessions({
        site_id: siteId || undefined,
        member_id: memberId,
        keyword: keyword || undefined,
        page: 1,
        size: keyword ? 20 : 5,
      }),
    // 列表数据本身较小，不长缓存以保证及时性
    staleTime: 30 * 1000,
  })

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: [CHAT_SESSIONS_KEY] }),
    [queryClient],
  )

  const deleteSession = useCallback(
    async (threadId: string) => {
      await deleteChatSession(threadId, {
        member_id: memberId,
        site_id: siteId ?? undefined,
      })
      await invalidate()
    },
    [siteId, memberId, invalidate],
  )

  const clearAllSessions = useCallback(async () => {
    await clearAllChatSessions({
      member_id: memberId,
      site_id: siteId ?? undefined,
    })
    await invalidate()
  }, [siteId, memberId, invalidate])

  return {
    sessions: data?.list ?? [],
    total: data?.total ?? 0,
    isLoading,
    keyword,
    searchSessions: setKeyword,
    deleteSession,
    clearAllSessions,
  }
}
