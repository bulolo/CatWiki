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

import { useTranslations, useLocale } from "next-intl"

import {
  LoadingState,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  Pagination,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
  OptimizedImage,
  ScrollArea,
  useConfirm
} from "@/components/ui"

import { useState, useMemo } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { useQueryClient, useQuery } from "@tanstack/react-query"
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  LayoutGrid,
  List,
  Folder,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Eye,
  CheckSquare,
  Square,
  FolderInput,
  Send,
  Archive,
  X,
  AlertCircle,
  RefreshCw,
  Brain,
  Loader2,
  Sparkles,
} from "lucide-react"
import {
  useSiteData,
  useDocuments,
  useDocument,
  useDeleteDocument,
  useBatchDeleteDocuments,
  useBatchUpdateDocuments,
  useCollectionTree,
  useCollections,
  useCreateCollection,
  useUpdateCollection,
  useDeleteCollection,
  useDebounce,
  useVectorizeDocument,
  useBatchVectorizeDocuments,
  useRemoveVector,
  VectorStatus
} from "@/hooks"

import { env } from "@/lib/env"
import { CollectionTree, VectorRetrieveModal, DocumentImportDialog } from "@/components/features/documents"
import type { CollectionItem } from "@/types"
import { getRoutePath, useRouteContext } from "@/lib/routing"
import { listAdminCollections, moveAdminCollection } from "@/lib/sdk/admin-collections"
import type { Collection as APICollection, CollectionCreate, CollectionTree as APICollectionTree, Document, DocumentStatus } from "@/lib/sdk/sdk.schemas"
import { cn } from "@/lib/utils"
import { ChunksViewerDialog } from "./_dialogs/ChunksViewerDialog"

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

