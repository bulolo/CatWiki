/**
 * React Query hooks for Document management
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, VectorStatus } from '@/lib/api-client'
import type { Document } from '@/lib/api-client'
import { isAuthenticated } from '@/lib/auth'
import { useAdminMutation } from './useAdminMutation'

// ==================== Query Keys ====================

export const documentKeys = {
  all: ['documents'] as const,
  lists: () => [...documentKeys.all, 'list'] as const,
  list: (siteId: number, filters?: any) => [...documentKeys.lists(), siteId, filters] as const,
  details: () => [...documentKeys.all, 'detail'] as const,
  detail: (id: number) => [...documentKeys.details(), id] as const,
}

// ==================== Hooks ====================

interface UseDocumentsParams {
  siteId: number
  page?: number
  size?: number
  collectionId?: number | string
  searchTerm?: string
  status?: 'published' | 'draft' | 'all'
  vectorStatus?: 'none' | 'pending' | 'processing' | 'completed' | 'failed' | 'all'
  orderBy?: 'created_at' | 'updated_at' | 'views'
  orderDir?: 'asc' | 'desc'
}

/**
 * 获取文档列表
 * 当有文档处于 pending 或 processing 状态时，自动每 2 秒轮询一次
 */
export function useDocuments(params: UseDocumentsParams) {
  const { siteId, page = 1, size = 20, ...filters } = params
  const isAuth = isAuthenticated()

  return useQuery({
    queryKey: documentKeys.list(siteId, { page, size, ...filters }),
    queryFn: async () => {
      const apiParams: any = {
        siteId,
        page,
        size,
        orderBy: filters.orderBy,
        orderDir: filters.orderDir,
        keyword: filters.searchTerm,
        collectionId: filters.collectionId,
      }

      if (filters.status && filters.status !== 'all') apiParams.status = filters.status
      if (filters.vectorStatus && filters.vectorStatus !== 'all') apiParams.vectorStatus = filters.vectorStatus

      const data = await api.document.list(apiParams) as any
      return {
        documents: data.list || [],
        total: data.pagination?.total || 0,
      }
    },

    enabled: !!siteId && isAuth,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchInterval: (query) => {
      const data = query.state.data
      const hasProcessing = data?.documents?.some(
        (doc: Document) => doc.vector_status === VectorStatus.PENDING || doc.vector_status === VectorStatus.PROCESSING
      )
      return hasProcessing ? 2000 : false
    },
  })
}

/**
 * 获取单个文档详情
 */
export function useDocument(id: number | undefined) {
  const isAuth = isAuthenticated()

  return useQuery({
    queryKey: documentKeys.detail(id!),
    queryFn: () => api.document.get(id!),
    enabled: !!id && isAuth,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 创建文档
 */
export function useCreateDocument(siteId: number) {
  return useAdminMutation({
    mutationFn: (data: Partial<Document>) => api.document.create(data as any),
    invalidateKeys: [documentKeys.lists()],
    successMsg: '文档创建成功',
  })
}

/**
 * 更新文档
 */
export function useUpdateDocument() {
  return useAdminMutation({
    mutationFn: ({ documentId, data }: { documentId: number; data: Partial<Document> }) =>
      api.document.update(documentId, data),
    successMsg: '文档更新成功',
    onSuccess: (updatedDoc, variables, context, mutation) => {
      // 获取 queryClient 进行更细粒度的失效
      // 注意：useAdminMutation 内部已经处理了基础的 onSuccess 回调
    },
    // 手动指定需要失效的 key
    invalidateKeys: [documentKeys.all],
  })
}

/**
 * 批量删除文档
 */
export function useBatchDeleteDocuments(siteId: number) {
  return useAdminMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => api.document.delete(id)))
      return ids
    },
    successMsg: (ids: number[]) => `成功删除 ${ids.length} 个文档`,
    invalidateKeys: [documentKeys.lists()],
  })
}

/**
 * 删除文档（带乐观更新）
 */
export function useDeleteDocument(siteId: number) {

  const queryClient = useQueryClient()

  return useAdminMutation({
    mutationFn: (id: number) => api.document.delete(id),
    successMsg: '文档删除成功',
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: documentKeys.lists() })
      const previousData = queryClient.getQueriesData({ queryKey: documentKeys.lists() })

      queryClient.setQueriesData({ queryKey: documentKeys.lists() }, (old: any) => {
        if (!old) return old
        return {
          ...old,
          documents: old.documents?.filter((doc: Document) => doc.id !== deletedId) || [],
          total: (old.total || 0) - 1,
        }
      })
      return { previousData }
    },
    onError: (error, deletedId, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]: any) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    invalidateKeys: [documentKeys.lists()],
  })
}

/**
 * 批量发布/停用文档
 */
export function useBatchUpdateDocuments() {
  return useAdminMutation({
    mutationFn: async ({ documentIds, data }: { documentIds: number[]; data: Partial<Document> }) => {
      await Promise.all(documentIds.map(id => api.document.update(id, data)))
      return { documentIds, data }
    },
    successMsg: (res) => {
      if (res.data.status !== undefined) return `成功更新 ${res.documentIds.length} 个文档状态`
      if (res.data.collection_id !== undefined) return `成功移动 ${res.documentIds.length} 个文档`
      return `成功批量更新 ${res.documentIds.length} 个文档`
    },
    invalidateKeys: [documentKeys.lists()],
  })
}

// ==================== 向量化相关 Hooks ====================

/**
 * 向量化单个文档
 */
export function useVectorizeDocument() {
  return useAdminMutation({
    mutationFn: (documentId: number) => api.document.vectorizeSingle(documentId),
    successMsg: '已加入学习队列',
    invalidateKeys: [documentKeys.all],
  })
}

/**
 * 批量向量化文档
 */
export function useBatchVectorizeDocuments() {
  return useAdminMutation({
    mutationFn: (documentIds: number[]) => api.document.vectorize(documentIds),
    successMsg: (result: any) => `成功加入 ${result.success_count} 个文档到学习队列`,
    invalidateKeys: [documentKeys.lists()],

  })
}

/**
 * 移除文档向量
 */
export function useRemoveVector() {
  return useAdminMutation({
    mutationFn: (documentId: number) => api.document.removeVector(documentId),
    successMsg: '已移除向量数据',
    invalidateKeys: [documentKeys.all],
  })
}

// 导出 VectorStatus 枚举
export { VectorStatus }
