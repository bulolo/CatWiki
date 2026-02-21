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
 * React Query hooks for Stats (统计数据)
 */

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { isAuthenticated } from '@/lib/auth'

// ==================== Query Keys ====================

export const statsKeys = {
  all: ['stats'] as const,
  siteStats: (siteId: number) => [...statsKeys.all, 'site', siteId] as const,
}

// ==================== Hooks ====================

/**
 * 获取站点统计数据
 */
export function useSiteStats(siteId: number | undefined) {
  const isAuth = isAuthenticated()

  return useQuery({
    queryKey: statsKeys.siteStats(siteId!),
    queryFn: () => api.stats.getSiteStats(siteId!),
    enabled: !!siteId && isAuth,
    staleTime: 5 * 60 * 1000,
  })
}


