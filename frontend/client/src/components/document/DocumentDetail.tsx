"use client"

import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { BookOpen, Clock, MoreHorizontal, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Streamdown } from "streamdown"
import type { DocumentDetail as DocumentDetailType } from "@/types"

interface DocumentDetailProps {
  document: DocumentDetailType | null | undefined
  isLoading?: boolean
}

/**
 * 文档骨架屏组件
 */
function DocumentSkeleton() {
  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* 面包屑骨架 */}
      <div className="px-4 md:px-8 py-2.5 md:py-3 flex items-center justify-between shrink-0 bg-white md:bg-slate-50/50 border-b border-slate-100">
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <div className="h-4 bg-slate-100 rounded w-16 animate-pulse hidden md:block"></div>
          <span className="text-slate-300 hidden md:inline">/</span>
          <div className="h-4 bg-slate-200 rounded w-32 animate-pulse"></div>
        </div>
        <div className="flex items-center gap-1 md:gap-2 shrink-0 ml-2">
          <div className="h-7 w-16 bg-slate-100 rounded-lg animate-pulse hidden sm:block"></div>
          <div className="h-7 w-7 bg-slate-100 rounded-lg animate-pulse"></div>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto px-5 md:px-6 lg:px-8 py-6 md:py-10 lg:py-16">
          {/* 元信息骨架 */}
          <div className="flex flex-wrap items-center gap-1.5 md:gap-3 mb-5 md:mb-6">
            <div className="h-6 w-28 bg-slate-100 rounded animate-pulse"></div>
            <div className="h-6 w-20 bg-slate-100 rounded animate-pulse"></div>
            <div className="h-6 w-24 bg-slate-100 rounded animate-pulse hidden sm:block"></div>
          </div>
          
          {/* 标题骨架 */}
          <div className="mb-4 md:mb-6 space-y-2">
            <div className="h-8 md:h-10 lg:h-12 bg-slate-200 rounded w-3/4 animate-pulse"></div>
          </div>
          
          {/* 标签骨架 */}
          <div className="flex flex-wrap gap-2 mb-6 md:mb-8 lg:mb-10">
            <div className="h-7 w-16 bg-slate-100 rounded-full animate-pulse"></div>
            <div className="h-7 w-20 bg-slate-100 rounded-full animate-pulse"></div>
            <div className="h-7 w-14 bg-slate-100 rounded-full animate-pulse"></div>
          </div>
          
          {/* 内容骨架 */}
          <div className="space-y-4">
            <div className="h-4 bg-slate-100 rounded w-full animate-pulse"></div>
            <div className="h-4 bg-slate-100 rounded w-5/6 animate-pulse"></div>
            <div className="h-4 bg-slate-100 rounded w-full animate-pulse"></div>
            <div className="h-4 bg-slate-100 rounded w-4/5 animate-pulse"></div>
            <div className="h-4 bg-slate-100 rounded w-full animate-pulse"></div>
            <div className="h-4 bg-slate-100 rounded w-3/4 animate-pulse"></div>
            <div className="h-20"></div>
            <div className="h-4 bg-slate-100 rounded w-full animate-pulse"></div>
            <div className="h-4 bg-slate-100 rounded w-5/6 animate-pulse"></div>
            <div className="h-4 bg-slate-100 rounded w-full animate-pulse"></div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

