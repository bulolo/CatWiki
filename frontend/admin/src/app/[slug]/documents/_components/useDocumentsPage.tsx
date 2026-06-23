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

"use client"

/**
 * documents 页面的状态/数据/业务逻辑 hook。
 *
 * 把原本耦合在 DocumentsPage 组件内的 ~30 个 useState、查询、mutation、派生数据
 * 与全部事件 handler 收拢于此，页面组件只负责消费返回值并渲染。行为与原内联实现一致。
 */

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import {
  useSiteData,
  useDocuments,
  useDocument,
  useDeleteDocument,
  useBatchDeleteDocuments,
  useBatchUpdateDocuments,
  useCollectionTree,
  useCreateCollection,
  useUpdateCollection,
  useDeleteCollection,
  useDebounce,
  useVectorizeDocument,
  useBatchVectorizeDocuments,
  useRemoveVector,
} from "@/hooks"
import type { CollectionItem } from "@/types"
import { listAdminCollections, moveAdminCollection } from "@/lib/sdk/admin-collections"
import type { Collection as APICollection, CollectionCreate, CollectionTree as APICollectionTree, Document } from "@/lib/sdk/sdk.schemas"

// 转换集合树为 CollectionItem 的辅助函数
const convertToCollectionItems = (tree: APICollectionTree[]): CollectionItem[] => {
  if (!tree || tree.length === 0) return []
  return tree.map(col => ({
    id: col.id.toString(),
    name: col.title,
    type: col.type as "collection" | "document",
    children: col.children?.length
      ? convertToCollectionItems(col.children)
      : [],
    status: col.status || undefined,
    views: col.views || undefined,
    tags: col.tags || undefined
  }))
}

