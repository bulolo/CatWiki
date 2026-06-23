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
 * React Query hooks for Document management.
 *
 * 调用 orval 生成的 functions / hooks。queryKey 由 orval 自动算
 * （``getListAdminDocumentsQueryKey()``），不再手维护。
 */

import { useQueryClient } from "@tanstack/react-query"
import { aiGenerateDocumentFields, batchVectorizeAdminDocuments, createAdminDocument, deleteAdminDocument, getListAdminDocumentsQueryKey, removeAdminDocumentVector, updateAdminDocument, useGetAdminDocument, useListAdminDocuments, vectorizeAdminDocument } from "@/lib/sdk/admin-documents"
import { VectorStatus, type Document, type DocumentCreate, type DocumentUpdate, type ListAdminDocumentsParams } from "@/lib/sdk/sdk.schemas"
import { useIsAuthenticated } from "@/lib/auth-store"
import { useAdminMutation } from "./useAdminMutation"
import { STALE_TIME } from "@/lib/react-query"

interface UseDocumentsParams {
  siteId: number
  page?: number
  size?: number
  collectionId?: number | string
  searchTerm?: string
  status?: "published" | "draft" | "all"
  vectorStatus?: "none" | "outdated" | "pending" | "processing" | "completed" | "failed" | "all"
  orderBy?: "created_at" | "updated_at" | "views"
  orderDir?: "asc" | "desc"
}

/**
 * 获取文档列表（按 list / pagination.total 拆分返回）。
 * pending / processing 状态时自动 2s 轮询。
 */
export function useDocuments(params: UseDocumentsParams) {
  const { siteId, page = 1, size = 20, ...filters } = params
  const isAuthed = useIsAuthenticated()

  const apiParams: ListAdminDocumentsParams = {
    site_id: siteId,
    page,
    size,
    order_dir: filters.orderDir,
    keyword: filters.searchTerm,
  }
  if (filters.orderBy === "views" || filters.orderBy === "updated_at") {
    apiParams.order_by = filters.orderBy
  }
  if (filters.collectionId !== undefined && filters.collectionId !== null) {
    const parsedCollectionId = Number(filters.collectionId)
    if (!Number.isNaN(parsedCollectionId)) {
      apiParams.collection_id = parsedCollectionId
    }
  }
  if (filters.status && filters.status !== "all") apiParams.status = filters.status
  if (filters.vectorStatus && filters.vectorStatus !== "all") {
    apiParams.vector_status = filters.vectorStatus
  }

  return useListAdminDocuments(apiParams, {
    query: {
      enabled: !!siteId && isAuthed,
      staleTime: STALE_TIME.NONE,
      gcTime: 5 * 60 * 1000,
      select: (data) => ({
        documents: data?.list ?? [],
        total: data?.pagination?.total ?? 0,
      }),
      refetchInterval: (query) => {
        const raw = query.state.data as { list?: Document[] } | undefined
        const hasProcessing = raw?.list?.some(
          (doc) => doc.vector_status === "pending" || doc.vector_status === "processing",
        )
        return hasProcessing ? 2000 : false
      },
    },
  })
}

/**
 * 获取单个文档详情
 */
export function useDocument(id: number | undefined) {
  const isAuthed = useIsAuthenticated()
  return useGetAdminDocument(id ?? 0, {
    query: {
      enabled: !!id && isAuthed,
      staleTime: STALE_TIME.MEDIUM,
    },
  })
}

/**
 * 创建文档
 */
export function useCreateDocument(_siteId: number) {
  return useAdminMutation({
    mutationFn: (data: DocumentCreate) => createAdminDocument(data),
    invalidateKeys: [getListAdminDocumentsQueryKey()],
  })
}

/**
 * 更新文档
 */
export function useUpdateDocument() {
  return useAdminMutation({
    mutationFn: ({ documentId, data }: { documentId: number; data: DocumentUpdate }) =>
      updateAdminDocument(documentId, data),
    invalidateKeys: [["/admin/v1/documents"]],
  })
}

/**
 * 批量删除文档
 */
export function useBatchDeleteDocuments(_siteId: number) {
  return useAdminMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map((id) => deleteAdminDocument(id)))
      return ids
    },
    invalidateKeys: [getListAdminDocumentsQueryKey()],
  })
}

/**
 * 删除文档（带乐观更新）
 */
export function useDeleteDocument(_siteId: number) {
  const queryClient = useQueryClient()

  return useAdminMutation({
    mutationFn: (id: number) => deleteAdminDocument(id),
    onMutate: async (deletedId) => {
      const listKey = getListAdminDocumentsQueryKey()
      await queryClient.cancelQueries({ queryKey: listKey })
      const previousData = queryClient.getQueriesData({ queryKey: listKey })

      queryClient.setQueriesData(
        { queryKey: listKey },
        (old: { list?: Document[]; pagination?: { total?: number } } | undefined) => {
          if (!old) return old
          return {
            ...old,
            list: old.list?.filter((doc) => doc.id !== deletedId) ?? [],
            pagination: { ...old.pagination, total: (old.pagination?.total ?? 0) - 1 },
          }
        },
      )
      return { previousData }
    },
    onError: (_error, _deletedId, context) => {
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    invalidateKeys: [getListAdminDocumentsQueryKey()],
  })
}

/**
 * 批量发布/停用文档
 */
export function useBatchUpdateDocuments() {
  return useAdminMutation({
    mutationFn: async ({
      documentIds,
      data,
    }: {
      documentIds: number[]
      data: DocumentUpdate
    }) => {
      await Promise.all(documentIds.map((id) => updateAdminDocument(id, data)))
      return { documentIds, data }
    },
    invalidateKeys: [getListAdminDocumentsQueryKey()],
  })
}

// ==================== 向量化相关 Hooks ====================

export function useVectorizeDocument() {
  return useAdminMutation({
    mutationFn: (documentId: number) => vectorizeAdminDocument(documentId),
    invalidateKeys: [["/admin/v1/documents"]],
  })
}

export function useBatchVectorizeDocuments() {
  return useAdminMutation({
    mutationFn: (documentIds: number[]) =>
      batchVectorizeAdminDocuments({ document_ids: documentIds }),
    invalidateKeys: [getListAdminDocumentsQueryKey()],
  })
}

export function useRemoveVector() {
  return useAdminMutation({
    mutationFn: (documentId: number) => removeAdminDocumentVector(documentId),
    invalidateKeys: [["/admin/v1/documents"]],
  })
}

/**
 * AI 生成文档字段（摘要 / 标签）
 */
export function useAiGenerateFields() {
  return useAdminMutation({
    mutationFn: ({
      content,
      fields,
      summaryMaxLength,
      tagsMaxCount,
    }: {
      content: string
      fields: Array<"summary" | "tags">
      summaryMaxLength?: number
      tagsMaxCount?: number
    }) =>
      aiGenerateDocumentFields({
        content,
        fields,
        summary_max_length: summaryMaxLength,
        tags_max_count: tagsMaxCount,
      }),
  })
}

export type { VectorStatus }