export default function DocumentsPage() {
  const t = useTranslations("Documents")
  const confirm = useConfirm()
  const locale = useLocale()
  const commonT = useTranslations("Common")
  const routeContext = useRouteContext()
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

  // 渲染向量化状态
  const renderVectorStatus = (doc: Document) => {
    const vectorStatus = doc.vector_status || "none" as const
    const vectorError = doc.vector_error

    switch (vectorStatus) {
      case "none" as const:
        return (
          <button
            onClick={() => vectorizeMutation.mutate(doc.id)}
            disabled={vectorizeMutation.isPending}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-400 hover:text-primary hover:bg-primary/5 transition-all whitespace-nowrap flex-shrink-0"
          >
            <Brain className="h-3 w-3 flex-shrink-0" />
            <span>{t("learning.notLearned")}</span>
          </button>
        )
      case "outdated" as const:
        return (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => vectorizeMutation.mutate(doc.id)}
              disabled={vectorizeMutation.isPending}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-amber-500 bg-amber-50 hover:bg-amber-100 border border-amber-200/50 transition-all whitespace-nowrap flex-shrink-0"
              title={t("learning.clickToRelearn_outdated")}
            >
              <RefreshCw className="h-2.5 w-2.5 flex-shrink-0" />
              <span>{t("learning.outdated")}</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setViewChunksId(doc.id)
              }}
              className="p-1 rounded-md text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
              title={t("list.viewChunks")}
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={async (e) => {
                e.stopPropagation()
                if (await confirm({ description: t("learning.confirmDeleteVector"), variant: "destructive" })) {
                  removeVectorMutation.mutate(doc.id)
                }
              }}
              disabled={removeVectorMutation.isPending}
              className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title={t("list.deleteVector")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      case "pending" as const:
        return (
          <Badge
            variant="outline"
            className="inline-flex items-center text-[10px] font-bold px-1.5 py-0 h-4.5 border-none bg-amber-50 text-amber-600 shadow-none cursor-pointer hover:bg-amber-100 whitespace-nowrap flex-shrink-0"
            onClick={() => removeVectorMutation.mutate(doc.id)}
            title={t("learning.clickToCancel")}
          >
            <Clock className="h-2.5 w-2.5 mr-0.5 flex-shrink-0" />
            {t("learning.queuing")}
          </Badge>
        )
      case "processing" as const:
        return (
          <Badge
            variant="outline"
            className="inline-flex items-center text-[10px] font-bold px-1.5 py-0 h-4.5 border-none bg-blue-50 text-blue-600 shadow-none whitespace-nowrap flex-shrink-0"
          >
            <Loader2 className="h-2.5 w-2.5 mr-0.5 flex-shrink-0 animate-spin" />
            {t("learning.learning")}
          </Badge>
        )
      case "completed" as const:
        return (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => vectorizeMutation.mutate(doc.id)}
              disabled={vectorizeMutation.isPending}
              className="group/relearn inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-200 border border-emerald-100/50 hover:border-emerald-200 shadow-sm active:scale-95 transition-all whitespace-nowrap flex-shrink-0 cursor-pointer min-w-[60px]"
              title={t("learning.clickToRelearn")}
            >
              <span className="flex items-center gap-1 group-hover/relearn:hidden">
                <Brain className="h-2.5 w-2.5 mr-0.5 flex-shrink-0" />
                <span>{t("learning.learned")}</span>
              </span>
              <span className="hidden group-hover/relearn:flex items-center gap-1">
                <RefreshCw className="h-2.5 w-2.5 mr-0.5 flex-shrink-0" />
                <span>{t("learning.relearnShort")}</span>
              </span>
            </button>

            {/* 查看分片 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setViewChunksId(doc.id)
              }}
              className="p-1 rounded-md text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
              title={t("list.viewChunks")}
            >
              <Eye className="h-3.5 w-3.5" />
            </button>

            {/* 删除向量 */}
            <button
              onClick={async (e) => {
                e.stopPropagation()
                if (await confirm({ description: t("learning.confirmDeleteVector"), variant: "destructive" })) {
                  removeVectorMutation.mutate(doc.id)
                }
              }}
              disabled={removeVectorMutation.isPending}
              className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title={t("list.deleteVector")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      case "failed" as const:
        return (
          <button
            onClick={() => vectorizeMutation.mutate(doc.id)}
            disabled={vectorizeMutation.isPending}
            className="inline-flex items-center gap-1 whitespace-nowrap flex-shrink-0"
            title={vectorError || t("learning.clickToRelearn")}
          >
            <Badge
              variant="outline"
              className="inline-flex items-center text-[10px] font-bold px-1.5 py-0 h-4.5 border-none bg-red-50 text-red-500 shadow-none whitespace-nowrap"
            >
              <AlertCircle className="h-2.5 w-2.5 mr-0.5 flex-shrink-0" />
              {t("learning.failed")}
            </Badge>
            <RefreshCw className="h-3 w-3 text-slate-400 hover:text-primary flex-shrink-0" />
          </button>
        )
      default:
        return null
    }
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

  if (collectionsLoading && !collectionsTree) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingState />
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6 flex flex-col h-full overflow-hidden">
      <DocumentImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        siteId={siteId}
        collections={collections}
        defaultTab={importDefaultTab}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["/admin/v1/documents"] })
          queryClient.invalidateQueries({ queryKey: ["collection-tree", siteId] })
        }}
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 px-1 gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1 md:mt-2 text-sm md:text-base hidden sm:block">{t("description")}</p>
        </div>
        <div className="flex gap-2 md:gap-3">
          {!isBatchMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleBatchMode}
              className="gap-1.5 md:gap-2 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all duration-200"
            >
              <CheckSquare className="h-4 w-4" />
              <span className="hidden sm:inline">{t("actions.batch")}</span>
              <span className="sm:hidden">{t("actions.batch").slice(0, 2)}</span>
            </Button>
          )}
          {/* Import Button (统一入口：上传文件 / 从数据源) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              cancelBatchMode()
              setImportDefaultTab("upload")
              setIsImportOpen(true)
            }}
            className="gap-1.5 md:gap-2 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
          >
            <FolderInput className="h-4 w-4" />
            <span className="hidden sm:inline">{t("actions.import")}</span>
            <span className="sm:hidden">{t("actions.import").slice(0, 2)}</span>
          </Button>
          <Link href={getRoutePath("/documents/new", routeContext.slug)}>
            <Button size="sm" className="flex items-center gap-1.5 md:gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t("actions.create")}</span>
              <span className="sm:hidden">{t("actions.create").slice(0, 2)}</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              cancelBatchMode()
              setIsVectorRetrieveOpen(true)
            }}
            className="flex items-center gap-1.5 md:gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 transition-all shadow-sm"
          >
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">{t("actions.vectorize")}</span>
            <span className="sm:hidden">{t("actions.vectorize").slice(0, 2)}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              cancelBatchMode()
              const clientUrl = env.NEXT_PUBLIC_CLIENT_URL
              window.open(`${clientUrl}/${tenantSlug}/${currentSite.slug}`, "_blank")
            }}
            className="flex items-center gap-1.5 md:gap-2 border-purple-200 text-purple-600 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 transition-all shadow-sm"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">{t("actions.aiChat")}</span>
            <span className="sm:hidden">AI</span>
          </Button>
        </div>
      </div>

      {/* 优化后的极简亮色浮动操作栏 - 响应式 */}
      {isBatchMode && (
        <div className="fixed bottom-6 md:bottom-10 left-2 right-2 md:left-0 md:right-0 flex justify-center z-50 pointer-events-none">
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto w-full md:w-auto">
            <div className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 md:py-2.5 bg-white text-slate-900 rounded-xl md:rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.12),0_0_1px_rgba(0,0,0,0.2)] border border-slate-200/60 backdrop-blur-xl">
              {/* 选中计数 */}
              <div className="flex items-center gap-1.5 md:gap-2.5 px-2 md:px-3 border-r border-slate-100 mr-0.5 md:mr-1">
                <div className="flex items-center justify-center w-5 h-5 md:w-6 md:h-6 rounded-full bg-primary text-white text-[10px] md:text-[11px] font-bold shadow-sm shadow-primary/20">
                  {selectedDocIds.length}
                </div>
                <span className="text-xs md:text-sm font-semibold text-slate-600 tracking-tight hidden sm:inline">
                  {t("batchBar.selected", { count: selectedDocIds.length }).replace(selectedDocIds.length.toString(), "").trim()}
                </span>
              </div>

              {/* 操作按钮组 */}
              <div className="flex items-center gap-0.5 md:gap-1 flex-1 md:flex-none overflow-x-auto">
                {selectedDocIds.length > 0 ? (
                  <>
                    <button
                      onClick={handleBatchMove}
                      disabled={batchUpdateMutation.isPending}
                      className="flex items-center gap-1 md:gap-2 px-2 md:px-3.5 py-1.5 md:py-2 hover:bg-slate-50 active:bg-slate-100 rounded-lg md:rounded-xl text-xs md:text-sm font-medium text-slate-700 transition-all disabled:opacity-50 group whitespace-nowrap"
                      title={t("actions.move")}
                    >
                      <FolderInput className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-400 group-hover:text-primary transition-colors" />
                      <span className="hidden md:inline">{t("actions.move")}</span>
                    </button>
                    <button
                      onClick={handleBatchPublish}
                      disabled={batchUpdateMutation.isPending}
                      className="flex items-center gap-1 md:gap-2 px-2 md:px-3.5 py-1.5 md:py-2 hover:bg-emerald-50 active:bg-emerald-100 rounded-lg md:rounded-xl text-xs md:text-sm font-medium text-emerald-600 transition-all disabled:opacity-50 whitespace-nowrap"
                      title={t("batchBar.publish")}
                    >
                      <Send className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      <span className="hidden md:inline">{t("batchBar.publish")}</span>
                    </button>
                    <button
                      onClick={handleBatchUnpublish}
                      disabled={batchUpdateMutation.isPending}
                      className="flex items-center gap-1 md:gap-2 px-2 md:px-3.5 py-1.5 md:py-2 hover:bg-amber-50 active:bg-amber-100 rounded-lg md:rounded-xl text-xs md:text-sm font-medium text-amber-600 transition-all disabled:opacity-50 whitespace-nowrap"
                      title={t("batchBar.unpublish")}
                    >
                      <Archive className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      <span className="hidden md:inline">{t("batchBar.unpublish")}</span>
                    </button>
                    <button
                      onClick={handleBatchVectorize}
                      disabled={batchVectorizeMutation.isPending}
                      className="flex items-center gap-1 md:gap-2 px-2 md:px-3.5 py-1.5 md:py-2 hover:bg-blue-50 active:bg-blue-100 rounded-lg md:rounded-xl text-xs md:text-sm font-medium text-blue-600 transition-all disabled:opacity-50 whitespace-nowrap"
                      title={t("batchBar.vectorize")}
                    >
                      <Brain className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      <span className="hidden md:inline">{t("batchBar.vectorize")}</span>
                    </button>
                    <button
                      onClick={handleBatchDelete}
                      disabled={batchDeleteMutation.isPending}
                      className="flex items-center gap-1 md:gap-2 px-2 md:px-3.5 py-1.5 md:py-2 hover:bg-red-50 active:bg-red-100 rounded-lg md:rounded-xl text-xs md:text-sm font-medium text-red-500 transition-all disabled:opacity-50 whitespace-nowrap"
                      title={t("batchBar.delete")}
                    >
                      <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      <span className="hidden md:inline">{t("batchBar.delete")}</span>
                    </button>
                  </>
                ) : (
                  <span className="text-[10px] md:text-xs text-slate-400 px-2 md:px-6 py-1.5 md:py-2">{t("batchBar.selectItems")}</span>
                )}
              </div>

              <div className="w-px h-4 md:h-5 bg-slate-100 mx-0.5 md:mx-1" />

              {/* 退出按钮 */}
              <button
                onClick={toggleBatchMode}
                className="flex items-center justify-center w-7 h-7 md:w-9 md:h-9 hover:bg-slate-50 active:bg-slate-100 rounded-lg md:rounded-xl text-slate-400 hover:text-slate-600 transition-all shrink-0"
                title={t("actions.cancel")}
              >
                <X className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 lg:gap-6 items-start flex-1 min-h-0">
        {/* 左侧目录树 - 大屏幕显示 */}
        <div className="w-64 shrink-0 hidden xl:block">
          <CollectionTree
            items={collections}
            selectedId={selectedCollectionId || selectedDocumentId}
            onSelect={handleNodeSelect}
            onCreateCollection={(parentId) => {
              cancelBatchMode()
              setTargetParentId(parentId ? parseInt(parentId) : undefined)
              setIsCreateCollectionOpen(true)
            }}
            onDeleteCollection={handleDeleteCollection}
            onRenameCollection={handleRenameCollection}
            onMoveCollection={handleMoveCollection}
            showDocuments={showDocuments}
            onToggleShowDocuments={() => setShowDocuments(!showDocuments)}
          />
        </div>

        <VectorRetrieveModal
          open={isVectorRetrieveOpen}
          onOpenChange={setIsVectorRetrieveOpen}
          siteId={siteId}
        />

        <div className="flex-1 min-w-0 space-y-3 md:space-y-4">
          <Card className="flex flex-col border-none shadow-none bg-transparent">
            <CardHeader className="shrink-0 p-0 pb-3 md:pb-4">
              {/* 筛选器 - 响应式布局 */}
              <div className="flex flex-col gap-3">
                {/* 第一行：目录按钮（小屏幕）+ 搜索框 */}
                <div className="flex items-center gap-2 md:gap-4">
                  {/* 目录按钮 - 小屏幕显示 */}
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="xl:hidden h-10 w-10 shrink-0 border-slate-200 shadow-sm"
                      >
                        <Folder className="h-4 w-4" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-80 p-4">
                      <SheetTitle className="sr-only">{t("collections.title")}</SheetTitle>
                      <SheetDescription className="sr-only">
                        {t("collections.description")}
                      </SheetDescription>
                      <CollectionTree
                        items={collections}
                        selectedId={selectedCollectionId || selectedDocumentId}
                        onSelect={(id) => {
                          handleNodeSelect(id)
                        }}
                        onCreateCollection={(parentId) => {
                          cancelBatchMode()
                          setTargetParentId(parentId ? parseInt(parentId) : undefined)
                          setIsCreateCollectionOpen(true)
                        }}
                        onDeleteCollection={handleDeleteCollection}
                        onRenameCollection={handleRenameCollection}
                        onMoveCollection={handleMoveCollection}
                        showDocuments={showDocuments}
                        onToggleShowDocuments={() => setShowDocuments(!showDocuments)}
                      />
                    </SheetContent>
                  </Sheet>

                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder={
                        selectedDocumentId
                          ? t("actions.selectedDoc")
                          : selectedCollectionId
                            ? t("actions.searchInFolder")
                            : t("actions.searchDoc")
                      }
                      className="pl-9 bg-white border-slate-200 focus:ring-0 focus:border-slate-300 transition-all h-10 rounded-lg shadow-sm"
                      value={searchTerm}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      disabled={!!selectedDocumentId}
                    />
                  </div>

                  {/* 视图切换 - 始终显示 */}
                  <div className="flex items-center bg-slate-100/50 rounded-lg p-1 border border-slate-200/60 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8 rounded-md transition-all",
                        viewMode === "list" ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-600"
                      )}
                      onClick={() => setViewMode("list")}
                      title={t("actions.listView")}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8 rounded-md transition-all",
                        viewMode === "grid" ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-600"
                      )}
                      onClick={() => setViewMode("grid")}
                      title={t("actions.gridView")}
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* 第二行：筛选器 */}
                <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                  {/* 状态筛选器 */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 whitespace-nowrap">{t("list.columnStatus")}:</span>
                    <Select value={status} onValueChange={handleStatusFilterChange}>
                      <SelectTrigger className="w-[90px] md:w-[100px] bg-white border-slate-200 shadow-sm h-8 md:h-9 rounded-lg text-xs md:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("status.all")}</SelectItem>
                        <SelectItem value="published">{t("status.published")}</SelectItem>
                        <SelectItem value="draft">{t("status.draft")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 学习状态筛选器 */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 whitespace-nowrap">{t("list.columnLearning")}:</span>
                    <Select value={vectorStatus} onValueChange={(value: string) => {
                      setVectorStatus(value as typeof vectorStatus)
                      setCurrentPage(1)
                    }}>
                      <SelectTrigger className="w-[90px] md:w-[100px] bg-white border-slate-200 shadow-sm h-8 md:h-9 rounded-lg text-xs md:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("status.all")}</SelectItem>
                        <SelectItem value="none">{t("status.none")}</SelectItem>
                        <SelectItem value="outdated">{t("status.outdated")}</SelectItem>
                        <SelectItem value="pending">{t("status.pending")}</SelectItem>
                        <SelectItem value="processing">{t("status.processing")}</SelectItem>
                        <SelectItem value="completed">{t("status.completed")}</SelectItem>
                        <SelectItem value="failed">{t("status.failed")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 relative bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              {loading && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-20 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <div className="text-sm text-muted-foreground">{commonT("loading")}</div>
                  </div>
                </div>
              )}

              {viewMode === "list" && (
                <div className="overflow-x-auto">
                  <Table className="">
                    <TableHeader className="bg-slate-50/50 sticky top-0 z-10 backdrop-blur-md">
                      <TableRow className="hover:bg-transparent border-b border-slate-100">
                        {isBatchMode && (
                          <TableHead className="w-[50px] pl-6 sticky left-0 z-20 bg-slate-50/95 backdrop-blur">
                            <button
                              onClick={toggleSelectAll}
                              className="group p-1 rounded transition-all"
                            >
                              {selectedDocIds.length === documents.length && documents.length > 0 ? (
                                <CheckSquare className="h-4 w-4 text-primary group-hover:scale-105 transition-transform" />
                              ) : (
                                <Square className="h-4 w-4 text-slate-200 group-hover:text-slate-300 group-hover:scale-105 transition-all" />
                              )}
                            </button>
                          </TableHead>
                        )}
                        <TableHead className={cn("w-[50px] py-3 font-medium text-[11px] uppercase tracking-wider text-slate-400 hidden md:table-cell", isBatchMode ? "" : "pl-6")}>#</TableHead>
                        <TableHead className="w-[300px] font-medium text-[11px] uppercase tracking-wider text-slate-400 min-w-[200px]">{t("list.columnTitle")}</TableHead>
                        <TableHead className="w-[120px] font-medium text-[11px] uppercase tracking-wider text-slate-400 hidden lg:table-cell">{t("list.columnCollection")}</TableHead>
                        <TableHead className="w-[80px] font-medium text-[11px] uppercase tracking-wider text-slate-400">{t("list.columnStatus")}</TableHead>
                        <TableHead className="w-[90px] font-medium text-[11px] uppercase tracking-wider text-slate-400 hidden xl:table-cell">{t("list.columnLearning")}</TableHead>
                        <TableHead className="w-[80px] hidden lg:table-cell">
                          <button
                            className="group flex items-center gap-1 hover:text-slate-600 transition-colors font-medium text-[11px] uppercase tracking-wider text-slate-400"
                            onClick={() => handleSort("views")}
                          >
                            {t("list.columnViews")}
                            {getSortIcon("views")}
                          </button>
                        </TableHead>
                        <TableHead className="w-[100px] hidden 2xl:table-cell">
                          <button
                            className="group flex items-center gap-1 hover:text-slate-600 transition-colors font-medium text-[11px] uppercase tracking-wider text-slate-400"
                            onClick={() => handleSort("created_at")}
                          >
                            {t("list.columnCreatedAt")}
                            {getSortIcon("created_at")}
                          </button>
                        </TableHead>
                        <TableHead className="w-[100px] hidden md:table-cell">
                          <button
                            className="group flex items-center gap-1 hover:text-slate-600 transition-colors font-medium text-[11px] uppercase tracking-wider text-slate-400"
                            onClick={() => handleSort("updated_at")}
                          >
                            {t("list.columnUpdatedAt")}
                            {getSortIcon("updated_at")}
                          </button>
                        </TableHead>
                        <TableHead className="w-[80px] text-right pr-6 font-medium text-[11px] uppercase tracking-wider text-slate-400 sticky right-0 z-20 bg-slate-50/95 backdrop-blur">{t("list.columnActions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.length > 0 ? (
                        documents.map((doc: Document, index: number) => (

                          <TableRow key={doc.id} className={cn(
                            "group hover:bg-slate-50/50 border-b border-slate-50 last:border-0 transition-all duration-200",
                            selectedDocIds.includes(doc.id) && "bg-blue-50/40"
                          )}>
                            {isBatchMode && (
                              <TableCell className="py-3 pl-6 sticky left-0 z-10 bg-white group-hover:bg-slate-50/50">
                                <button
                                  onClick={() => toggleDocSelection(doc.id)}
                                  className="group/checkbox p-1 rounded transition-all"
                                >
                                  {selectedDocIds.includes(doc.id) ? (
                                    <CheckSquare className="h-5 w-5 text-primary group-hover/checkbox:scale-105 transition-transform" />
                                  ) : (
                                    <Square className="h-5 w-5 text-slate-200 group-hover/checkbox:text-slate-300 group-hover/checkbox:scale-105 transition-all" />
                                  )}
                                </button>
                              </TableCell>
                            )}
                            <TableCell className={cn("py-3 hidden md:table-cell", isBatchMode ? "" : "pl-6")}>
                              <span className="text-xs text-slate-400 font-mono">{(currentPage - 1) * pageSize + index + 1}</span>
                            </TableCell>
                            <TableCell className={cn("py-3", isBatchMode ? "" : "")}>
                              <div className="flex items-start gap-3">
                                <OptimizedImage
                                  src={doc.cover_image}
                                  alt={doc.title}
                                  width={40}
                                  height={40}
                                  className="w-10 h-10 rounded-lg border border-slate-200/60 shadow-sm flex-shrink-0 hidden sm:flex"
                                />
                                <div className="flex flex-col gap-0.5 max-w-[300px]">
                                  <div
                                    className="font-semibold text-slate-900 truncate cursor-pointer hover:text-primary transition-colors text-[13.5px] leading-relaxed"
                                    onClick={() => {
                                      const clientUrl = env.NEXT_PUBLIC_CLIENT_URL
                                      const slug = routeContext.slug || currentSite.slug || "demo"
                                      window.open(`${clientUrl}/${tenantSlug}/${slug}?documentId=${doc.id}`, "_blank")
                                    }}
                                  >
                                    {doc.title}
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                                    <span className="hidden sm:inline">{t("list.readingTime", { count: doc.reading_time || 0 })}</span>
                                    <span className={cn("sm:hidden", doc.status === "published" ? "text-emerald-500" : "text-amber-500")}>
                                      {doc.status === "published" ? t("status.published") : t("status.draft")}
                                    </span>
                                    {doc.tags && doc.tags.length > 0 && (
                                      <>
                                        <span className="w-0.5 h-0.5 rounded-full bg-slate-300 hidden sm:block" />
                                        <span className="truncate max-w-[100px]">{doc.tags.join(", ")}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-3 hidden lg:table-cell">
                              <div className="flex items-center gap-1.5">
                                <Folder className="h-3 w-3 text-slate-300" />
                                <span className="text-[12px] text-slate-500 font-medium truncate max-w-[100px]">
                                  {doc.collection?.title || t("list.rootFolder")}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "inline-flex items-center text-[10px] font-bold px-1.5 py-0 h-4.5 border-none shadow-none whitespace-nowrap",
                                  doc.status === "published" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                                )}
                              >
                                {doc.status === "published" ? t("status.published") : t("status.draft")}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3 hidden xl:table-cell">
                              {renderVectorStatus(doc)}
                            </TableCell>
                            <TableCell className="py-3 text-slate-500 tabular-nums text-[12px] font-medium hidden lg:table-cell">
                              {(doc.views || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="py-3 text-slate-400 text-[11px] font-medium whitespace-nowrap hidden 2xl:table-cell">
                              {new Date(doc.created_at).toLocaleString(locale, {
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false
                              }).replace(/\//g, "-")}
                            </TableCell>
                            <TableCell className="py-3 text-slate-400 text-[11px] font-medium whitespace-nowrap hidden md:table-cell">
                              {new Date(doc.updated_at).toLocaleString(locale, {
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false
                              }).replace(/\//g, "-")}
                            </TableCell>
                            <TableCell className="py-3 text-right pr-6 sticky right-0 z-10 bg-white group-hover:bg-slate-50/50">
                              <div className="flex justify-end gap-0.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <Link href={getRoutePath(`/documents/edit/${doc.id}`, routeContext.slug)}>
                                  <Button variant="ghost" size="icon-xs" className="text-slate-400 hover:text-slate-900 hover:bg-slate-100" title={t("list.edit")}>
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                </Link>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                                  title={t("list.delete")}
                                  onClick={() => handleDeleteDocument(doc.id, doc.title)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} className="h-64 text-center">
                            <div className="flex flex-col items-center justify-center gap-3">
                              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
                                <FileText className="h-10 w-10 text-slate-200" />
                              </div>
                              <div className="text-sm font-medium text-slate-400 italic">
                                {selectedDocumentId
                                  ? t("list.noDocFound")
                                  : selectedCollectionId
                                    ? t("list.noDocInCollection")
                                    : searchTerm
                                      ? t("list.noMatchDoc")
                                      : t("list.noDoc")}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {viewMode === "grid" && (
                <div className={cn("p-4", loading && "opacity-40")}>
                  {documents.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 items-stretch">
                      {documents.map((doc: Document) => (
                        <div
                          key={doc.id}
                          className="group flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200"
                        >
                          <div
                            className="relative w-full aspect-[3/2] overflow-hidden bg-slate-50 cursor-pointer shrink-0"
                            onClick={() => {
                              const clientUrl = env.NEXT_PUBLIC_CLIENT_URL
                              const slug = routeContext.slug || currentSite.slug || "demo"
                              window.open(`${clientUrl}/${tenantSlug}/${slug}?documentId=${doc.id}`, "_blank")
                            }}
                          >
                            <OptimizedImage
                              src={doc.cover_image}
                              alt={doc.title}
                              width={400}
                              height={300}
                              className="w-full h-full"
                            />

                            <div className="absolute top-2 right-2 flex flex-col gap-1">
                              {doc.status === "published" ? (
                                <div className="px-2 py-0.5 rounded bg-emerald-500/90 backdrop-blur-sm text-white text-xs font-medium">
                                  {t("status.published")}
                                </div>
                              ) : (
                                <div className="px-2 py-0.5 rounded bg-slate-500/90 backdrop-blur-sm text-white text-xs font-medium">
                                  {t("status.draft")}
                                </div>
                              )}
                              {doc.vector_status === "completed" as const && (
                                <div className="px-2 py-0.5 rounded bg-blue-500/90 backdrop-blur-sm text-white text-xs font-medium">
                                  {t("status.completed")}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="p-3 flex flex-col flex-1 min-h-0">
                            <h3
                              className="text-sm font-bold text-slate-900 mb-1.5 line-clamp-2 leading-snug cursor-pointer hover:text-primary transition-colors shrink-0"
                              onClick={() => {
                                const clientUrl = env.NEXT_PUBLIC_CLIENT_URL
                                const slug = routeContext.slug || currentSite.slug || "demo"
                                window.open(`${clientUrl}/${tenantSlug}/${slug}?documentId=${doc.id}`, "_blank")
                              }}
                            >
                              {doc.title}
                            </h3>

                            <div className="h-10 mb-2 shrink-0">
                              {doc.summary ? (
                                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                  {doc.summary}
                                </p>
                              ) : (
                                <p className="text-[11px] text-slate-400 italic line-clamp-2 leading-relaxed">
                                  {t("list.noSummary")}
                                </p>
                              )}
                            </div>

                            <div className="space-y-1.5 mb-2 shrink-0">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Folder className="h-3 w-3 shrink-0" />
                                <span className="truncate">{doc.collection?.title || t("list.rootFolder")}</span>
                              </div>

                              <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                                <div className="flex items-center gap-1">
                                  <Eye className="h-3 w-3 opacity-60" />
                                  <span>{doc.views || 0}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 opacity-60" />
                                  <span>{t("list.readingTime", { count: doc.reading_time || 0 })}</span>
                                </div>
                              </div>

                              {doc.tags && doc.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {doc.tags.slice(0, 2).map((tag: string, index: number) => (
                                    <span
                                      key={index}
                                      className="px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-600 border border-blue-100"
                                    >
                                      {tag}
                                    </span>
                                  ))}

                                  {doc.tags.length > 2 && (
                                    <span className="px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground border border-border">
                                      +{doc.tags.length - 2}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="mt-auto pt-2 border-t border-slate-100 flex gap-2 shrink-0">
                              <Link
                                href={getRoutePath(`/documents/edit/${doc.id}`, routeContext.slug)}
                                className="flex-1"
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full h-8 text-xs hover:bg-primary hover:text-white hover:border-primary transition-colors"
                                >
                                  <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                                  {t("list.move")}
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 text-xs hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors"
                                onClick={() => handleDeleteDocument(doc.id, doc.title)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                      <FileText className="h-12 w-12 mb-3 opacity-20" />
                      <p className="text-sm">
                        {selectedDocumentId
                          ? t("list.noDocFound")
                          : selectedCollectionId
                            ? t("list.noDocInCollection")
                            : searchTerm
                              ? t("list.noMatchDoc")
                              : t("list.noDoc")}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>

            {totalDocuments > 0 && (
              <div className="border-t border-slate-100 px-6 py-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(totalDocuments / pageSize)}
                  totalItems={totalDocuments}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={isCreateCollectionOpen} onOpenChange={setIsCreateCollectionOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t("dialogs.createCollection.title")}</DialogTitle>
            <DialogDescription>
              {t("dialogs.createCollection.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{t("dialogs.createCollection.labelName")}</label>
              <Input
                placeholder={t("dialogs.createCollection.placeholderName")}
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateCollection()
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateCollectionOpen(false)}>{t("dialogs.createCollection.cancel")}</Button>
            <Button onClick={handleCreateCollection} disabled={!newCollectionName.trim()}>{t("dialogs.createCollection.create")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量移动对话框 - 优化设计 */}
      <Dialog open={showBatchMoveDialog} onOpenChange={setShowBatchMoveDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FolderInput className="h-5 w-5 text-slate-900" />
              {t("dialogs.batchMove.title")}
            </DialogTitle>
            <DialogDescription>
              {t("dialogs.batchMove.description", { count: selectedDocIds.length })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-3">
              <Select
                value={batchTargetCollectionId}
                onValueChange={setBatchTargetCollectionId}
              >
                <SelectTrigger className="w-full h-11 rounded-xl border-slate-200 bg-white hover:bg-slate-50 transition-all">
                  <SelectValue placeholder={t("dialogs.batchMove.placeholderTarget")} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px] rounded-xl border-slate-200 shadow-xl">
                  {flatCollections.map((col: APICollectionTree & { level: number }) => (
                    <SelectItem
                      key={col.id}
                      value={col.id.toString()}
                      className="py-2.5 rounded-lg focus:bg-slate-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {col.level > 0 && (
                          <span className="text-slate-300 select-none">
                            {"　".repeat(col.level)}
                          </span>
                        )}
                        <Folder className={cn(
                          "h-3.5 w-3.5",
                          col.level === 0 ? "text-primary/60" : "text-slate-400"
                        )} />
                        <span className={cn(
                          "font-medium",
                          col.level === 0 ? "text-slate-900" : "text-slate-600"
                        )}>
                          {col.title}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowBatchMoveDialog(false)}
              className="rounded-lg h-9"
            >
              {t("dialogs.batchMove.cancel")}
            </Button>
            <Button
              onClick={confirmBatchMove}
              disabled={!batchTargetCollectionId || batchUpdateMutation.isPending}
              className="bg-slate-900 text-white hover:bg-slate-800 rounded-lg h-9 px-6 flex items-center gap-2"
            >
              {batchUpdateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {batchUpdateMutation.isPending ? t("dialogs.batchMove.moving") : t("dialogs.batchMove.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ChunksViewerDialog viewChunksId={viewChunksId} onClose={() => setViewChunksId(null)} />

      {/* 删除文档确认对话框 */}
      <Dialog open={!!deleteDocTarget} onOpenChange={(open) => !open && setDeleteDocTarget(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              {t("deleteDialog.confirmDeleteDoc")}
            </DialogTitle>
            <DialogDescription asChild className="pt-2 space-y-2">
              <div>
                <p>{t("deleteDialog.descriptionDoc", { name: deleteDocTarget?.title || "" })}</p>
                <p className="text-red-500 bg-red-50 p-2 rounded text-xs">
                  ⚠️ {t("deleteDialog.warningDoc")}
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteDocTarget(null)}>{t("deleteDialog.cancel")}</Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteDocument}
              disabled={deleteDocumentMutation.isPending}
              className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
            >
              {deleteDocumentMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {deleteDocumentMutation.isPending ? t("deleteDialog.deleting") : t("deleteDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量删除文档确认对话框 */}
      <Dialog open={isBatchDeleteOpen} onOpenChange={setIsBatchDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              {t("deleteDialog.confirmDeleteBatch")}
            </DialogTitle>
            <DialogDescription asChild className="pt-2 space-y-2">
              <div>
                <p>{t("deleteDialog.descriptionBatch", { count: selectedDocIds.length })}</p>
                <p className="text-red-500 bg-red-50 p-2 rounded text-xs">
                  ⚠️ {t("deleteDialog.warningBatch")}
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsBatchDeleteOpen(false)}>{t("deleteDialog.cancel")}</Button>
            <Button
              variant="destructive"
              onClick={confirmBatchDelete}
              disabled={batchDeleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
            >
              {batchDeleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {batchDeleteMutation.isPending ? t("deleteDialog.deleting") : t("deleteDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除合集确认对话框 */}
      <Dialog open={!!deleteCollectionTarget} onOpenChange={(open) => !open && setDeleteCollectionTarget(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              {t("deleteDialog.confirmDeleteCollection")}
            </DialogTitle>
            <DialogDescription asChild className="pt-2 space-y-2">
              <div>
                <p>{t("deleteDialog.descriptionCollection", { name: deleteCollectionTarget?.name || "" })}</p>
                <p className="text-red-500 bg-red-50 p-2 rounded text-xs border border-red-100">
                  ⚠️ {t("deleteDialog.warningCollection")}
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteCollectionTarget(null)}>{t("deleteDialog.cancel")}</Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteCollection}
              disabled={deleteCollectionMutation.isPending}
              className="bg-red-600 hover:bg-red-700 flex items-center gap-2"
            >
              {deleteCollectionMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {deleteCollectionMutation.isPending ? t("deleteDialog.deleting") : t("deleteDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
