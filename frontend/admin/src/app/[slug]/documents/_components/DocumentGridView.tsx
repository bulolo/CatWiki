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

import Link from "next/link"
import { useTranslations } from "next-intl"
import { Clock, Edit2, Eye, FileText, Folder, Trash2 } from "lucide-react"
import { Button } from "@/components/ui"
import { OptimizedImage } from "@/components/common"
import type { Document } from "@/lib/sdk/sdk.schemas"
import { cn } from "@/lib/utils"

interface DocumentGridViewProps {
  documents: Document[]
  loading: boolean
  onOpenDocument: (docId: number) => void
  getEditPath: (docId: number) => string
  onDeleteDocument: (id: number, title: string) => void
  emptyMessage: string
}

/** 文档网格（卡片）视图。由 documents/page.tsx 抽出，行为一致。 */
export function DocumentGridView({
  documents,
  loading,
  onOpenDocument,
  getEditPath,
  onDeleteDocument,
  emptyMessage,
}: DocumentGridViewProps) {
  const t = useTranslations("Documents")

  return (
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
                onClick={() => onOpenDocument(doc.id)}
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
                  onClick={() => onOpenDocument(doc.id)}
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
                    href={getEditPath(doc.id)}
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
                    onClick={() => onDeleteDocument(doc.id, doc.title)}
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
            {emptyMessage}
          </p>
        </div>
      )}
    </div>
  )
}