export function useDocumentsPage() {
  const t = useTranslations("Documents")
  const currentSite = useSiteData()
  const siteId = currentSite.id
  const queryClient = useQueryClient()
  // 直接从站点数据获取 tenantSlug，站点 API 已经返回了 tenant_slug
  const tenantSlug = currentSite.tenant_slug || "default"

  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | undefined>()
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | undefined>()
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [importDefaultTab, setImportDefaultTab] = useState<"upload" | "datasource">("upload")
  const [newCollectionName, setNewCollectionName] = useState("")

  const [targetParentId, setTargetParentId] = useState<number | undefined>()
  const [showDocuments, setShowDocuments] = useState(false)
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [sortBy, setSortBy] = useState<"created_at" | "updated_at" | "views">("created_at")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [status, setStatus] = useState<"all" | "published" | "draft">("all")
  const [vectorStatus, setVectorStatus] = useState<"all" | "none" | "outdated" | "pending" | "processing" | "completed" | "failed">("all")

  // 批量操作状态
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([])
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [showBatchMoveDialog, setShowBatchMoveDialog] = useState(false)
  const [batchTargetCollectionId, setBatchTargetCollectionId] = useState<string>("")

  // 查看分片状态
  const [viewChunksId, setViewChunksId] = useState<number | null>(null)
  const [isVectorRetrieveOpen, setIsVectorRetrieveOpen] = useState(false)

  // 删除确认弹窗状态
  const [deleteDocTarget, setDeleteDocTarget] = useState<{ id: number, title: string } | null>(null)
  const [deleteCollectionTarget, setDeleteCollectionTarget] = useState<{ id: string, name: string } | null>(null)
  const [isBatchDeleteOpen, setIsBatchDeleteOpen] = useState(false)

  // React Query hooks
  // 如果有选中的文档ID，使用单独的文档查询；否则使用文档列表查询
  const { data: documentsData, isLoading: documentsLoading } = useDocuments({
    siteId,
    page: currentPage,
    size: pageSize,
    collectionId: selectedCollectionId ? parseInt(selectedCollectionId) : undefined,
    // 不在 useDocuments 中传递 documentId，改用单独的 useDocument hook
    searchTerm: debouncedSearchTerm.trim() || undefined,
    status: status !== "all" ? status : undefined,
    vectorStatus: vectorStatus !== "all" ? vectorStatus : undefined,
    orderBy: sortBy,
    orderDir: sortOrder,
  })

  const { data: singleDocument, isLoading: singleDocumentLoading } = useDocument(
    selectedDocumentId ? parseInt(selectedDocumentId) : undefined
  )

  const { data: collectionsTree, isLoading: collectionsLoading, refetch: refetchCollections } = useCollectionTree(
    siteId,
    showDocuments
  )

  const deleteDocumentMutation = useDeleteDocument(siteId)
  const batchDeleteMutation = useBatchDeleteDocuments(siteId)
  const batchUpdateMutation = useBatchUpdateDocuments()
  const createCollectionMutation = useCreateCollection(siteId)
  const updateCollectionMutation = useUpdateCollection(siteId)
  const deleteCollectionMutation = useDeleteCollection(siteId)

  // 向量化相关 hooks
  const vectorizeMutation = useVectorizeDocument()
  const batchVectorizeMutation = useBatchVectorizeDocuments()
  const removeVectorMutation = useRemoveVector()


  // 处理文档数据
  const documents = useMemo(() => {
    if (selectedDocumentId && singleDocument) {
      return [singleDocument]
    }
    return documentsData?.documents || []
  }, [selectedDocumentId, singleDocument, documentsData])

  const totalDocuments = useMemo(() => {
    if (selectedDocumentId) return 1
    return documentsData?.total || 0
  }, [selectedDocumentId, documentsData])

  const loading = documentsLoading || singleDocumentLoading

  // 扁平化合集列表（用于批量移动选择器）
  const flatCollections = useMemo(() => {
    const flatten = (items: APICollectionTree[], level = 0): Array<APICollectionTree & { level: number }> => {
      return items.reduce((acc: Array<APICollectionTree & { level: number }>, item) => {
        acc.push({ ...item, level })
        if (item.children && item.children.length > 0) {
          acc.push(...flatten(item.children, level + 1))
        }
        return acc
      }, [])
    }
    return flatten(collectionsTree || [])
  }, [collectionsTree])



  // 转换集合树为 CollectionItem
  const collections = useMemo(() => {
    if (!collectionsTree) return []
    return convertToCollectionItems(collectionsTree)
  }, [collectionsTree])

  const handleSort = (field: "created_at" | "updated_at" | "views") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("desc")
    }
  }

  const getSortIcon = (field: "created_at" | "updated_at" | "views") => {
    if (sortBy !== field) return <ArrowUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50" />
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" />
    )
  }

  // 批量向量化处理函数
  const handleBatchVectorize = () => {
    if (selectedDocIds.length === 0) return
    batchVectorizeMutation.mutate(selectedDocIds, {
      onSuccess: () => {
        setSelectedDocIds([])
      }
    })
  }

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) return

    const payload: CollectionCreate = {
      site_id: siteId,
      title: newCollectionName.trim(),
      parent_id: targetParentId
    }
    createCollectionMutation.mutate(payload, {
      onSuccess: () => {
        toast.success(t("dialogs.createCollection.success"))
        setIsCreateCollectionOpen(false)
        setNewCollectionName("")
        setTargetParentId(undefined)
        refetchCollections()
      }
    })
  }

  const handleRenameCollection = async (id: string, newName: string) => {
    const payload: Partial<APICollection> = { title: newName }
    updateCollectionMutation.mutate({
      id: parseInt(id),
      data: payload
    }, {
      onSuccess: () => {
        refetchCollections()
      }
    })
  }

  /**
          * 移动合集到新位置
          * @param collectionId 要移动的合集ID
          * @param targetParentId 目标父级ID（null 表示根级别）
          * @param insertBeforeId 插入到哪个合集之前（null 表示插入到最后）
          */
  const handleMoveCollection = async (
    collectionId: string,
    targetParentId: string | null,
    insertBeforeId?: string | null
  ) => {


    if (!collectionId) {
      return
    }

    try {
      const collectionIdNum = parseInt(collectionId)
      const targetParentIdNum = targetParentId ? parseInt(targetParentId) : null

      // 获取目标父级下的所有兄弟集合（用于计算插入位置）
      const siblingsResp = await listAdminCollections({
        site_id: siteId,
        parent_id: targetParentIdNum === null ? undefined : targetParentIdNum,
        is_pager: 0,
      })

      // 过滤掉当前拖拽的合集，按 order 排序
      const siblings = (siblingsResp?.list ?? [])
        .filter((c: APICollection) => c.id !== collectionIdNum)
        .sort((a: APICollection, b: APICollection) => (a.order || 0) - (b.order || 0))


      // 计算目标位置索引
      let targetPosition = 0

      if (insertBeforeId) {
        // 找到目标合集的索引
        const targetIndex = siblings.findIndex(c => c.id === parseInt(insertBeforeId))
        if (targetIndex !== -1) {
          targetPosition = targetIndex
        } else {
          // 如果找不到目标合集，插入到最后
          targetPosition = siblings.length
        }
      } else {
        // 插入到最后
        targetPosition = siblings.length
      }

      // 调用后端移动接口
      await moveAdminCollection(collectionIdNum, {
        target_parent_id: targetParentIdNum,
        target_position: targetPosition,
      })


      toast.success(t("success.collectionMoved"))

      // 刷新合集树
      refetchCollections()

      // 刷新文档列表，因为合集结构改变了，文档列表可能受影响
      queryClient.invalidateQueries({ queryKey: ["/admin/v1/documents"] })

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("error.collectionMoveFailed")
      toast.error(message)
    }


  }

  const handleDeleteCollection = async (id: string, name: string) => {
    cancelBatchMode()
    setDeleteCollectionTarget({ id, name })
  }

  const confirmDeleteCollection = () => {
    if (!deleteCollectionTarget) return

    deleteCollectionMutation.mutate(parseInt(deleteCollectionTarget.id), {
      onSuccess: () => {
        toast.success(t("deleteDialog.success"))
        if (selectedCollectionId === deleteCollectionTarget.id) {
          setSelectedCollectionId(undefined)
        }
        refetchCollections()
        setDeleteCollectionTarget(null)
      }
    })
  }

  const handleDeleteDocument = async (id: number, title: string) => {
    cancelBatchMode()
    setDeleteDocTarget({ id, title })
  }

  const confirmDeleteDocument = () => {
    if (!deleteDocTarget) return
    deleteDocumentMutation.mutate(deleteDocTarget.id, {
      onSuccess: () => {
        toast.success(t("deleteDialog.success"))
        setDeleteDocTarget(null)
      }
    })
  }

  const findNodeType = (items: CollectionItem[], targetId: string): "collection" | "document" | null => {
    for (const item of items) {
      if (item.id === targetId) {
        return item.type || "collection"
      }
      if (item.children && item.children.length > 0) {
        const found = findNodeType(item.children, targetId)
        if (found) return found
      }
    }
    return null
  }

  const handleNodeSelect = (id: string | undefined) => {
    cancelBatchMode()
    if (!id) {
      setSelectedCollectionId(undefined)
      setSelectedDocumentId(undefined)
      setCurrentPage(1)
      // 刷新文档列表
      queryClient.invalidateQueries({ queryKey: ["/admin/v1/documents"] })
      return
    }

    const nodeType = findNodeType(collections, id)
    if (nodeType === "document") {
      setSelectedDocumentId(id)
      setSelectedCollectionId(undefined)
      setCurrentPage(1)
    } else {
      // 选中合集时，刷新文档列表以确保显示最新数据
      setSelectedCollectionId(id)
      setSelectedDocumentId(undefined)
      setCurrentPage(1)
      // 强制刷新文档列表，因为合集结构可能已经改变
      queryClient.invalidateQueries({ queryKey: ["/admin/v1/documents"] })
    }
  }

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  const handleStatusFilterChange = (value: "all" | "published" | "draft") => {
    setStatus(value)
    setCurrentPage(1)
  }

  // 批量操作处理函数
  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode)
    setSelectedDocIds([])
  }

  const cancelBatchMode = () => {
    setIsBatchMode(false)
    setSelectedDocIds([])
  }

  const toggleDocSelection = (docId: number) => {
    setSelectedDocIds(prev =>
      prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    )
  }

  const toggleSelectAll = () => {
    if (selectedDocIds.length === documents.length) {
      setSelectedDocIds([])
    } else {
      setSelectedDocIds(documents.map((doc: Document) => doc.id as number))
    }
  }


  const handleBatchDelete = () => {
    if (selectedDocIds.length === 0) {
      toast.error(t("batchBar.selectItems"))
      return
    }
    setIsBatchDeleteOpen(true)
  }

  const confirmBatchDelete = () => {
    batchDeleteMutation.mutate(selectedDocIds, {
      onSuccess: () => {
        toast.success(t("deleteDialog.success"))
        setSelectedDocIds([])
        setIsBatchMode(false)
        setIsBatchDeleteOpen(false)
      }
    })
  }

  const handleBatchMove = () => {
    if (selectedDocIds.length === 0) {
      toast.error(t("batchBar.selectItems"))
      return
    }
    setShowBatchMoveDialog(true)
  }

  const confirmBatchMove = () => {
    if (!batchTargetCollectionId) {
      toast.error(t("dialogs.batchMove.errorSelectTarget"))
      return
    }

    batchUpdateMutation.mutate({
      documentIds: selectedDocIds,
      data: { collection_id: parseInt(batchTargetCollectionId) }
    }, {
      onSuccess: () => {
        toast.success(t("dialogs.batchMove.success"))
        setSelectedDocIds([])
        setIsBatchMode(false)
        setShowBatchMoveDialog(false)
        setBatchTargetCollectionId("")
      }
    })
  }



  const handleBatchPublish = () => {
    if (selectedDocIds.length === 0) {
      toast.error(t("batchBar.selectItems"))
      return
    }

    batchUpdateMutation.mutate({
      documentIds: selectedDocIds,
      data: { status: "published" as const }
    }, {
      onSuccess: () => {
        toast.success(t("batchBar.publishSuccess"))
        setSelectedDocIds([])
      }
    })
  }

  const handleBatchUnpublish = () => {
    if (selectedDocIds.length === 0) {
      toast.error(t("batchBar.selectItems"))
      return
    }

    batchUpdateMutation.mutate({
      documentIds: selectedDocIds,
      data: { status: "draft" as const }
    }, {
      onSuccess: () => {
        toast.success(t("batchBar.unpublishSuccess"))
        setSelectedDocIds([])
      }
    })
  }

  return {
    currentSite, siteId, queryClient, tenantSlug,
    searchTerm, setSearchTerm, debouncedSearchTerm,
    selectedCollectionId, setSelectedCollectionId,
    selectedDocumentId, setSelectedDocumentId,
    isCreateCollectionOpen, setIsCreateCollectionOpen,
    isImportOpen, setIsImportOpen,
    importDefaultTab, setImportDefaultTab,
    newCollectionName, setNewCollectionName,
    targetParentId, setTargetParentId,
    showDocuments, setShowDocuments,
    viewMode, setViewMode,
    currentPage, setCurrentPage,
    pageSize, setPageSize,
    sortBy, setSortBy, sortOrder, setSortOrder,
    status, setStatus,
    vectorStatus, setVectorStatus,
    selectedDocIds, setSelectedDocIds,
    isBatchMode, setIsBatchMode,
    showBatchMoveDialog, setShowBatchMoveDialog,
    batchTargetCollectionId, setBatchTargetCollectionId,
    viewChunksId, setViewChunksId,
    isVectorRetrieveOpen, setIsVectorRetrieveOpen,
    deleteDocTarget, setDeleteDocTarget,
    deleteCollectionTarget, setDeleteCollectionTarget,
    isBatchDeleteOpen, setIsBatchDeleteOpen,
    documentsData, singleDocument, collectionsTree, collectionsLoading, refetchCollections,
    deleteDocumentMutation, batchDeleteMutation, batchUpdateMutation,
    createCollectionMutation, updateCollectionMutation, deleteCollectionMutation,
    vectorizeMutation, batchVectorizeMutation, removeVectorMutation,
    documents, totalDocuments, loading, flatCollections, collections,
    handleSort, getSortIcon, handleBatchVectorize,
    handleCreateCollection, handleRenameCollection, handleMoveCollection,
    handleDeleteCollection, confirmDeleteCollection,
    handleDeleteDocument, confirmDeleteDocument,
    handleNodeSelect, handleSearchChange, handleStatusFilterChange,
    toggleBatchMode, cancelBatchMode, toggleDocSelection, toggleSelectAll,
    handleBatchDelete, confirmBatchDelete, handleBatchMove, confirmBatchMove,
    handleBatchPublish, handleBatchUnpublish,
  }
}
