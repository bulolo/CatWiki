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


import { useState } from "react"
import { useTranslations } from "next-intl"
import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Input, ScrollArea } from "@/components/ui"
import { Search, Loader2, FileText, Brain, Info } from "lucide-react"
import { retrieveDocuments } from "@/lib/sdk/admin-documents"
import type { VectorRetrieveResponse } from "@/lib/sdk/sdk.schemas"

interface VectorRetrieveModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  siteId?: number
}

interface RetrieveResult {
  content: string
  score: number
  document_id: number | string
  document_title?: string | null
  original_score?: number | null
  metadata?: Record<string, unknown>
}

function getChunkIndex(metadata?: Record<string, unknown>): string {
  const value = metadata?.chunk_index
  if (typeof value === "number" || typeof value === "string") {
    return String(value)
  }
  return "N/A"
}

export function VectorRetrieveModal({ open, onOpenChange, siteId }: VectorRetrieveModalProps) {
  const t = useTranslations("VectorRetrieve")
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<RetrieveResult[]>([])
  const [hasRetrieved, setHasRetrieved] = useState(false)
  const [limit, setLimit] = useState(5)
  const [threshold, setThreshold] = useState(0.3)
  const [filterId, setFilterId] = useState("")
  const [enableRerank, setEnableRerank] = useState(true)
  const [rerankK] = useState(5)

  const handleRetrieve = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) return

    setIsLoading(true)
    setHasRetrieved(true)
    try {
      const res = await retrieveDocuments({
        query: query.trim(),
        k: limit,
        threshold,
        filter: {
          site_id: siteId,
          id: filterId.trim() || undefined,
        },
        enable_rerank: enableRerank,
        rerank_k: rerankK || limit,
      })
      const resultList = Array.isArray(res?.list) ? (res.list as VectorRetrieveResponse[]) : []
      setResults(resultList)

    } catch (error) {
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-indigo-500" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 bg-slate-50 border-b shrink-0 space-y-3">
          <form onSubmit={handleRetrieve} className="flex gap-4 items-end">
            <div className="flex-1 space-y-1.5">
              <span className="text-xs font-medium text-slate-500 ml-1">{t("queryLabel")}</span>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={t("queryPlaceholder")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 bg-white"
                  autoFocus
                />
              </div>
            </div>
            <div className="w-28 space-y-1.5 whitespace-nowrap">
              <span className="text-xs font-medium text-slate-500 ml-1">{t("thresholdLabel")}</span>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)}
                className="bg-white"
                placeholder={t("threshold")}
                title="Similarity threshold (0-1)"
              />
            </div>
            <div className="w-28 space-y-1.5">
              <span className="text-xs font-medium text-slate-500 ml-1">{t("limitLabel")}</span>
              <Input
                type="number"
                min={1}
                max={100}
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 10)}
                className="bg-white"
                placeholder={t("limit")}
                title="Number of results"
              />
            </div>
            <div className="w-28 space-y-1.5">
              <span className="text-xs font-medium text-slate-500 ml-1">{t("docIdLabel")}</span>
              <Input
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
                className="bg-white"
                placeholder={t("docId")}
                title="Filter by document ID"
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <input
                type="checkbox"
                id="enableRerank"
                checked={enableRerank}
                onChange={(e) => setEnableRerank(e.target.checked)}
                className="accent-indigo-500 cursor-pointer"
              />
              <label htmlFor="enableRerank" className="text-xs font-medium text-slate-500 cursor-pointer">
                {t("rerank")}
              </label>
            </div>
            <Button type="submit" disabled={isLoading || !query.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("searching")}
                </>
              ) : (
                t("search")
              )}
            </Button>
          </form>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              <span>{t("resultHint", { threshold, limit })}</span>
            </div>
            {siteId && (
              <Badge variant="outline" className="text-[10px] font-normal border-indigo-100 text-indigo-500 bg-indigo-50/30">
                {t("siteFilter", { id: siteId })}
              </Badge>
            )}
            {filterId && (
              <Badge variant="outline" className="text-[10px] font-normal border-amber-100 text-amber-500 bg-amber-50/30">
                {t("docFilter", { id: filterId })}
              </Badge>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 p-4 bg-slate-50/50">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <p>{t("analyzing")}</p>
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {results.map((result: RetrieveResult, index: number) => (

                <div
                  key={index}
                  className="bg-white rounded-lg border shadow-sm p-4 hover:border-indigo-200 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <FileText className="h-4 w-4 text-slate-400" />
                      <span>{result.document_title || `Document #${result.document_id}`}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {/* 如果有 original_score，展示对比 */}
                      {result.original_score != null ? (
                        <>
                          <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white border-0 shadow-sm">
                            {t("rerankScore")} {(result.score * 100).toFixed(1)}%
                          </Badge>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            <span className="opacity-70">{t("originalScore")}</span>
                            <span className="font-medium">{(result.original_score * 100).toFixed(1)}%</span>
                          </div>
                        </>
                      ) : (
                        <Badge variant={result.score > 0.8 ? "default" : "secondary"} className={result.score > 0.8 ? "bg-green-500 hover:bg-green-600" : ""}>
                          {t("similarity")} {(result.score * 100).toFixed(1)}%
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-md font-mono text-xs md:text-sm flex-1 overflow-auto max-h-[200px]">
                    {result.content}
                  </div>
                  <div className="mt-2 text-xs text-slate-400 pt-2 flex flex-col gap-1 border-t shrink-0">
                    <div className="flex justify-between items-center">
                      <span>Doc ID: {result.document_id}</span>
                      <span className="font-mono bg-slate-100 px-1 rounded text-[10px]">
                        Chunk: {getChunkIndex(result.metadata)}
                      </span>
                    </div>
                    <details className="group/meta">
                      <summary className="cursor-pointer hover:text-indigo-500 transition-colors list-none flex items-center gap-1 w-fit">
                        <span className="text-[10px] underline decoration-dotted">{t("viewMetadata")}</span>
                      </summary>
                      <pre className="mt-1 p-2 bg-slate-100 rounded text-[10px] whitespace-pre-wrap break-all overflow-hidden text-slate-500">
                        {JSON.stringify(result.metadata, null, 2)}
                      </pre>
                    </details>
                  </div>
                </div>
              ))}
            </div>
          ) : hasRetrieved ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <Search className="h-10 w-10 mb-2 opacity-20" />
              <p>{t("noResults")}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-60 text-slate-400">
              <Brain className="h-12 w-12 mb-4 text-indigo-100" />
              <p>{t("initialHint")}</p>
              <p className="text-xs mt-1 text-slate-400">{t("initialHintDetail", { limit })}</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
