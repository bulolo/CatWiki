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

import { useEffect, useState, useRef } from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { listClientSites } from '@/lib/sdk/client-sites'
import { logError } from "@/lib/error-handler"
import { cn } from "@/lib/utils"
import { PageLoading, NotFoundState, Input } from "@/components/ui"
import { AIChatLanding } from "@/components/ai"
import type { ClientSite } from '@/lib/sdk/sdk.schemas'
import { Search, BookOpen, ChevronDown, Github, Star } from "lucide-react"
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher"

import { env } from "@/lib/env"

export default function TenantPortalPage() {
  const t = useTranslations("TenantPortal")
  const { tenantSlug } = useParams()
  const [sites, setSites] = useState<ClientSite[]>([])
  const [baseSites, setBaseSites] = useState<ClientSite[]>([])
  const [loading, setLoading] = useState(true)
  const [hasSites, setHasSites] = useState(false)
  const [selectedSite, setSelectedSite] = useState<ClientSite | null>(null)
  const [isSiteSelectorOpen, setIsSiteSelectorOpen] = useState(false)
  const [keyword, setKeyword] = useState("")
  const selectorRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    const loadSites = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await listClientSites({
          page: 1,
          size: 100,
          tenant_slug: tenantSlug as string,
          keyword: keyword || undefined,
        })
        const list = response?.list ?? []
        setSites(list)

        // 如果没有站点且不是加载中，也视为租户配置问题或不存在
        if (!keyword && list.length === 0) {
          setError({ status: 404, message: t("notFound.title") })
        } else if (!keyword && list.length > 0) {
          setHasSites(true)
          setBaseSites(list)
        }
      } catch (err: unknown) {
        logError(t("loading"), err)
        setError(err)
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(() => {
      loadSites()
    }, 300)

    return () => clearTimeout(timer)
  }, [tenantSlug, keyword, t])

  // 点击外部关闭选择器
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        setIsSiteSelectorOpen(false)
        setKeyword("")
      }
    }

    if (isSiteSelectorOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isSiteSelectorOpen])

  if (loading && !hasSites && !error) {
    return <PageLoading text={t("loading")} />
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-white">
        <NotFoundState
          title={t("notFound.title")}
          description={t("notFound.description", { tenantSlug: tenantSlug as string })}
          showHome={true}
        />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden relative">
      {/* 装饰性背景 */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-[0.03]">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500 blur-[100px]" />
      </div>

      {/* 顶部导航栏 */}
      <header className="relative z-40 h-14 md:h-16 border-b border-slate-100 flex items-center gap-4 px-4 md:px-8 bg-white/80 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 md:w-10 md:h-10 bg-primary rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
            <BookOpen className="h-5 w-5 md:h-6 md:w-6 text-white" />
          </div>
          <div>
            <h1 className="text-base md:text-lg font-bold text-slate-900">CatWiki</h1>
            <p className="text-xs text-slate-500 hidden md:block">{t("subtitle")}</p>
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
                <span className="hidden sm:inline">{t("nav.star")}</span>
                <Star className="h-3.5 w-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
              </div>
            </a>
            <a
              href={env.NEXT_PUBLIC_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-primary hover:bg-slate-50 rounded-lg transition-all text-xs md:text-sm font-medium"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">{t("nav.docs")}</span>
            </a>
            <div className="w-px h-4 bg-slate-200" />
            <LanguageSwitcher />
          </div>

          {/* 站点选择器 */}
          {hasSites && (
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
                  <div className="text-xs md:text-sm font-semibold text-slate-900 truncate flex items-center gap-1.5">
                    {selectedSite ? selectedSite.name : t("selector.allSites")}
                    <span className="px-1 py-0.5 bg-slate-200 text-slate-500 rounded text-[9px] font-mono leading-none">
                      {tenantSlug}
                    </span>
                  </div>
                  <div className="text-[10px] md:text-xs text-slate-500 hidden md:block truncate">
                    {selectedSite ? (selectedSite.description || t("selector.limitSite")) : t("selector.crossSite")}
                  </div>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 text-slate-400 transition-transform shrink-0",
                  isSiteSelectorOpen && "rotate-180"
                )} />
              </button>

              {/* 下拉菜单 */}
              {isSiteSelectorOpen && (
                <div className="absolute top-full mt-2 right-0 w-64 md:w-80 glass-card rounded-xl md:rounded-2xl shadow-2xl border border-slate-200/50 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                    <div className="relative group">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                      <Input
                        autoFocus
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder={t("selector.placeholder", { tenantSlug: tenantSlug as string })}
                        className="pl-10 h-9 bg-white border-slate-200 rounded-lg text-sm focus-visible:ring-primary/20 focus:border-primary/30"
                      />
                    </div>
                  </div>
                  <div className="p-2 max-h-[400px] overflow-y-auto">
                    {/* 全部站点选项 */}
                    <button
                      onClick={() => {
                        setSelectedSite(null)
                        setIsSiteSelectorOpen(false)
                        setKeyword("")
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
                          {t("selector.allSites")}
                        </div>
                        {!selectedSite && (
                          <div className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0" />
                        )}
                      </div>
                      <div className="text-xs md:text-sm text-slate-500">
                        {t("selector.crossSiteLong")}
                      </div>
                    </button>

                    {/* 分隔线 */}
                    <div className="h-px bg-slate-100 my-2" />

                    {/* 站点列表 */}
                    {sites.length > 0 ? (
                      sites.map((site) => (
                        <button
                          key={site.id}
                          onClick={() => {
                            setSelectedSite(site)
                            setIsSiteSelectorOpen(false)
                            setKeyword("")
                          }}
                          className={cn(
                            "w-full p-3 md:p-4 rounded-lg md:rounded-xl text-left transition-all",
                            selectedSite?.id === site.id
                              ? "bg-primary/10 border border-primary/30"
                              : "hover:bg-slate-50 border border-transparent"
                          )}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="text-sm md:text-base font-semibold text-slate-900 flex items-center gap-1.5">
                              {site.name}
                              <span className="px-1 py-0.5 bg-slate-100 text-slate-400 rounded text-[9px] font-mono leading-none">
                                {tenantSlug}
                              </span>
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
                            <span className="text-xs text-primary group-hover:underline flex items-center gap-1">
                              {t("selector.limitSite")}
                            </span>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-8 text-center bg-slate-50/50 rounded-xl">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Search className="h-5 w-5 text-slate-400" />
                        </div>
                        <p className="text-sm text-slate-500 font-medium">{t("selector.empty")}</p>
                        <p className="text-[10px] text-slate-400 mt-1">{t("selector.emptySub")}</p>
                      </div>
                    )}
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
        tenantId={selectedSite?.tenant_id || baseSites[0]?.tenant_id}
        quickQuestions={selectedSite?.quick_questions ?? undefined}
        allSites={baseSites}
      />
    </div>
  )
}
