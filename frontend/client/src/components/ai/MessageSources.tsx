import { Link, FileText, ExternalLink } from "lucide-react"
import { Source } from "@/types"
import { cn } from "@/lib/utils"

interface MessageSourcesProps {
  sources?: Source[]
}

export function MessageSources({ sources }: MessageSourcesProps) {
  if (!sources || sources.length === 0) return null

  return (
    <div className="mt-2 pl-1 max-w-full overflow-hidden">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-md bg-indigo-50 flex items-center justify-center">
          <Link className="w-3 h-3 text-indigo-500" />
        </div>
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          引用来源 ({sources.length})
        </span>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {sources.map((source, index) => (
          <a
            key={`${source.id}-${index}`}
            href={source.siteDomain && source.documentId ? `/${source.siteDomain}?documentId=${source.documentId}` : "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "group relative flex items-start gap-3 p-3 rounded-xl",
              "bg-white border border-slate-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.02)]", // 默认白底 + 微阴影
              "hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-500/10", // 悬停加深阴影和边框
              "transition-all duration-300 ease-out",
              "no-underline hover:no-underline"
            )}
          >
            <div className={cn(
              "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors",
              "bg-indigo-50/50 border border-indigo-100/50 text-indigo-600 font-mono text-[10px]", // 默认带一点的主色调
              "group-hover:bg-indigo-50 group-hover:border-indigo-200"
            )}>
              {index + 1}
            </div>
            
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-medium text-slate-800 leading-snug truncate group-hover:text-indigo-600 transition-colors">
                {source.title}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <FileText className="w-3 h-3 text-slate-400" />
                  <span className="truncate max-w-[80px]">
                    {source.siteName || "知识库"}
                  </span>
                </div>
                {source.siteDomain && (
                  <span className="text-[10px] text-slate-300">•</span>
                )}
                {source.siteDomain && (
                  <span className="text-[10px] text-slate-400 truncate font-mono">
                    /{source.siteDomain}
                  </span>
                )}
              </div>
            </div>

            <ExternalLink className="w-3 h-3 text-slate-300 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
          </a>
        ))}
      </div>
    </div>
  )
}
