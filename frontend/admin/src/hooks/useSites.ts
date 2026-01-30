/**
 * React Query hooks for Wiki Sites management
 * 
 * 替代原有的 SiteContext 手动缓存逻辑
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { Site, SiteCreate, SiteUpdate } from '@/lib/api-client'
import { isAuthenticated } from '@/lib/auth'
import { useAdminMutation } from './useAdminMutation'

// ==================== Query Keys ====================

export const siteKeys = {
  all: ['sites'] as const,
  lists: () => [...siteKeys.all, 'list'] as const,
  list: (filters?: any) => [...siteKeys.lists(), filters] as const,
  details: () => [...siteKeys.all, 'detail'] as const,
  detail: (id: number) => [...siteKeys.details(), id] as const,
  byDomain: (domain: string) => [...siteKeys.all, 'domain', domain] as const,
}

// ==================== Hooks ====================

/**
 * 获取站点列表
 * 替代 SiteContext 中的站点列表管理
 */
export function useSitesList(params: { page?: number; size?: number; status?: string } = {}) {
  const { page = 1, size = 100, status } = params
  const isAuth = isAuthenticated()

  return useQuery({
    queryKey: siteKeys.list({ page, size, status }),
    queryFn: () => api.site.list({ page, size, status }).then((res: any) => res.list || []),

    enabled: isAuth,
    staleTime: 10 * 60 * 1000, // 10分钟 - 站点列表变化不频繁
    gcTime: 30 * 60 * 1000, // 30分钟
  })
}

/**
 * 通过 domain 获取站点详情
 * 替代 SiteContext 中的 getSite 方法
 */
export function useSiteByDomain(domain: string | undefined) {
  const isAuth = isAuthenticated()

  return useQuery({
    queryKey: siteKeys.byDomain(domain!),
    queryFn: () => api.site.getByDomain(domain!),
    enabled: !!domain && isAuth,
    staleTime: 5 * 60 * 1000, // 5分钟
    retry: 2, // 失败重试2次
  })
}

/**
 * 通过 ID 获取站点详情
 */
export function useSiteById(id: number | undefined) {
  const isAuth = isAuthenticated()

  return useQuery({
    queryKey: siteKeys.detail(id!),
    queryFn: () => api.site.get(id!),
    enabled: !!id && isAuth,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 创建站点
 */
export function useCreateSite() {
  return useAdminMutation({
    mutationFn: (data: SiteCreate) => api.site.create(data),
    invalidateKeys: [siteKeys.lists()],
    successMsg: '站点创建成功',
  })
}

/**
 * 更新站点
 */
export function useUpdateSite() {
  return useAdminMutation({
    mutationFn: ({ siteId, data }: { siteId: number; data: SiteUpdate }) =>
      api.site.update(siteId, data),
    invalidateKeys: [siteKeys.all],
    successMsg: '站点更新成功',
  })
}

/**
 * 删除站点
 */
export function useDeleteSite() {
  return useAdminMutation({
    mutationFn: (id: number) => api.site.delete(id),
    invalidateKeys: [siteKeys.lists()],
    successMsg: '站点删除成功',
  })
}

/**
 * 预加载站点数据
 */
export function usePrefetchSite(domain: string) {
  const queryClient = useQueryClient()

  return () => {
    queryClient.prefetchQuery({
      queryKey: siteKeys.byDomain(domain),
      queryFn: () => api.site.getByDomain(domain).catch(() => null),
      staleTime: 5 * 60 * 1000,
    })
  }
}
