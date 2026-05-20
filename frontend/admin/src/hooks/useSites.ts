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
 * React Query hooks for Wiki Sites management.
 *
 * 调用 orval 生成的 functions / hooks。
 * queryKey 由 orval helper 自动生成（``getListAdminSitesQueryKey()`` 等），
 * 替换原手写 ``siteKeys.list(filters)``，避免与 invalidation 漂移。
 */

import { useQueryClient } from '@tanstack/react-query'
import { createAdminSite, deleteAdminSite, getAdminSiteBySlug, getGetAdminSiteBySlugQueryKey, getListAdminSitesQueryKey, updateAdminSite, useGetAdminSite, useGetAdminSiteBySlug, useListAdminSites } from '@/lib/sdk/admin-sites'
import type { SiteCreate, SiteUpdate } from '@/lib/sdk/sdk.schemas'
import { isAuthenticated } from '@/lib/auth'
import { useAdminMutation } from './useAdminMutation'

/**
 * 获取站点列表（按 list 字段解开分页对象）
 */
export function useSitesList(params: { page?: number; size?: number; status?: string } = {}) {
  const { page = 1, size = 100, status } = params
  return useListAdminSites(
    { page, size, status },
    {
      query: {
        enabled: isAuthenticated(),
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        select: (data) => data?.list ?? [],
      },
    },
  )
}

/**
 * 通过 slug 获取站点详情
 */
export function useSiteBySlug(slug: string | undefined) {
  return useGetAdminSiteBySlug(slug ?? '', {
    query: {
      enabled: !!slug && isAuthenticated(),
      staleTime: 5 * 60 * 1000,
      retry: 2,
    },
  })
}

/**
 * 通过 ID 获取站点详情
 */
export function useSiteById(id: number | undefined) {
  return useGetAdminSite(id ?? 0, {
    query: {
      enabled: !!id && isAuthenticated(),
      staleTime: 5 * 60 * 1000,
    },
  })
}

/**
 * 创建站点
 */
export function useCreateSite() {
  return useAdminMutation({
    mutationFn: (data: SiteCreate) => createAdminSite(data),
    invalidateKeys: [getListAdminSitesQueryKey()],
  })
}

/**
 * 更新站点
 */
export function useUpdateSite() {
  return useAdminMutation({
    mutationFn: ({ siteId, data }: { siteId: number; data: SiteUpdate }) =>
      updateAdminSite(siteId, data),
    invalidateKeys: [['/admin/v1/sites']],
  })
}

/**
 * 删除站点
 */
export function useDeleteSite() {
  return useAdminMutation({
    mutationFn: (id: number) => deleteAdminSite(id),
    invalidateKeys: [getListAdminSitesQueryKey()],
  })
}

/**
 * 预加载站点数据
 */
export function usePrefetchSite(slug: string) {
  const queryClient = useQueryClient()

  return () => {
    queryClient.prefetchQuery({
      queryKey: getGetAdminSiteBySlugQueryKey(slug),
      queryFn: () => getAdminSiteBySlug(slug).catch(() => null),
      staleTime: 5 * 60 * 1000,
    })
  }
}
