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
 * React Query hooks for Collection management
 */

import { useQueryClient } from "@tanstack/react-query"
import { createAdminCollection, deleteAdminCollection, getGetAdminCollectionTreeQueryKey, getListAdminCollectionsQueryKey, updateAdminCollection, useGetAdminCollection, useGetAdminCollectionTree, useListAdminCollections } from "@/lib/sdk/admin-collections"
import type { CollectionCreate, CollectionTree, CollectionUpdate } from "@/lib/sdk/sdk.schemas"
import { useIsAuthenticated } from "@/lib/auth-store"
import { useAdminMutation } from "./useAdminMutation"
import { STALE_TIME } from "@/lib/react-query"

/**
 * 获取目录树
 */
export function useCollectionTree(siteId: number, showDocuments: boolean = false) {
  const isAuthed = useIsAuthenticated()
  return useGetAdminCollectionTree(
    { site_id: siteId, type: showDocuments ? undefined : "collection" },
    {
      query: {
        enabled: !!siteId && isAuthed,
        staleTime: STALE_TIME.MEDIUM,
        select: (data) => data ?? [],
      },
    },
  )
}

/**
 * 获取目录列表
 */
export function useCollections(siteId: number, parentId?: number) {
  const isAuthed = useIsAuthenticated()
  return useListAdminCollections(
    { site_id: siteId, parent_id: parentId, is_pager: 0 },
    {
      query: {
        enabled: !!siteId && isAuthed,
        staleTime: STALE_TIME.MEDIUM,
        select: (data) => data?.list ?? [],
      },
    },
  )
}

/**
 * 获取单个目录详情
 */
export function useCollection(id: number | undefined) {
  const isAuthed = useIsAuthenticated()
  return useGetAdminCollection(id ?? 0, {
    query: {
      enabled: !!id && isAuthed,
      staleTime: STALE_TIME.MEDIUM,
    },
  })
}

/**
 * 创建目录
 */
export function useCreateCollection(siteId: number) {
  return useAdminMutation({
    mutationFn: (data: CollectionCreate) => createAdminCollection(data),
    invalidateKeys: [
      getGetAdminCollectionTreeQueryKey({ site_id: siteId }),
      getListAdminCollectionsQueryKey(),
    ],
  })
}

/**
 * 更新目录
 */
export function useUpdateCollection(_siteId: number) {
  return useAdminMutation({
    mutationFn: ({ id, data }: { id: number; data: CollectionUpdate }) =>
      updateAdminCollection(id, data),
    invalidateKeys: [["/admin/v1/collections"]],
  })
}

/**
 * 删除目录（带乐观更新）
 */
export function useDeleteCollection(siteId: number) {
  const queryClient = useQueryClient()

  return useAdminMutation({
    mutationFn: (id: number) => deleteAdminCollection(id),
    onMutate: async (deletedId) => {
      const treeKey = getGetAdminCollectionTreeQueryKey({ site_id: siteId })
      await queryClient.cancelQueries({ queryKey: treeKey })
      const previousData = queryClient.getQueryData<CollectionTree[]>(treeKey)

      queryClient.setQueryData<CollectionTree[]>(treeKey, (old) => {
        if (!old) return old
        const removeNode = (nodes: CollectionTree[]): CollectionTree[] =>
          nodes
            .filter((node) => node.id !== deletedId)
            .map((node) => ({
              ...node,
              children: node.children ? removeNode(node.children) : undefined,
            }))
        return removeNode(old)
      })
      return { previousData }
    },
    onError: (_error, _deletedId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          getGetAdminCollectionTreeQueryKey({ site_id: siteId }),
          context.previousData,
        )
      }
    },
    invalidateKeys: [["/admin/v1/collections"]],
  })
}

/**
 * 更新目录排序 (Mock，后端尚未实现)
 */
export function useUpdateCollectionSort(_siteId: number) {
  return useAdminMutation({
    mutationFn: async (_sortData: { id: number; sort_order: number }[]) => true,
    invalidateKeys: [["/admin/v1/collections"]],
  })
}
