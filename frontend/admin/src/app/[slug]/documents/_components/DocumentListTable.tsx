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

import type { ReactNode } from "react"
import Link from "next/link"
import { useTranslations, useLocale } from "next-intl"
import { CheckSquare, Edit2, FileText, Folder, Square, Trash2 } from "lucide-react"
import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui"
import { OptimizedImage } from "@/components/common"
import type { useVectorizeDocument, useRemoveVector } from "@/hooks"
import type { Document } from "@/lib/sdk/sdk.schemas"
import { cn } from "@/lib/utils"
import { VectorStatusCell } from "./VectorStatusCell"

type SortField = "created_at" | "updated_at" | "views"

interface DocumentListTableProps {
  documents: Document[]
  isBatchMode: boolean
  selectedDocIds: number[]
  currentPage: number
  pageSize: number
  onToggleSelectAll: () => void
  onToggleDocSelection: (docId: number) => void
  onSort: (field: SortField) => void
  getSortIcon: (field: SortField) => ReactNode
  vectorizeMutation: ReturnType<typeof useVectorizeDocument>
  removeVectorMutation: ReturnType<typeof useRemoveVector>
  onViewChunks: (docId: number) => void
  onOpenDocument: (docId: number) => void
  getEditPath: (docId: number) => string
  onDeleteDocument: (id: number, title: string) => void
  emptyMessage: string
}

/** 紧凑日期格式（MM-DD HH:mm，24 小时制），列表视图的创建/更新时间共用。 */
function formatShortDateTime(value: string, locale: string): string {
  return new Date(value).toLocaleString(locale, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).replace(/\//g, "-")
}

/** 文档列表（表格）视图。由 documents/page.tsx 抽出，行为一致。 */
export function DocumentListTable({
  documents,
  isBatchMode,
  selectedDocIds,
  currentPage,
  pageSize,
  onToggleSelectAll,
  onToggleDocSelection,
  onSort,
  getSortIcon,
  vectorizeMutation,
  removeVectorMutation,
  onViewChunks,
  onOpenDocument,
  getEditPath,
  onDeleteDocument,
  emptyMessage,
}: DocumentListTableProps) {
  const t = useTranslations("Documents")
  const locale = useLocale()

  return (
    <div className="overflow-x-auto">
      <Table className="">
        <TableHeader className="bg-slate-50/50 sticky top-0 z-10 backdrop-blur-md">
          <TableRow className="hover:bg-transparent border-b border-slate-100">
            {isBatchMode && (
              <TableHead className="w-[50px] pl-6 sticky left-0 z-20 bg-slate-50/95 backdrop-blur">
                <button
                  onClick={onToggleSelectAll}
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
                onClick={() => onSort("views")}
              >
                {t("list.columnViews")}
                {getSortIcon("views")}
              </button>
            </TableHead>
            <TableHead className="w-[100px] hidden 2xl:table-cell">
              <button
                className="group flex items-center gap-1 hover:text-slate-600 transition-colors font-medium text-[11px] uppercase tracking-wider text-slate-400"
                onClick={() => onSort("created_at")}
              >
                {t("list.columnCreatedAt")}
                {getSortIcon("created_at")}
              </button>
            </TableHead>
            <TableHead className="w-[100px] hidden md:table-cell">
              <button
                className="group flex items-center gap-1 hover:text-slate-600 transition-colors font-medium text-[11px] uppercase tracking-wider text-slate-400"
                onClick={() => onSort("updated_at")}
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
                      onClick={() => onToggleDocSelection(doc.id)}
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
                        onClick={() => onOpenDocument(doc.id)}
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
                  <VectorStatusCell
                    doc={doc}
                    vectorizeMutation={vectorizeMutation}
                    removeVectorMutation={removeVectorMutation}
                    onViewChunks={onViewChunks}
                  />
                </TableCell>
                <TableCell className="py-3 text-slate-500 tabular-nums text-[12px] font-medium hidden lg:table-cell">
                  {(doc.views || 0).toLocaleString()}
                </TableCell>
                <TableCell className="py-3 text-slate-400 text-[11px] font-medium whitespace-nowrap hidden 2xl:table-cell">
                  {formatShortDateTime(doc.created_at, locale)}
                </TableCell>
                <TableCell className="py-3 text-slate-400 text-[11px] font-medium whitespace-nowrap hidden md:table-cell">
                  {formatShortDateTime(doc.updated_at, locale)}
                </TableCell>
                <TableCell className="py-3 text-right pr-6 sticky right-0 z-10 bg-white group-hover:bg-slate-50/50">
                  <div className="flex justify-end gap-0.5 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link href={getEditPath(doc.id)}>
                      <Button variant="ghost" size="icon-xs" className="text-slate-400 hover:text-slate-900 hover:bg-slate-100" title={t("list.edit")}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                      title={t("list.delete")}
                      onClick={() => onDeleteDocument(doc.id, doc.title)}
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
                    {emptyMessage}
                  </div>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
