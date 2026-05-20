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
 * 获取文档详情的 Hook。直接复用 orval 生成的 useGetClientDocument，
 * 通过 ``select`` 把后端 Document 形态转换成前端业务用的 DocumentDetail。
 */

'use client'

import { useGetClientDocument } from '@/lib/sdk/client-documents'
import type { DocumentDetail } from '@/types'

/**
 * 获取文档详情
 */
export function useDocument(documentId: string | null) {
  const id = documentId ? parseInt(documentId) : 0
  return useGetClientDocument(id, {
    query: {
      enabled: !!documentId,
      staleTime: 10 * 60 * 1000, // 10 分钟
      gcTime: 30 * 60 * 1000, // 30 分钟
      select: (doc): DocumentDetail | undefined => {
        if (!doc) return undefined
        return {
          id: doc.id.toString(),
          title: doc.title,
          content: doc.content || undefined,
          summary: doc.summary || undefined,
          views: doc.views,
          readingTime: doc.reading_time,
          tags: doc.tags || [],
        }
      },
    },
  })
}
