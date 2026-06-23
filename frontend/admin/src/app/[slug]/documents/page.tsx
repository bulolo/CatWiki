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

import { useTranslations } from "next-intl"

import {
  LoadingState,
  Button,
  Input,
  Card,
  CardContent,
  CardHeader,
  Pagination,
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
} from "@/components/ui"

import Link from "next/link"
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Folder,
  CheckSquare,
  FolderInput,
  Brain,
  Loader2,
  Sparkles,
} from "lucide-react"

import { env } from "@/lib/env"
import { CollectionTree, VectorRetrieveModal, DocumentImportDialog } from "@/components/features/documents"
import { getRoutePath, useRouteContext } from "@/lib/routing"
import { cn } from "@/lib/utils"
import { ChunksViewerDialog } from "./_dialogs/ChunksViewerDialog"
import { NewCollectionDialog } from "./_dialogs/NewCollectionDialog"
import { BatchMoveDialog } from "./_dialogs/BatchMoveDialog"
import { ConfirmDeleteDialog } from "./_dialogs/ConfirmDeleteDialog"
import { useDocumentsPage } from "./_components/useDocumentsPage"
import { BatchActionBar } from "./_components/BatchActionBar"
import { DocumentListTable } from "./_components/DocumentListTable"
import { DocumentGridView } from "./_components/DocumentGridView"

export default function DocumentsPage() {
  const t = useTranslations("Documents")
  const commonT = useTranslations("Common")
  const routeContext = useRouteContext()

  const {
    currentSite, siteId, queryClient, tenantSlug,
    searchTerm,
    selectedCollectionId, setTargetParentId,
    selectedDocumentId,
    isCreateCollectionOpen, setIsCreateCollectionOpen,
    isImportOpen, setIsImportOpen,
    importDefaultTab, setImportDefaultTab,
    newCollectionName, setNewCollectionName,
    showDocuments, setShowDocuments,
    viewMode, setViewMode,
    currentPage, setCurrentPage,
    pageSize, setPageSize,
    status,
    vectorStatus, setVectorStatus,
    selectedDocIds,
    isBatchMode,
    showBatchMoveDialog, setShowBatchMoveDialog,
    batchTargetCollectionId, setBatchTargetCollectionId,
    viewChunksId, setViewChunksId,
    isVectorRetrieveOpen, setIsVectorRetrieveOpen,
    deleteDocTarget, setDeleteDocTarget,
    deleteCollectionTarget, setDeleteCollectionTarget,
    isBatchDeleteOpen, setIsBatchDeleteOpen,
    collectionsTree, collectionsLoading,
    deleteDocumentMutation, batchDeleteMutation, batchUpdateMutation,
    deleteCollectionMutation,
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
  } = useDocumentsPage()

  // 在客户端站点新标签打开文档（列表/网格视图共用）
  const openDocument = (docId: number) => {
    const clientUrl = env.NEXT_PUBLIC_CLIENT_URL
    const slug = routeContext.slug || currentSite.slug || "demo"
    window.open(`${clientUrl}/${tenantSlug}/${slug}?documentId=${docId}`, "_blank")
  }
  const getEditPath = (docId: number) => getRoutePath(`/documents/edit/${docId}`, routeContext.slug)
  const emptyMessage = selectedDocumentId
    ? t("list.noDocFound")
    : selectedCollectionId
      ? t("list.noDocInCollection")
      : searchTerm
        ? t("list.noMatchDoc")
        : t("list.noDoc")

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
        <BatchActionBar
          selectedCount={selectedDocIds.length}
          onMove={handleBatchMove}
          onPublish={handleBatchPublish}
          onUnpublish={handleBatchUnpublish}
          onVectorize={handleBatchVectorize}
          onDelete={handleBatchDelete}
          onExit={toggleBatchMode}
          updatePending={batchUpdateMutation.isPending}
          vectorizePending={batchVectorizeMutation.isPending}
          deletePending={batchDeleteMutation.isPending}
        />
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
                <DocumentListTable
                  documents={documents}
                  isBatchMode={isBatchMode}
                  selectedDocIds={selectedDocIds}
                  currentPage={currentPage}
                  pageSize={pageSize}
                  onToggleSelectAll={toggleSelectAll}
                  onToggleDocSelection={toggleDocSelection}
                  onSort={handleSort}
                  getSortIcon={getSortIcon}
                  vectorizeMutation={vectorizeMutation}
                  removeVectorMutation={removeVectorMutation}
                  onViewChunks={setViewChunksId}
                  onOpenDocument={openDocument}
                  getEditPath={getEditPath}
                  onDeleteDocument={handleDeleteDocument}
                  emptyMessage={emptyMessage}
                />
              )}

              {viewMode === "grid" && (
                <DocumentGridView
                  documents={documents}
                  loading={loading}
                  onOpenDocument={openDocument}
                  getEditPath={getEditPath}
                  onDeleteDocument={handleDeleteDocument}
                  emptyMessage={emptyMessage}
                />
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

      <NewCollectionDialog
        open={isCreateCollectionOpen}
        onOpenChange={setIsCreateCollectionOpen}
        name={newCollectionName}
        onNameChange={setNewCollectionName}
        onCreate={handleCreateCollection}
      />

      <BatchMoveDialog
        open={showBatchMoveDialog}
        onOpenChange={setShowBatchMoveDialog}
        count={selectedDocIds.length}
        flatCollections={flatCollections}
        value={batchTargetCollectionId}
        onValueChange={setBatchTargetCollectionId}
        onConfirm={confirmBatchMove}
        isPending={batchUpdateMutation.isPending}
      />

      <ChunksViewerDialog viewChunksId={viewChunksId} onClose={() => setViewChunksId(null)} />

      <ConfirmDeleteDialog
        open={!!deleteDocTarget}
        onOpenChange={(open) => !open && setDeleteDocTarget(null)}
        title={t("deleteDialog.confirmDeleteDoc")}
        description={t("deleteDialog.descriptionDoc", { name: deleteDocTarget?.title || "" })}
        warning={t("deleteDialog.warningDoc")}
        isPending={deleteDocumentMutation.isPending}
        onConfirm={confirmDeleteDocument}
      />

      <ConfirmDeleteDialog
        open={isBatchDeleteOpen}
        onOpenChange={setIsBatchDeleteOpen}
        title={t("deleteDialog.confirmDeleteBatch")}
        description={t("deleteDialog.descriptionBatch", { count: selectedDocIds.length })}
        warning={t("deleteDialog.warningBatch")}
        isPending={batchDeleteMutation.isPending}
        onConfirm={confirmBatchDelete}
      />

      <ConfirmDeleteDialog
        open={!!deleteCollectionTarget}
        onOpenChange={(open) => !open && setDeleteCollectionTarget(null)}
        title={t("deleteDialog.confirmDeleteCollection")}
        description={t("deleteDialog.descriptionCollection", { name: deleteCollectionTarget?.name || "" })}
        warning={t("deleteDialog.warningCollection")}
        isPending={deleteCollectionMutation.isPending}
        onConfirm={confirmDeleteCollection}
        warningBordered
      />
    </div>
  )
}
