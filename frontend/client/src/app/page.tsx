"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api-client"
import { logError } from "@/lib/error-handler"
import { PageLoading } from "@/components/ui/loading"
import { BookOpen, ChevronDown, ExternalLink, Github, Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { AIChatLanding } from "@/components/ai"
import type { Site } from "@/lib/sdk/models/Site"

export default function HomePage() {
  const router = useRouter()
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)
  const [isSiteSelectorOpen, setIsSiteSelectorOpen] = useState(false)
  const selectorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadSites = async () => {
      try {
        const response = await api.site.list({ page: 1, size: 100 })
        const availableSites = (response.list || []).filter((site) => site.domain)
        setSites(availableSites)
        // 初始状态不选择任何站点，允许跨站点提问
      } catch (error) {

        logError("加载站点", error)
      } finally {
        setLoading(false)
      }
    }

    loadSites()
  }, [])

  // 点击外部关闭选择器
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsSiteSelectorOpen(false)
      }
    }

    if (isSiteSelectorOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isSiteSelectorOpen])

  if (loading) {
    return <PageLoading text="正在加载..." />
  }

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden relative">
      {/* 装饰性背景 */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-[0.03]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500 blur-[100px]" />
      </div>

      {/* 顶部导航栏 */}
      <header className="relative z-20 h-14 md:h-16 border-b border-slate-100 flex items-center gap-4 px-4 md:px-8 bg-white/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-primary rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <BookOpen className="h-5 w-5 md:h-6 md:w-6 text-white" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold text-slate-900">CatWiki</h1>
            <p className="text-xs text-slate-500 hidden md:block">企业级AI知识库平台</p>
          </div>
        </div>

        {/* 右侧导航和站点选择器 */}
        <div className="ml-auto flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-1 md:gap-2">
            <a
              href="https://github.com/bulolo/CatWiki"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 hover:border-amber-300 rounded-lg transition-all text-xs md:text-sm font-semibold shadow-sm group"
            >
              <Github className="h-4 w-4 text-amber-600" />
              <div className="flex items-center gap-1">
                <span className="hidden sm:inline">Star</span>
                <Star className="h-3.5 w-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
              </div>
            </a>
            <a
              href={process.env.NEXT_PUBLIC_DOCS_URL || "http://localhost:8003"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-primary hover:bg-slate-50 rounded-lg transition-all text-xs md:text-sm font-medium"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">文档</span>
            </a>
          </div>

          {/* 站点选择器 */}
          {sites.length > 0 && (
            <div className="relative" ref={selectorRef}>
              <button
                onClick={() => setIsSiteSelectorOpen(!isSiteSelectorOpen)}
                className={cn(
                  "flex items-center gap-2 px-3 md:px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl md:rounded-2xl",
                  "hover:bg-white hover:border-primary/30 transition-all",
                  "w-[140px] md:w-[200px]",
                  isSiteSelectorOpen && "bg-white border-primary/30 shadow-lg"
                )}
              >
                <div className="text-left flex-1 min-w-0 overflow-hidden">
                  <div className="text-xs md:text-sm font-semibold text-slate-900 truncate">
                    {selectedSite ? selectedSite.name : "全部站点"}
                  </div>
                  <div className="text-[10px] md:text-xs text-slate-500 hidden md:block truncate">
                    {selectedSite ? (selectedSite.description || "限定此站点") : "跨站点提问"}
                  </div>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 text-slate-400 transition-transform shrink-0",
                  isSiteSelectorOpen && "rotate-180"
                )} />
              </button>

              {/* 下拉菜单 */}
              {isSiteSelectorOpen && (
                <div className="absolute top-full mt-2 right-0 w-64 md:w-80 glass-card rounded-xl md:rounded-2xl shadow-2xl border border-slate-200/50 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-2 max-h-[400px] overflow-y-auto">
                    {/* 全部站点选项 */}
                    <button
                      onClick={() => {
                        setSelectedSite(null)
                        setIsSiteSelectorOpen(false)
                      }}
                      className={cn(
                        "w-full p-3 md:p-4 rounded-lg md:rounded-xl text-left transition-all mb-2",
                        !selectedSite
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-slate-50 border border-transparent"
                      )}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="text-sm md:text-base font-semibold text-slate-900">
                          全部站点
                        </div>
                        {!selectedSite && (
                          <div className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0" />
                        )}
                      </div>
                      <div className="text-xs md:text-sm text-slate-500">
                        跨站点提问，不限定范围
                      </div>
                    </button>

                    {/* 分隔线 */}
                    <div className="h-px bg-slate-100 my-2" />

                    {/* 站点列表 */}
                    {sites.map((site) => (
                      <button
                        key={site.id}
                        onClick={() => {
                          setSelectedSite(site)
                          setIsSiteSelectorOpen(false)
                        }}
                        className={cn(
                          "w-full p-3 md:p-4 rounded-lg md:rounded-xl text-left transition-all",
                          selectedSite?.id === site.id
                            ? "bg-primary/10 border border-primary/30"
                            : "hover:bg-slate-50 border border-transparent"
                        )}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="text-sm md:text-base font-semibold text-slate-900">
                            {site.name}
                          </div>
                          {selectedSite?.id === site.id && (
                            <div className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0" />
                          )}
                        </div>
                        {site.description && (
                          <div className="text-xs md:text-sm text-slate-500 line-clamp-2 mb-2">
                            {site.description}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <a
                            href={`/${site.domain}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (site.domain) {
                                e.preventDefault()
                                router.push(`/${site.domain}`)
                              }
                            }}
                            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                          >
                            访问站点
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* AI 聊天区域 */}
      <AIChatLanding
        siteName={selectedSite?.name}
        siteId={selectedSite?.id}
        quickQuestions={selectedSite?.quick_questions ?? undefined}
      />
    </div>
  )
}
