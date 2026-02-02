import { Link, FileText, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"

export interface MessageSource {
  id: string
  title: string
  siteName?: string
  siteDomain?: string
  siteId?: number
  documentId?: number
}

interface MessageSourcesProps {
  sources?: MessageSource[]
}

export function MessageSources({ sources }: MessageSourcesProps) {
  if (!sources || sources.length === 0) return null

  return (
    <div className="mt-2 pl-1 max-w-full overflow-hidden">
      <div className="flex items-center gap-2 mb-2 border-t border-slate-50 pt-3 mt-1">
        <div className="w-5 h-5 rounded-md bg-indigo-50 flex items-center justify-center">
          <Link className="w-3 h-3 text-indigo-500" />
        </div>
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          引用来源 ({sources.length})
        </span>
      </div>
      
      <div className="grid grid-cols-1 gap-2">
        {sources.map((source, index) => (
          <div
            key={`${source.id}-${index}`}
            className={cn(
              "group relative flex items-start gap-3 p-2.5 rounded-xl transition-all duration-300 ease-out",
              "bg-white border border-slate-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.01)]",
              "hover:border-indigo-100 hover:shadow-sm"
            )}
          >
            <div className={cn(
              "w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors",
              "bg-indigo-50/50 border border-indigo-100/50 text-indigo-600 font-mono text-[9px]",
              "group-hover:bg-indigo-50"
            )}>
              {index + 1}
            </div>
            
            <div className="min-w-0 flex-1">
              <h4 className="text-[11px] font-medium text-slate-700 leading-snug truncate group-hover:text-indigo-600 transition-colors">
                {source.title}
              </h4>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="flex items-center gap-1 text-[9px] text-slate-400">
                  <FileText className="w-2.5 h-2.5" />
                  <span className="truncate max-w-[120px]">
                    {source.siteName || "知识库"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
