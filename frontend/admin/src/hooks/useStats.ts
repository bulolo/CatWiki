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


