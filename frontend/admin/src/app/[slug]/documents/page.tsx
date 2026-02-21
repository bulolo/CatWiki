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

import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"

import { useState, useMemo } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Pagination } from "@/components/ui/pagination"
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
  ChevronLeft,
  Brain,
  Loader2,
  Sparkles
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
  documentKeys,
  useVectorizeDocument,
  useBatchVectorizeDocuments,
  useRemoveVector,
  VectorStatus
} from "@/hooks"
import { env } from "@/lib/env"
import { CollectionTree } from "@/components/features/documents/CollectionTree"
import { VectorRetrieveModal } from "@/components/features/documents/VectorRetrieveModal"
import type { CollectionItem } from "@/types"
import { getRoutePath, useRouteContext } from "@/lib/routing"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { type Document, type CollectionTree as APICollectionTree, DocumentStatus } from "@/lib/api-client"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { OptimizedImage } from "@/components/ui/OptimizedImage"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { ScrollArea } from "@/components/ui/scroll-area"


import { DocumentUploadDialog } from "@/components/features/documents/DocumentUploadDialog"

// 转换集合树为 CollectionItem 的辅助函数
const convertToCollectionItems = (tree: APICollectionTree[]): CollectionItem[] => {
  if (!tree || tree.length === 0) return []
  return tree.map(col => ({
    id: col.id.toString(),
    name: col.title,
    type: col.type as 'collection' | 'document',
    children: col.children?.length
      ? convertToCollectionItems(col.children)
      : [],
    status: col.status || undefined,
    views: col.views || undefined,
    tags: col.tags || undefined
  }))
}