export function DocumentDetail({ document, isLoading }: DocumentDetailProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const prevDocIdRef = useRef<string | null>(null)
  
  // 文档切换时滚动到顶部
  useEffect(() => {
    const currentDocId = document?.id || null
    const prevDocId = prevDocIdRef.current
    
    if (currentDocId !== prevDocId && currentDocId !== null) {
      // 滚动到顶部
      if (scrollRef.current) {
        const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
        if (scrollContainer) {
          scrollContainer.scrollTo({ top: 0, behavior: 'instant' })
        }
      }
      prevDocIdRef.current = currentDocId
    }
  }, [document?.id])

  // 加载中状态 - 显示骨架屏
  if (isLoading || !document) {
    // 如果明确是加载中，显示骨架屏
    if (isLoading) {
      return <DocumentSkeleton />
    }
    
    // 没有文档时显示空状态
    return (
      <div className="h-full flex items-center justify-center bg-slate-50/30 px-5">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-5 md:mb-6 shadow-sm border border-slate-100">
            <BookOpen className="h-8 w-8 md:h-10 md:w-10 text-slate-300" />
          </div>
          <h3 className="text-[17px] md:text-xl font-bold text-slate-900 mb-2.5 md:mb-2">准备好探索了吗？</h3>
          <p className="text-slate-500 text-[14px] md:text-sm leading-[1.6] md:leading-relaxed px-2">
            从<span className="lg:hidden">菜单</span><span className="hidden lg:inline">左侧目录</span>选择一篇文章开始阅读，或者直接在搜索框使用 AI 检索您感兴趣的内容。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* 次级导航/面包屑 */}
      <div className="px-4 md:px-8 py-2.5 md:py-3 flex items-center justify-between shrink-0 bg-white md:bg-slate-50/50 border-b border-slate-100">
        <div className="flex items-center gap-2 md:gap-3 text-[11px] md:text-[12px] font-medium text-slate-400 min-w-0 flex-1">
          <span className="hover:text-primary cursor-pointer transition-colors hidden md:inline">文档列表</span>
          <span className="text-slate-300 hidden md:inline">/</span>
          <span className="text-slate-600 font-semibold truncate text-[12px] md:text-[12px]">{document.title}</span>
        </div>
        <div className="flex items-center gap-1 md:gap-2 shrink-0 ml-2">
          <Button variant="ghost" size="icon" className="h-7 w-7 md:h-7 md:w-7 text-slate-500 rounded-lg">
            <MoreHorizontal className="h-3.5 w-3.5 md:h-3.5 md:w-3.5" />
          </Button>
        </div>
      </div>
      
      <ScrollArea ref={scrollRef} className="flex-1">
        <div className="max-w-3xl mx-auto px-5 md:px-6 lg:px-8 py-6 md:py-10 lg:py-16 min-h-screen">
          {/* 元信息 */}
          <div className="flex flex-wrap items-center gap-1.5 md:gap-3 text-slate-400 text-[10px] md:text-[12px] mb-5 md:mb-6">
            <div className="flex items-center gap-1 md:gap-1.5 px-2 py-1 md:px-2 md:py-0.5 bg-slate-100 rounded text-slate-500">
              <Clock className="h-3 w-3 md:h-3.5 md:w-3.5" />
              <span className="hidden sm:inline">更新于 2023年12月</span>
              <span className="sm:hidden">12月更新</span>
            </div>
            {document.views !== undefined && (
              <>
                <span className="hidden sm:inline">•</span>
                <div className="flex items-center gap-1 md:gap-1.5 px-2 py-1 md:px-2 md:py-0.5 bg-slate-100 rounded text-slate-500">
                  <Eye className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  <span>{document.views.toLocaleString()}<span className="hidden sm:inline"> 次阅读</span></span>
                </div>
              </>
            )}
            {document.readingTime !== undefined && document.readingTime !== null && (
              <>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">预计阅读 {document.readingTime > 0 ? `${document.readingTime} 分钟` : '不到 1 分钟'}</span>
              </>
            )}
          </div>
          
          {/* 文档标题 */}
          <h1 className="text-[26px] leading-[1.2] md:text-3xl md:leading-[1.15] lg:text-4xl xl:text-5xl font-extrabold md:font-black text-slate-900 tracking-tight mb-4 md:mb-6">
            {document.title}
          </h1>
          
          {/* 标签 */}
          {document.tags && document.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8 md:mb-10">
              {document.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* 内容摘要卡片 */}
          {document.summary && (
            <div className="mb-10 md:mb-14 p-6 md:p-8 bg-amber-50/30 rounded-3xl border border-amber-100/50 relative overflow-hidden group">
              {/* 背景装饰：一个淡淡的琥珀色渐变 */}
              <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-200/50" />
              
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[13px] font-bold text-amber-900/40 tracking-widest uppercase">内容提要</span>
              </div>

              <p className="text-[16px] md:text-[18px] text-slate-700/80 leading-relaxed font-medium italic">
                "{document.summary}"
              </p>
            </div>
          )}
          
          {/* 文档内容 */}
          <div className="article-content-mobile md:prose md:prose-slate lg:prose-lg max-w-none">
            {document.content ? (
              <Streamdown>
                {document.content}
              </Streamdown>
            ) : (
              // 内容骨架屏
              <div className="space-y-3 md:space-y-4 animate-pulse">
                <div className="h-3 md:h-4 bg-slate-100 rounded w-full"></div>
                <div className="h-3 md:h-4 bg-slate-100 rounded w-5/6"></div>
                <div className="h-3 md:h-4 bg-slate-100 rounded w-full"></div>
                <div className="h-3 md:h-4 bg-slate-100 rounded w-4/5"></div>
                <div className="h-3 md:h-4 bg-slate-100 rounded w-full"></div>
                <div className="h-3 md:h-4 bg-slate-100 rounded w-3/4"></div>
              </div>
            )}
          </div>
          
          {/* 底部反馈区域 - 仅在有内容时显示 */}
          {document.content && (
            <div className="mt-12 md:mt-20 lg:mt-24 pt-6 md:pt-10 border-t border-slate-100">
              <div className="bg-slate-50/80 rounded-xl md:rounded-3xl lg:rounded-[2rem] p-5 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-3 md:gap-6 border border-slate-100">
                <div className="text-center sm:text-left w-full sm:w-auto">
                  <h4 className="font-bold text-slate-900 mb-1 text-[15px] md:text-lg">这对你有帮助吗？</h4>
                  <p className="text-slate-500 text-[13px] md:text-sm leading-relaxed">您的反馈将帮助我们优化 AI 检索结果。</p>
                </div>
                <div className="flex gap-2.5 md:gap-3 w-full sm:w-auto">
                  <Button variant="outline" className="flex-1 sm:flex-none rounded-lg md:rounded-xl px-5 md:px-6 h-10 md:h-11 text-[13px] md:text-sm font-medium border-slate-200 hover:bg-white transition-all">没帮助</Button>
                  <Button className="flex-1 sm:flex-none rounded-lg md:rounded-xl px-5 md:px-6 h-10 md:h-11 text-[13px] md:text-sm font-medium shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]">有帮助</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}



