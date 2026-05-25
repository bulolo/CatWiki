// Copyright 2026 CatWiki Authors
//
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://github.com/CatWiki/CatWiki/blob/main/LICENSE

"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useQuery } from "@tanstack/react-query"
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, ScrollArea } from "@/components/ui"
import { Brain, ChevronLeft, FileText, Loader2 } from "lucide-react"
import { getAdminDocumentChunks } from "@/lib/sdk/admin-documents"
import { normalizeChunks, type DocumentChunk } from "@/lib/normalizers"

interface ChunksViewerDialogProps {
  viewChunksId: number | null
  onClose: () => void
}

export function ChunksViewerDialog({ viewChunksId, onClose }: ChunksViewerDialogProps) {
  const t = useTranslations("Documents")
  const [focusedChunk, setFocusedChunk] = useState<DocumentChunk | null>(null)

  const { data: chunksData, isLoading: chunksLoading } = useQuery({
    queryKey: ["document-chunks", viewChunksId],
    queryFn: async () => {
      if (!viewChunksId) return []
      const raw = await getAdminDocumentChunks(viewChunksId)
      return normalizeChunks(raw)
    },
    enabled: !!viewChunksId,
  })
  const chunkList = chunksData ?? []

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setFocusedChunk(null)
      onClose()
    }
  }

  return (
    <Dialog open={!!viewChunksId} onOpenChange={handleOpenChange}>
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
                  #{focusedChunk.metadata?.chunk_index ?? "?"}
                </span>
                {t("dialogs.chunks.detailTitle")}
              </DialogTitle>
              <DialogDescription className="font-mono text-xs ml-auto">
                Chunk ID: {focusedChunk.id}
              </DialogDescription>
            </div>
          ) : (
            <>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                {t("dialogs.chunks.title")}
              </DialogTitle>
              <DialogDescription>
                {t("dialogs.chunks.description", { id: viewChunksId || "" })}
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
              <p className="text-sm">{t("dialogs.chunks.loading")}</p>
            </div>
          ) : chunkList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
              <FileText className="h-10 w-10 opacity-20" />
              <p className="text-sm">{t("dialogs.chunks.noData")}</p>
            </div>
          ) : (
            <ScrollArea className="h-full p-4 md:p-6 text-left">
              <div className="space-y-4 pb-4">
                <div className="flex items-center justify-between px-1 pb-2">
                  <Badge variant="outline" className="bg-white">
                    {t("dialogs.chunks.badgeCount", { count: chunkList.length })}
                  </Badge>
                  <div className="text-xs text-slate-400">
                    {t("dialogs.chunks.hintClick")}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {chunkList.map((chunk: DocumentChunk, index: number) => (
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
                          <span className="text-[10px] text-primary bg-primary/5 px-2 py-0.5 rounded-full font-medium">{t("deleteDialog.viewDetail")}</span>
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
          <Button onClick={onClose}>{t("deleteDialog.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
