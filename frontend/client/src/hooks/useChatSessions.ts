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

import { useState, useCallback, useEffect, useRef } from "react"
import { api } from "@/lib/api-client"
import type { Models } from "@/lib/sdk"
import { getVisitorId } from "@/lib/visitor"

interface UseChatSessionsOptions {
  siteId?: number | null
}

export function useChatSessions(options: UseChatSessionsOptions = {}) {
  const { siteId } = options
  const [sessions, setSessions] = useState<Models.ChatSessionResponse[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState("")

  // 使用 ref 来存储当前的 keyword，避免将其作为 dependency 传入 useCallback
  // 这样 fetchSessions 不会因为 keyword 变化而重新生成，从而避免 useEffect 再次触发
  const keywordRef = useRef(keyword)

  // 同步 keyword 状态到 ref
  useEffect(() => {
    keywordRef.current = keyword
  }, [keyword])

  const fetchSessions = useCallback(async (pageNum = 1, append = false, searchKeyword?: string) => {
    if (!siteId) {
      // siteId 为空时清空数据
      setSessions([])
      setTotal(0)
      return
    }

    // 如果未传入 searchKeyword，则使用当前 ref 中的值
    const currentKeyword = searchKeyword !== undefined ? searchKeyword : keywordRef.current

    setIsLoading(true)
    try {
      const response = await api.chatSession.list({
        siteId,
        memberId: getVisitorId(),
        keyword: currentKeyword || undefined,
        page: pageNum,
        size: currentKeyword ? 20 : 5  // 搜索时返回更多结果
      })

      if (append) {
        setSessions(prev => [...prev, ...response.items])
      } else {
        setSessions(response.items)
      }
      setTotal(response.total)
      setPage(pageNum)
    } catch (error) {
      console.error("Failed to fetch chat sessions:", error)
    } finally {
      setIsLoading(false)
    }
  }, [siteId])

  const searchSessions = useCallback(async (searchKeyword: string) => {
    setKeyword(searchKeyword)
    // 搜索时重置为第一页，不要 append
    await fetchSessions(1, false, searchKeyword)
  }, [fetchSessions])

  const deleteSession = useCallback(async (threadId: string) => {
    try {
      await api.chatSession.delete(threadId)
      setSessions(prev => prev.filter(s => s.thread_id !== threadId))
      setTotal(prev => prev - 1)
    } catch (error) {
      console.error("Failed to delete chat session:", error)
      throw error
    }
  }, [])

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
    refresh: useCallback(() => fetchSessions(1, false, keyword), [fetchSessions, keyword])
  }
}
