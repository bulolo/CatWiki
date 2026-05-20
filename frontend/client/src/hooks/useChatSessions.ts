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

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { clearAllChatSessions, deleteChatSession, listChatSessions } from '@/lib/sdk/client-chat-sessions'
import type { ChatSessionResponse } from '@/lib/sdk/sdk.schemas'
import { getVisitorId } from '@/lib/visitor'

interface UseChatSessionsOptions {
  siteId?: number | null
  tenantId?: number | null
}

export function useChatSessions(options: UseChatSessionsOptions = {}) {
  const { siteId } = options
  const [sessions, setSessions] = useState<ChatSessionResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')

  // 用 ref 存当前 keyword，避免它进入 useCallback 依赖导致 useEffect 重复触发
  const keywordRef = useRef(keyword)
  useEffect(() => {
    keywordRef.current = keyword
  }, [keyword])

  const fetchSessions = useCallback(
    async (pageNum = 1, append = false, searchKeyword?: string) => {
      const currentKeyword = searchKeyword !== undefined ? searchKeyword : keywordRef.current
      setIsLoading(true)
      try {
        const response = await listChatSessions({
          site_id: siteId || undefined,
          member_id: getVisitorId(),
          keyword: currentKeyword || undefined,
          page: pageNum,
          size: currentKeyword ? 20 : 5,
        })
        const list = response?.list ?? []
        if (append) {
          setSessions((prev) => [...prev, ...list])
        } else {
          setSessions(list)
        }
        setTotal(response?.total ?? 0)
        setPage(pageNum)
      } catch (error) {
        console.error('Failed to fetch chat sessions:', error)
      } finally {
        setIsLoading(false)
      }
    },
    [siteId],
  )

  const searchSessions = useCallback(
    async (searchKeyword: string) => {
      setKeyword(searchKeyword)
      await fetchSessions(1, false, searchKeyword)
    },
    [fetchSessions],
  )

  const deleteSession = useCallback(
    async (threadId: string) => {
      try {
        await deleteChatSession(threadId, {
          member_id: getVisitorId(),
          site_id: siteId ?? undefined,
        })
        setSessions((prev) => prev.filter((s) => s.thread_id !== threadId))
        setTotal((prev) => prev - 1)
      } catch (error) {
        console.error('Failed to delete chat session:', error)
        throw error
      }
    },
    [siteId],
  )

  const clearAllSessions = useCallback(async () => {
    try {
      await clearAllChatSessions({
        member_id: getVisitorId(),
        site_id: siteId ?? undefined,
      })
      setSessions([])
      setTotal(0)
      setPage(1)
    } catch (error) {
      console.error('Failed to clear all chat sessions:', error)
      throw error
    }
  }, [siteId])

  useEffect(() => {
    fetchSessions(1, false)
  }, [fetchSessions])

  return {
    sessions,
    isLoading,
    total,
    page,
    keyword,
    fetchSessions,
    searchSessions,
    deleteSession,
    clearAllSessions,
    refresh: useCallback(
      () => fetchSessions(1, false, keyword),
      [fetchSessions, keyword],
    ),
  }
}
