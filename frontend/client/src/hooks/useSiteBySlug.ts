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
 * 通过 slug 获取站点信息的 Hook
 * 使用 React Query 进行数据缓存
 */

"use client"

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/react-query'
import { logError } from '@/lib/error-handler'

export function useSiteBySlug(slug: string) {
  return useQuery({
    queryKey: queryKeys.sites.bySlug(slug),
    queryFn: async () => {
      try {
        return await api.site.getBySlug(slug)

      } catch (error) {
        logError('加载站点', error)
        throw error
      }
    },
    enabled: !!slug,
    // 站点信息很少变化，可以缓存更长时间
    staleTime: 10 * 60 * 1000, // 10 分钟
    gcTime: 30 * 60 * 1000, // 30 分钟
  })
}

