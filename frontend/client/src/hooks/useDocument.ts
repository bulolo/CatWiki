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
 * 获取文档详情的 Hook
 * 使用 React Query 进行数据缓存和优化
 */

"use client"

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/react-query'
import type { DocumentDetail } from '@/types'
import { logError } from '@/lib/error-handler'

/**
 * 获取文档详情
 */
export function useDocument(documentId: string | null) {
  // 使用 React Query 获取完整文档内容
  const query = useQuery<DocumentDetail>({
    queryKey: queryKeys.documents.detail(parseInt(documentId!)),
    queryFn: async () => {
      try {
        const doc = await api.document.get(parseInt(documentId!))

        return {
          id: doc.id.toString(),
          title: doc.title,
          content: doc.content || undefined,
          summary: doc.summary || undefined,
          views: doc.views,
          readingTime: doc.reading_time,
          tags: doc.tags || [],
        }

      } catch (error) {
        logError('加载文档详情', error)
        throw error
      }
    },
    // 只要有 documentId 就加载
    enabled: !!documentId,
    // 文档内容可以缓存较长时间
    staleTime: 10 * 60 * 1000, // 10 分钟
    gcTime: 30 * 60 * 1000, // 30 分钟
  })

  return query
}

