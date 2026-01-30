/**
 * 通过 domain 获取站点信息的 Hook
 * 使用 React Query 进行数据缓存
 */

"use client"

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/react-query'
import { logError } from '@/lib/error-handler'

export function useSiteByDomain(domain: string) {
  return useQuery({
    queryKey: queryKeys.sites.byDomain(domain),
    queryFn: async () => {
      try {
        return await api.site.getByDomain(domain)

      } catch (error) {
        logError('加载站点', error)
        throw error
      }
    },
    enabled: !!domain,
    // 站点信息很少变化，可以缓存更长时间
    staleTime: 10 * 60 * 1000, // 10 分钟
    gcTime: 30 * 60 * 1000, // 30 分钟
  })
}

