
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, Loader2, FileText, Brain, Info } from "lucide-react"
import { api } from "@/lib/api-client"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

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
  metadata?: Record<string, any>
}

export function VectorRetrieveModal({ open, onOpenChange, siteId }: VectorRetrieveModalProps) {
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<RetrieveResult[]>([])
  const [hasRetrieved, setHasRetrieved] = useState(false)
  const [limit, setLimit] = useState(5)
  const [threshold, setThreshold] = useState(0.3)
  const [filterId, setFilterId] = useState("")
  const [enableRerank, setEnableRerank] = useState(true)
  const [rerankK, setRerankK] = useState(5)

  const handleRetrieve = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!query.trim()) return

    setIsLoading(true)
    setHasRetrieved(true)
    try {
      const res = await api.document.retrieveVectors({
        query: query.trim(),
        k: limit,
        threshold,
        filter: {
          site_id: siteId,
          id: filterId.trim() || undefined,
        },
        enable_rerank: enableRerank,
        rerank_k: rerankK || limit
      }) as any
      // Now result is already the data part (likely { list: [...] })
      if (res && res.list && Array.isArray(res.list)) {
        setResults(res.list)
      } else if (Array.isArray(res)) {
        setResults(res)
      } else {
        setResults([])
      }

    } catch (error) {
      console.error("Retrieve failed", error)
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
            向量检索测试
          </DialogTitle>
          <DialogDescription>
            输入自然语言问题，测试向量数据库的语义检索效果。
          </DialogDescription>
        </DialogHeader>

        <div className="p-4 bg-slate-50 border-b shrink-0 space-y-3">
          <form onSubmit={handleRetrieve} className="flex gap-4 items-end">
            <div className="flex-1 space-y-1.5">
              <span className="text-xs font-medium text-slate-500 ml-1">查询内容</span>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="例如：定期体检有什么好处？"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 bg-white"
                  autoFocus
                />
              </div>
            </div>
            <div className="w-28 space-y-1.5 whitespace-nowrap">
              <span className="text-xs font-medium text-slate-500 ml-1">Threshold（阈值）</span>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)}
                className="bg-white"
                placeholder="阈值"
                title="相似度阈值 (0-1)"
              />
            </div>
            <div className="w-28 space-y-1.5">
              <span className="text-xs font-medium text-slate-500 ml-1">Top K (数量)</span>
              <Input
                type="number"
                min={1}
                max={100}
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 10)}
                className="bg-white"
                placeholder="数量"
                title="返回结果数量"
              />
            </div>
            <div className="w-28 space-y-1.5">
              <span className="text-xs font-medium text-slate-500 ml-1">Doc ID (可选)</span>
              <Input
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
                className="bg-white"
                placeholder="文档 ID"
                title="过滤特定文档 ID"
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
                重排序 (Rerank)
              </label>
            </div>
            <Button type="submit" disabled={isLoading || !query.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  检索中
                </>
              ) : (
                "尝试检索"
              )}
            </Button>
          </form>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              <span>系统将返回相似度高于 {threshold} 的 Top {limit} 最匹配的文档分片</span>
            </div>
            {siteId && (
              <Badge variant="outline" className="text-[10px] font-normal border-indigo-100 text-indigo-500 bg-indigo-50/30">
                站点过滤: {siteId}
              </Badge>
            )}
            {filterId && (
              <Badge variant="outline" className="text-[10px] font-normal border-amber-100 text-amber-500 bg-amber-50/30">
                文档过滤: {filterId}
              </Badge>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 p-4 bg-slate-50/50">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              <p>正在分析语义...</p>
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
                            精排: {(result.score * 100).toFixed(1)}%
                          </Badge>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            <span className="opacity-70">原始召回:</span>
                            <span className="font-medium">{(result.original_score * 100).toFixed(1)}%</span>
                          </div>
                        </>
                      ) : (
                        <Badge variant={result.score > 0.8 ? "default" : "secondary"} className={result.score > 0.8 ? "bg-green-500 hover:bg-green-600" : ""}>
                          相似度: {(result.score * 100).toFixed(1)}%
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
                      <span className="font-mono bg-slate-100 px-1 rounded text-[10px]">Chunk: {result.metadata?.chunk_index ?? 'N/A'}</span>
                    </div>
                    <details className="group/meta">
                      <summary className="cursor-pointer hover:text-indigo-500 transition-colors list-none flex items-center gap-1 w-fit">
                        <span className="text-[10px] underline decoration-dotted">查看完整元数据</span>
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
              <p>未找到相关内容</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-60 text-slate-400">
              <Brain className="h-12 w-12 mb-4 text-indigo-100" />
              <p>输入问题开始检索</p>
              <p className="text-xs mt-1 text-slate-400">系统将返回 Top {limit} 最匹配的文档分片</p>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
