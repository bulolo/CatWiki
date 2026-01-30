/**
 * React Query hooks for Collection management
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { Collection, CollectionTree } from '@/lib/api-client'
import { isAuthenticated } from '@/lib/auth'
import { useAdminMutation } from './useAdminMutation'

// ==================== Query Keys ====================

export const collectionKeys = {
  all: ['collections'] as const,
  lists: () => [...collectionKeys.all, 'list'] as const,
  list: (siteId: number, parentId?: number) => [...collectionKeys.lists(), siteId, parentId] as const,
  trees: () => [...collectionKeys.all, 'tree'] as const,
  treeSite: (siteId: number) => [...collectionKeys.trees(), siteId] as const,
  tree: (siteId: number, showDocuments?: boolean) => {
    const base = collectionKeys.treeSite(siteId);
    return showDocuments !== undefined ? [...base, showDocuments] as const : base;
  },
  details: () => [...collectionKeys.all, 'detail'] as const,
  detail: (id: number) => [...collectionKeys.details(), id] as const,
}

// ==================== Hooks ====================

/**
 * 获取目录树
 */
export function useCollectionTree(siteId: number, showDocuments: boolean = false) {
  const isAuth = isAuthenticated()

  return useQuery<CollectionTree[]>({
    queryKey: collectionKeys.tree(siteId, showDocuments),
    queryFn: () => api.collection.getTree(siteId, showDocuments ? undefined : 'collection').then(res => res || []),

    enabled: !!siteId && isAuth,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 获取目录列表
 */
export function useCollections(siteId: number, parentId?: number) {
  const isAuth = isAuthenticated()

  return useQuery<Collection[]>({
    queryKey: collectionKeys.list(siteId, parentId),
    queryFn: () => api.collection.list({ siteId, parentId }).then(res => res || []),

    enabled: !!siteId && isAuth,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 获取单个目录详情
 */
export function useCollection(id: number | undefined) {
  const isAuth = isAuthenticated()

  return useQuery<Collection>({
    queryKey: collectionKeys.detail(id!),
    queryFn: () => api.collection.get(id!),

    enabled: !!id && isAuth,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 创建目录
 */
export function useCreateCollection(siteId: number) {
  return useAdminMutation({
    mutationFn: (data: Partial<Collection> & { title: string }) => api.collection.create(data as any),
    invalidateKeys: [collectionKeys.treeSite(siteId), collectionKeys.lists()],
    successMsg: '目录创建成功',
  })
}

/**
 * 更新目录
 */
export function useUpdateCollection(siteId: number) {
  return useAdminMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Collection> }) =>
      api.collection.update(id, data) as any,
    invalidateKeys: [collectionKeys.trees(), collectionKeys.lists(), collectionKeys.all],
    successMsg: (res: Collection, vars: { id: number; data: Partial<Collection> }) => {
      const isSort = 'order' in (vars.data || {}) || 'parent_id' in (vars.data || {})
      return isSort ? undefined : '合集更新成功'
    },

  })
}

/**
 * 删除目录（带乐观更新）
 */
export function useDeleteCollection(siteId: number) {
  const queryClient = useQueryClient()

  return useAdminMutation({
    mutationFn: (id: number) => api.collection.delete(id),
    successMsg: '目录删除成功',
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: collectionKeys.tree(siteId) })
      const previousData = queryClient.getQueryData(collectionKeys.tree(siteId, false))

      queryClient.setQueryData(collectionKeys.tree(siteId, false), (old: CollectionTree[] | undefined) => {
        if (!old) return old
        const removeNode = (nodes: CollectionTree[]): CollectionTree[] => {
          return nodes
            .filter(node => node.id !== deletedId)
            .map(node => ({
              ...node,
              children: node.children ? removeNode(node.children) : undefined
            }))
        }
        return removeNode(old)
      })
      return { previousData }
    },
    onError: (error, deletedId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(collectionKeys.tree(siteId, false), context.previousData)
      }
    },
    invalidateKeys: [collectionKeys.trees(), collectionKeys.lists()],
  })
}

/**
 * 更新目录排序 (Mock)
 */
export function useUpdateCollectionSort(siteId: number) {
  return useAdminMutation({
    mutationFn: async (sortData: { id: number; sort_order: number }[]) => true,
    invalidateKeys: [collectionKeys.trees(), collectionKeys.lists()],
    successMsg: '排序更新成功',
  })
}