export default function DocumentsPage() {
  const routeContext = useRouteContext()
  const currentSite = useSiteData()
  const siteId = currentSite.id
  const queryClient = useQueryClient()

  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearchTerm = useDebounce(searchTerm, 500)
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | undefined>()
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | undefined>()
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false)
  const [isDocumentUploadOpen, setIsDocumentUploadOpen] = useState(false) // New state
  const [newCollectionName, setNewCollectionName] = useState("")

  const [targetParentId, setTargetParentId] = useState<number | undefined>()
  const [showDocuments, setShowDocuments] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'views'>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [status, setStatus] = useState<'all' | 'published' | 'draft'>('all')
  const [vectorStatus, setVectorStatus] = useState<'all' | 'none' | 'pending' | 'processing' | 'completed' | 'failed'>('all')

  // 批量操作状态
  const [selectedDocIds, setSelectedDocIds] = useState<number[]>([])
  const [isBatchMode, setIsBatchMode] = useState(false)
  const [showBatchMoveDialog, setShowBatchMoveDialog] = useState(false)
  const [batchTargetCollectionId, setBatchTargetCollectionId] = useState<string>("")

  // 查看分片状态
  const [viewChunksId, setViewChunksId] = useState<number | null>(null)
  const [focusedChunk, setFocusedChunk] = useState<any | null>(null)
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
    status: status !== 'all' ? status : undefined,
    vectorStatus: vectorStatus !== 'all' ? vectorStatus : undefined,
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

  // 获取文档分片
  const { data: chunksData, isLoading: chunksLoading } = useQuery({
    queryKey: ['document-chunks', viewChunksId],
    queryFn: async () => {
      if (!viewChunksId) return null
      return api.document.listChunks(viewChunksId)
    },

    enabled: !!viewChunksId
  })

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

  const handleSort = (field: 'created_at' | 'updated_at' | 'views') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const getSortIcon = (field: 'created_at' | 'updated_at' | 'views') => {
    if (sortBy !== field) return <ArrowUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-50" />
    return sortOrder === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" />
    )
  }

  // 渲染向量化状态
  const renderVectorStatus = (doc: Document) => {
    const vectorStatus = doc.vector_status || VectorStatus.NONE
    const vectorError = doc.vector_error

    switch (vectorStatus) {
      case VectorStatus.NONE:
        return (
          <button
            onClick={() => vectorizeMutation.mutate(doc.id)}
            disabled={vectorizeMutation.isPending}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-slate-400 hover:text-primary hover:bg-primary/5 transition-all whitespace-nowrap flex-shrink-0"
          >
            <Brain className="h-3 w-3 flex-shrink-0" />
            <span>未学习</span>
          </button>
        )
      case VectorStatus.PENDING:
        return (
          <Badge
            variant="outline"
            className="inline-flex items-center text-[10px] font-bold px-1.5 py-0 h-4.5 border-none bg-amber-50 text-amber-600 shadow-none cursor-pointer hover:bg-amber-100 whitespace-nowrap flex-shrink-0"
            onClick={() => removeVectorMutation.mutate(doc.id)}
            title="点击取消"
          >
            <Clock className="h-2.5 w-2.5 mr-0.5 flex-shrink-0" />
            排队中
          </Badge>
        )
      case VectorStatus.PROCESSING:
        return (
          <Badge
            variant="outline"
            className="inline-flex items-center text-[10px] font-bold px-1.5 py-0 h-4.5 border-none bg-blue-50 text-blue-600 shadow-none whitespace-nowrap flex-shrink-0"
          >
            <Loader2 className="h-2.5 w-2.5 mr-0.5 flex-shrink-0 animate-spin" />
            学习中
          </Badge>
        )
      case VectorStatus.COMPLETED:
        return (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => vectorizeMutation.mutate(doc.id)}
              disabled={vectorizeMutation.isPending}
              className="group/relearn inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-200 border border-emerald-100/50 hover:border-emerald-200 shadow-sm active:scale-95 transition-all whitespace-nowrap flex-shrink-0 cursor-pointer min-w-[60px]"
              title="已学习，点击重新学习"
            >
              <span className="flex items-center gap-1 group-hover/relearn:hidden">
                <Brain className="h-2.5 w-2.5 mr-0.5 flex-shrink-0" />
                <span>已学习</span>
              </span>
              <span className="hidden group-hover/relearn:flex items-center gap-1">
                <RefreshCw className="h-2.5 w-2.5 mr-0.5 flex-shrink-0" />
                <span>重学</span>
              </span>
            </button>

            {/* 查看分片 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                setViewChunksId(doc.id)
              }}
              className="p-1 rounded-md text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
              title="查看向量分片"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>

            {/* 删除向量 */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (confirm('确定要删除该文档的向量数据吗？删除后文档将变为“未学习”状态。')) {
                  removeVectorMutation.mutate(doc.id)
                }
              }}
              disabled={removeVectorMutation.isPending}
              className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="删除向量数据"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      case VectorStatus.FAILED:
        return (
          <button
            onClick={() => vectorizeMutation.mutate(doc.id)}
            disabled={vectorizeMutation.isPending}
            className="inline-flex items-center gap-1 whitespace-nowrap flex-shrink-0"
            title={vectorError || '学习失败，点击重试'}
          >
            <Badge
              variant="outline"
              className="inline-flex items-center text-[10px] font-bold px-1.5 py-0 h-4.5 border-none bg-red-50 text-red-500 shadow-none whitespace-nowrap"
            >
              <AlertCircle className="h-2.5 w-2.5 mr-0.5 flex-shrink-0" />
              失败
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

    createCollectionMutation.mutate({
      site_id: siteId,
      title: newCollectionName.trim(),
      parent_id: targetParentId
    } as any, {
      onSuccess: () => {
        setIsCreateCollectionOpen(false)
        setNewCollectionName("")
        setTargetParentId(undefined)
        refetchCollections()
      }
    })
  }

  const handleRenameCollection = async (id: string, newName: string) => {
    updateCollectionMutation.mutate({
      id: parseInt(id),
      data: { title: newName }
    } as any, {
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
    console.log('==================== 开始移动合集 ====================')
    console.log('🔄 移动合集:', { collectionId, targetParentId, insertBeforeId })

    if (!collectionId) {
      console.error('❌ 没有 collectionId！')
      return
    }

    try {
      const collectionIdNum = parseInt(collectionId)
      const targetParentIdNum = targetParentId ? parseInt(targetParentId) : null

      // 获取目标父级下的所有兄弟集合（用于计算插入位置）
      const { api } = await import("@/lib/api-client")

      const siblingsRaw = await api.collection.list({
        siteId,
        parentId: targetParentIdNum === null ? undefined : targetParentIdNum
      })

      // 过滤掉当前拖拽的合集，按 order 排序
      const siblings = siblingsRaw
        .filter((c: any) => c.id !== collectionIdNum)
        .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))


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
      await api.collection.moveCollection({
        collectionId: collectionIdNum,
        requestBody: {
          target_parent_id: targetParentIdNum,
          target_position: targetPosition
        }
      })


      toast.success('合集移动成功')

      // 刷新合集树
      refetchCollections()

      // 刷新文档列表，因为合集结构改变了，文档列表可能受影响
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() })

      // 如果当前选中的是移动的合集或其子合集，强制刷新文档列表
      // 通过重新设置 selectedCollectionId 来触发文档列表的重新获取
      if (selectedCollectionId) {
        const currentId = selectedCollectionId
        // 先清除，然后立即恢复，触发 React Query 重新获取数据
        setSelectedCollectionId(undefined)
        // 使用 setTimeout 确保状态更新完成后再恢复
        setTimeout(() => {
          setSelectedCollectionId(currentId)
        }, 50)
      }

    } catch (error: any) {
      console.error('❌ 移动合集出错:', error)
      toast.error(error.message || '移动合集失败')
    }

    console.log('==================== 结束移动合集 ====================')
  }

  const handleDeleteCollection = async (id: string, name: string) => {
    setDeleteCollectionTarget({ id, name })
  }

  const confirmDeleteCollection = () => {
    if (!deleteCollectionTarget) return

    deleteCollectionMutation.mutate(parseInt(deleteCollectionTarget.id), {
      onSuccess: () => {
        if (selectedCollectionId === deleteCollectionTarget.id) {
          setSelectedCollectionId(undefined)
        }
        refetchCollections()
        setDeleteCollectionTarget(null)
      }
    })
  }

  const handleDeleteDocument = async (id: number, title: string) => {
    setDeleteDocTarget({ id, title })
  }

  const confirmDeleteDocument = () => {
    if (!deleteDocTarget) return
    deleteDocumentMutation.mutate(deleteDocTarget.id, {
      onSuccess: () => {
        setDeleteDocTarget(null)
      }
    })
  }

  const findNodeType = (items: CollectionItem[], targetId: string): 'collection' | 'document' | null => {
    for (const item of items) {
      if (item.id === targetId) {
        return item.type || 'collection'
      }
      if (item.children && item.children.length > 0) {
        const found = findNodeType(item.children, targetId)
        if (found) return found
      }
    }
    return null
  }

  const handleNodeSelect = (id: string | undefined) => {
    if (!id) {
      setSelectedCollectionId(undefined)
      setSelectedDocumentId(undefined)
      setCurrentPage(1)
      // 刷新文档列表
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() })
      return
    }

    const nodeType = findNodeType(collections, id)
    if (nodeType === 'document') {
      setSelectedDocumentId(id)
      setSelectedCollectionId(undefined)
      setCurrentPage(1)
    } else {
      // 选中合集时，刷新文档列表以确保显示最新数据
      setSelectedCollectionId(id)
      setSelectedDocumentId(undefined)
      setCurrentPage(1)
      // 强制刷新文档列表，因为合集结构可能已经改变
      queryClient.invalidateQueries({ queryKey: documentKeys.lists() })
    }
  }

  const handleSearchChange = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  const handleStatusFilterChange = (value: 'all' | 'published' | 'draft') => {
    setStatus(value)
    setCurrentPage(1)
  }

  // 批量操作处理函数
  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode)
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
      toast.error('请选择要删除的文档')
      return
    }
    setIsBatchDeleteOpen(true)
  }

  const confirmBatchDelete = () => {
    batchDeleteMutation.mutate(selectedDocIds, {
      onSuccess: () => {
        setSelectedDocIds([])
        setIsBatchMode(false)
        setIsBatchDeleteOpen(false)
      }
    })
  }

  const handleBatchMove = () => {
    if (selectedDocIds.length === 0) {
      toast.error('请选择要移动的文档')
      return
    }
    setShowBatchMoveDialog(true)
  }

  const confirmBatchMove = () => {
    if (!batchTargetCollectionId) {
      toast.error('请选择目标合集')
      return
    }

    batchUpdateMutation.mutate({
      documentIds: selectedDocIds,
      data: { collection_id: parseInt(batchTargetCollectionId) }
    }, {
      onSuccess: () => {
        setSelectedDocIds([])
        setIsBatchMode(false)
        setShowBatchMoveDialog(false)
        setBatchTargetCollectionId("")
      }
    })
  }



  const handleBatchPublish = () => {
    if (selectedDocIds.length === 0) {
      toast.error('请选择要发布的文档')
      return
    }

    batchUpdateMutation.mutate({
      documentIds: selectedDocIds,
      data: { status: DocumentStatus.PUBLISHED }
    }, {
      onSuccess: () => {
        setSelectedDocIds([])
      }
    })
  }

  const handleBatchUnpublish = () => {
    if (selectedDocIds.length === 0) {
      toast.error('请选择要取消发布的文档')
      return
    }

    batchUpdateMutation.mutate({
      documentIds: selectedDocIds,
      data: { status: DocumentStatus.DRAFT }
    }, {
      onSuccess: () => {
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
      <DocumentUploadDialog
        open={isDocumentUploadOpen}
        onOpenChange={setIsDocumentUploadOpen}
        siteId={siteId}
        collections={collections}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: documentKeys.lists() })
          // 如果是在特定合集下上传，也刷新合集树
          queryClient.invalidateQueries({ queryKey: ['collection-tree', siteId] })
        }}
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between shrink-0 px-1 gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            文档管理
          </h1>
          <p className="text-slate-500 mt-1 md:mt-2 text-sm md:text-base hidden sm:block">在这里管理您的所有百科文档，支持目录化操作。</p>
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
              <span className="hidden sm:inline">批量操作</span>
              <span className="sm:hidden">批量</span>
            </Button>
          )}
          {/* Import Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsDocumentUploadOpen(true)}
            className="gap-1.5 md:gap-2 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50 transition-all duration-200"
          >
            <FolderInput className="h-4 w-4" />
            <span className="hidden sm:inline">导入文档</span>
            <span className="sm:hidden">导入</span>
          </Button>
          <Link href={getRoutePath("/documents/new", routeContext.slug)}>
            <Button size="sm" className="flex items-center gap-1.5 md:gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">发布文档</span>
              <span className="sm:hidden">发布</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsVectorRetrieveOpen(true)}
            className="flex items-center gap-1.5 md:gap-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 transition-all shadow-sm"
          >
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">向量检索</span>
            <span className="sm:hidden">检索</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const clientUrl = env.NEXT_PUBLIC_CLIENT_URL
              window.open(`${clientUrl}/${currentSite.slug}`, '_blank')
            }}
            className="flex items-center gap-1.5 md:gap-2 border-purple-200 text-purple-600 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 transition-all shadow-sm"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">AI 问答</span>
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
                <span className="text-xs md:text-sm font-semibold text-slate-600 tracking-tight hidden sm:inline">已选择</span>
              </div>

              {/* 操作按钮组 */}
              <div className="flex items-center gap-0.5 md:gap-1 flex-1 md:flex-none overflow-x-auto">
                {selectedDocIds.length > 0 ? (
                  <>
                    <button
                      onClick={handleBatchMove}
                      disabled={batchUpdateMutation.isPending}
                      className="flex items-center gap-1 md:gap-2 px-2 md:px-3.5 py-1.5 md:py-2 hover:bg-slate-50 active:bg-slate-100 rounded-lg md:rounded-xl text-xs md:text-sm font-medium text-slate-700 transition-all disabled:opacity-50 group whitespace-nowrap"
                      title="移动"
                    >
                      <FolderInput className="h-3.5 w-3.5 md:h-4 md:w-4 text-slate-400 group-hover:text-primary transition-colors" />
                      <span className="hidden md:inline">移动</span>
                    </button>
                    <button
                      onClick={handleBatchPublish}
                      disabled={batchUpdateMutation.isPending}
                      className="flex items-center gap-1 md:gap-2 px-2 md:px-3.5 py-1.5 md:py-2 hover:bg-emerald-50 active:bg-emerald-100 rounded-lg md:rounded-xl text-xs md:text-sm font-medium text-emerald-600 transition-all disabled:opacity-50 whitespace-nowrap"
                      title="发布"
                    >
                      <Send className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      <span className="hidden md:inline">发布</span>
                    </button>
                    <button
                      onClick={handleBatchUnpublish}
                      disabled={batchUpdateMutation.isPending}
                      className="flex items-center gap-1 md:gap-2 px-2 md:px-3.5 py-1.5 md:py-2 hover:bg-amber-50 active:bg-amber-100 rounded-lg md:rounded-xl text-xs md:text-sm font-medium text-amber-600 transition-all disabled:opacity-50 whitespace-nowrap"
                      title="草稿"
                    >
                      <Archive className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      <span className="hidden md:inline">草稿</span>
                    </button>
                    <button
                      onClick={handleBatchVectorize}
                      disabled={batchVectorizeMutation.isPending}
                      className="flex items-center gap-1 md:gap-2 px-2 md:px-3.5 py-1.5 md:py-2 hover:bg-blue-50 active:bg-blue-100 rounded-lg md:rounded-xl text-xs md:text-sm font-medium text-blue-600 transition-all disabled:opacity-50 whitespace-nowrap"
                      title="学习"
                    >
                      <Brain className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      <span className="hidden md:inline">学习</span>
                    </button>
                    <button
                      onClick={handleBatchDelete}
                      disabled={batchDeleteMutation.isPending}
                      className="flex items-center gap-1 md:gap-2 px-2 md:px-3.5 py-1.5 md:py-2 hover:bg-red-50 active:bg-red-100 rounded-lg md:rounded-xl text-xs md:text-sm font-medium text-red-500 transition-all disabled:opacity-50 whitespace-nowrap"
                      title="删除"
                    >
                      <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4" />
                      <span className="hidden md:inline">删除</span>
                    </button>
                  </>
                ) : (
                  <span className="text-[10px] md:text-xs text-slate-400 px-2 md:px-6 py-1.5 md:py-2">请勾选文档</span>
                )}
              </div>

              <div className="w-px h-4 md:h-5 bg-slate-100 mx-0.5 md:mx-1" />

              {/* 退出按钮 */}
              <button
                onClick={toggleBatchMode}
                className="flex items-center justify-center w-7 h-7 md:w-9 md:h-9 hover:bg-slate-50 active:bg-slate-100 rounded-lg md:rounded-xl text-slate-400 hover:text-slate-600 transition-all shrink-0"
                title="退出批量操作"
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
                      <SheetTitle className="sr-only">合集目录</SheetTitle>
                      <SheetDescription className="sr-only">
                        这里显示了当前站点的合集目录结构，点击可筛选文档。
                      </SheetDescription>
                      <CollectionTree
                        items={collections}
                        selectedId={selectedCollectionId || selectedDocumentId}
                        onSelect={(id) => {
                          handleNodeSelect(id)
                        }}
                        onCreateCollection={(parentId) => {
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
                          ? "已选中文档"
                          : selectedCollectionId
                            ? "在当前目录下搜索..."
                            : "搜索文档..."
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
                        viewMode === 'list' ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-600"
                      )}
                      onClick={() => setViewMode('list')}
                      title="列表视图"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8 rounded-md transition-all",
                        viewMode === 'grid' ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-600"
                      )}
                      onClick={() => setViewMode('grid')}
                      title="网格视图"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* 第二行：筛选器 */}
                <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                  {/* 状态筛选器 */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 whitespace-nowrap">状态:</span>
                    <Select value={status} onValueChange={handleStatusFilterChange}>
                      <SelectTrigger className="w-[90px] md:w-[100px] bg-white border-slate-200 shadow-sm h-8 md:h-9 rounded-lg text-xs md:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="published">已发布</SelectItem>
                        <SelectItem value="draft">草稿</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 学习状态筛选器 */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 whitespace-nowrap">学习:</span>
                    <Select value={vectorStatus} onValueChange={(value: any) => {
                      setVectorStatus(value)
                      setCurrentPage(1)
                    }}>
                      <SelectTrigger className="w-[90px] md:w-[100px] bg-white border-slate-200 shadow-sm h-8 md:h-9 rounded-lg text-xs md:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部</SelectItem>
                        <SelectItem value="none">未学习</SelectItem>
                        <SelectItem value="pending">排队中</SelectItem>
                        <SelectItem value="processing">学习中</SelectItem>
                        <SelectItem value="completed">已学习</SelectItem>
                        <SelectItem value="failed">失败</SelectItem>
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
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <div className="text-sm text-muted-foreground">加载中...</div>
                  </div>
                </div>
              )}

              {viewMode === 'list' && (
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
                        <TableHead className="w-[300px] font-medium text-[11px] uppercase tracking-wider text-slate-400 min-w-[200px]">标题内容</TableHead>
                        <TableHead className="w-[120px] font-medium text-[11px] uppercase tracking-wider text-slate-400 hidden lg:table-cell">所在合集</TableHead>
                        <TableHead className="w-[80px] font-medium text-[11px] uppercase tracking-wider text-slate-400">状态</TableHead>
                        <TableHead className="w-[90px] font-medium text-[11px] uppercase tracking-wider text-slate-400 hidden xl:table-cell">学习</TableHead>
                        <TableHead className="w-[80px] hidden lg:table-cell">
                          <button
                            className="group flex items-center gap-1 hover:text-slate-600 transition-colors font-medium text-[11px] uppercase tracking-wider text-slate-400"
                            onClick={() => handleSort('views')}
                          >
                            浏览
                            {getSortIcon('views')}
                          </button>
                        </TableHead>
                        <TableHead className="w-[100px] hidden 2xl:table-cell">
                          <button
                            className="group flex items-center gap-1 hover:text-slate-600 transition-colors font-medium text-[11px] uppercase tracking-wider text-slate-400"
                            onClick={() => handleSort('created_at')}
                          >
                            创建时间
                            {getSortIcon('created_at')}
                          </button>
                        </TableHead>
                        <TableHead className="w-[100px] hidden md:table-cell">
                          <button
                            className="group flex items-center gap-1 hover:text-slate-600 transition-colors font-medium text-[11px] uppercase tracking-wider text-slate-400"
                            onClick={() => handleSort('updated_at')}
                          >
                            更新时间
                            {getSortIcon('updated_at')}
                          </button>
                        </TableHead>
                        <TableHead className="w-[80px] text-right pr-6 font-medium text-[11px] uppercase tracking-wider text-slate-400 sticky right-0 z-20 bg-slate-50/95 backdrop-blur">操作</TableHead>
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
                                      const slug = routeContext.slug || currentSite.slug || 'demo'
                                      window.open(`${clientUrl}/${slug}?documentId=${doc.id}`, '_blank')
                                    }}
                                  >
                                    {doc.title}
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                                    <span className="hidden sm:inline">{doc.reading_time || 0} 分钟</span>
                                    <span className={cn("sm:hidden", doc.status === "published" ? "text-emerald-500" : "text-amber-500")}>
                                      {doc.status === "published" ? "已发布" : "草稿"}
                                    </span>
                                    {doc.tags && doc.tags.length > 0 && (
                                      <>
                                        <span className="w-0.5 h-0.5 rounded-full bg-slate-300 hidden sm:block" />
                                        <span className="truncate max-w-[100px]">{doc.tags.join(', ')}</span>
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
                                  {doc.collection?.title || '根目录'}
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
                                {doc.status === "published" ? "已发布" : "草稿"}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3 hidden xl:table-cell">
                              {renderVectorStatus(doc)}
                            </TableCell>
                            <TableCell className="py-3 text-slate-500 tabular-nums text-[12px] font-medium hidden lg:table-cell">
                              {(doc.views || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="py-3 text-slate-400 text-[11px] font-medium whitespace-nowrap hidden 2xl:table-cell">
                              {new Date(doc.created_at).toLocaleString('zh-CN', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                              }).replace(/\//g, '-')}
                            </TableCell>
                            <TableCell className="py-3 text-slate-400 text-[11px] font-medium whitespace-nowrap hidden md:table-cell">
                              {new Date(doc.updated_at).toLocaleString('zh-CN', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                              }).replace(/\//g, '-')}
                            </TableCell>
                            <TableCell className="py-3 text-right pr-6 sticky right-0 z-10 bg-white group-hover:bg-slate-50/50">
                              <div className="flex justify-end gap-0.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                <Link href={getRoutePath(`/documents/edit/${doc.id}`, routeContext.slug)}>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100" title="编辑">
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                </Link>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                                  title="删除"
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
                                  ? "未找到该文档"
                                  : selectedCollectionId
                                    ? "该目录下暂无文档"
                                    : searchTerm
                                      ? "未找到匹配的文档"
                                      : "暂无文档"}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {viewMode === 'grid' && (
                <div className={cn("p-4", loading && "opacity-40")}>
                  {documents.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 items-stretch">
                      {documents.map((doc: Document) => (
                        <div
                          key={doc.id}
                          className="group flex flex-col h-full bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                        >
                          <div
                            className="relative w-full aspect-[3/2] overflow-hidden bg-slate-50 cursor-pointer shrink-0"
                            onClick={() => {
                              const clientUrl = process.env.NEXT_PUBLIC_CLIENT_URL || 'http://localhost:8002'
                              const slug = routeContext.slug || currentSite.slug || 'demo'
                              window.open(`${clientUrl}/${slug}?documentId=${doc.id}`, '_blank')
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
                                  已发布
                                </div>
                              ) : (
                                <div className="px-2 py-0.5 rounded bg-slate-500/90 backdrop-blur-sm text-white text-xs font-medium">
                                  草稿
                                </div>
                              )}
                              {doc.vector_status === VectorStatus.COMPLETED && (
                                <div className="px-2 py-0.5 rounded bg-blue-500/90 backdrop-blur-sm text-white text-xs font-medium">
                                  已学习
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="p-3 flex flex-col flex-1 min-h-0">
                            <h3
                              className="text-sm font-bold text-slate-900 mb-1.5 line-clamp-2 leading-snug cursor-pointer hover:text-primary transition-colors shrink-0"
                              onClick={() => {
                                const clientUrl = process.env.NEXT_PUBLIC_CLIENT_URL || 'http://localhost:8002'
                                const slug = routeContext.slug || currentSite.slug || 'demo'
                                window.open(`${clientUrl}/${slug}?documentId=${doc.id}`, '_blank')
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
                                  无摘要
                                </p>
                              )}
                            </div>

                            <div className="space-y-1.5 mb-2 shrink-0">
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Folder className="h-3 w-3 shrink-0" />
                                <span className="truncate">{doc.collection?.title || '根目录'}</span>
                              </div>

                              <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                                <div className="flex items-center gap-1">
                                  <Eye className="h-3 w-3 opacity-60" />
                                  <span>{doc.views || 0}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 opacity-60" />
                                  <span>{doc.reading_time || 0} 分钟</span>
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
                                  编辑
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
                          ? "未找到该文档"
                          : selectedCollectionId
                            ? "该目录下暂无文档"
                            : searchTerm
                              ? "未找到匹配的文档"
                              : "暂无文档"}
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
            <DialogTitle>新建目录</DialogTitle>
            <DialogDescription>
              创建一个新的目录，以便更好地组织文档。
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">目录名称</label>
              <Input
                placeholder="输入目录名称..."
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateCollection()
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateCollectionOpen(false)}>取消</Button>
            <Button onClick={handleCreateCollection} disabled={!newCollectionName.trim()}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 批量移动对话框 - 优化设计 */}
      <Dialog open={showBatchMoveDialog} onOpenChange={setShowBatchMoveDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FolderInput className="h-5 w-5 text-slate-900" />
              批量移动文档
            </DialogTitle>
            <DialogDescription>
              将选中的 <span className="font-bold text-slate-900 mx-1">{selectedDocIds.length}</span> 个文档移动到新合集
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-3">
              <Select
                value={batchTargetCollectionId}
                onValueChange={setBatchTargetCollectionId}
              >
                <SelectTrigger className="w-full h-11 rounded-xl border-slate-200 bg-white hover:bg-slate-50 transition-all">
                  <SelectValue placeholder="📁 请选择目标合集..." />
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
                            {'　'.repeat(col.level)}
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
              取消
            </Button>
            <Button
              onClick={confirmBatchMove}
              disabled={!batchTargetCollectionId || batchUpdateMutation.isPending}
              className="bg-slate-900 text-white hover:bg-slate-800 rounded-lg h-9 px-6"
            >
              {batchUpdateMutation.isPending ? '移动中...' : '确认移动'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!viewChunksId} onOpenChange={(open) => {
        if (!open) {
          setViewChunksId(null)
          setFocusedChunk(null)
        }
      }}>
        <DialogContent className="sm:max-w-[1000px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
            {focusedChunk ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 -ml-2 mr-1 text-slate-500 hover:text-slate-900"
                  onClick={() => setFocusedChunk(null)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <span className="font-mono bg-primary/10 text-primary px-2 py-0.5 rounded text-sm">
                    #{focusedChunk.metadata?.chunk_index ?? '?'}
                  </span>
                  分片详情
                </DialogTitle>
                <DialogDescription className="font-mono text-xs ml-auto">
                  Chunk ID: {focusedChunk.id}
                </DialogDescription>
              </div>
            ) : (
              <>
                <DialogTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  向量分片详情
                </DialogTitle>
                <DialogDescription>
                  查看文档在向量数据库中的实际存储片段 (ID: {viewChunksId})
                </DialogDescription>
              </>
            )}
          </DialogHeader>

          <div className="flex-1 min-h-0 bg-slate-50/30 relative">
            {focusedChunk ? (
              <div className="absolute inset-0 bg-white flex flex-col">
                <ScrollArea className="flex-1 p-6">
                  <div className="font-mono text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words max-w-4xl mx-auto">
                    {focusedChunk.content}
                  </div>
                </ScrollArea>
                <div className="px-6 py-2 bg-slate-50/50 border-t border-slate-100 text-xs text-slate-400 font-mono flex justify-between shrink-0">
                  <span>Index: {focusedChunk.metadata?.chunk_index}</span>
                  <span>Length: {focusedChunk.content?.length} chars</span>
                </div>
              </div>
            ) : chunksLoading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                <p className="text-sm">正在加载分片数据...</p>
              </div>
            ) : !chunksData || chunksData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
                <FileText className="h-10 w-10 opacity-20" />
                <p className="text-sm">暂无分片数据</p>
              </div>
            ) : (
              <ScrollArea className="h-full p-4 md:p-6 text-left">
                <div className="space-y-4 pb-4">
                  <div className="flex items-center justify-between px-1 pb-2">
                    <Badge variant="outline" className="bg-white">
                      共 {chunksData.length} 个分片
                    </Badge>
                    <div className="text-xs text-slate-400">
                      点击卡片查看完整内容
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {chunksData.map((chunk: any, index: number) => (
                      <div
                        key={chunk.id || index}
                        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden group hover:border-primary/50 hover:shadow-md transition-all cursor-pointer flex flex-col h-40"
                        onClick={() => setFocusedChunk(chunk)}
                      >
                        <div className="px-3 py-2 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between text-[10px] text-slate-500 shrink-0">
                          <span className="font-mono bg-slate-200/50 px-1.5 py-0.5 rounded text-slate-600">
                            #{chunk.metadata?.chunk_index ?? index}
                          </span>
                          <span className="font-mono truncate max-w-[80px]">
                            {chunk.content?.length || 0} chars
                          </span>
                        </div>
                        <div className="p-3 text-[11px] text-slate-600 leading-relaxed font-mono whitespace-pre-wrap break-words bg-white flex-1 overflow-hidden relative">
                          <div className="line-clamp-6 opacity-80 group-hover:opacity-100 transition-opacity">
                            {chunk.content}
                          </div>
                          {/* 遮罩提示 */}
                          <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                            <span className="text-[10px] text-primary bg-primary/5 px-2 py-0.5 rounded-full font-medium">点击查看详情</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-white shrink-0">
            <Button onClick={() => setViewChunksId(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除文档确认对话框 */}
      <Dialog open={!!deleteDocTarget} onOpenChange={(open) => !open && setDeleteDocTarget(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              确认删除文档?
            </DialogTitle>
            <DialogDescription className="pt-2 space-y-2">
              <p>您即将删除文档 <span className="font-bold text-slate-900">&quot;{deleteDocTarget?.title}&quot;</span>。</p>
              <p className="text-red-500 bg-red-50 p-2 rounded text-xs">
                ⚠️ 此操作将永久删除该文档及其所有历史记录，无法恢复。
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteDocTarget(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteDocument}
              disabled={deleteDocumentMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteDocumentMutation.isPending ? "删除中..." : "确认删除"}
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
              确认批量删除?
            </DialogTitle>
            <DialogDescription className="pt-2 space-y-2">
              <p>您即将删除选中的 <span className="font-bold text-slate-900">{selectedDocIds.length}</span> 个文档。</p>
              <p className="text-red-500 bg-red-50 p-2 rounded text-xs">
                ⚠️ 此操作将永久删除这些文档，无法恢复。
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsBatchDeleteOpen(false)}>取消</Button>
            <Button
              variant="destructive"
              onClick={confirmBatchDelete}
              disabled={batchDeleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {batchDeleteMutation.isPending ? "删除中..." : "确认删除"}
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
              确认删除合集?
            </DialogTitle>
            <DialogDescription className="pt-2 space-y-2">
              <p>您即将删除合集 <span className="font-bold text-slate-900">&quot;{deleteCollectionTarget?.name}&quot;</span>。</p>
              <p className="text-red-500 bg-red-50 p-2 rounded text-xs border border-red-100">
                ⚠️ 警告：该合集下的所有文档和子合集也将被一并删除，且无法恢复！
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteCollectionTarget(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteCollection}
              disabled={deleteCollectionMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteCollectionMutation.isPending ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
