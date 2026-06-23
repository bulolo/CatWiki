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

import { useEffect, useMemo, useState, useRef } from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useListClientSites } from "@/lib/sdk/client-sites"
import { useDebouncedValue, useClickOutside } from "@/hooks"
import { logError } from "@/lib/error-handler"
import { PageLoading, NotFoundState } from "@/components/ui"
import { AIChatLanding } from "@/components/ai"
import type { ClientSite } from "@/lib/sdk/sdk.schemas"
import { BookOpen, Github, Star } from "lucide-react"
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher"
import { SiteSelector } from "@/components/layout/SiteSelector"

import { env } from "@/lib/env"

export default function TenantPortalPage() {
  const t = useTranslations("TenantPortal")
  const { tenantSlug } = useParams()
  const [selectedSite, setSelectedSite] = useState<ClientSite | null>(null)
  const [isSiteSelectorOpen, setIsSiteSelectorOpen] = useState(false)
  const [keyword, setKeyword] = useState("")
  const debouncedKeyword = useDebouncedValue(keyword, 300)
  const selectorRef = useRef<HTMLDivElement>(null)
  const tenantSlugValue = tenantSlug as string

  const baseParams = useMemo(() => ({
    page: 1,
    size: 100,
    tenant_slug: tenantSlugValue,
  }), [tenantSlugValue])

  const searchParams = useMemo(() => ({
    ...baseParams,
    keyword: debouncedKeyword || undefined,
  }), [baseParams, debouncedKeyword])

  const {
    data: baseSitesResponse,
    isLoading: baseLoading,
    error: baseError,
  } = useListClientSites(baseParams)
  const {
    data: searchSitesResponse,
    isLoading: searchLoading,
    error: searchError,
  } = useListClientSites(searchParams)

  useEffect(() => {
    if (baseError) logError(t("loading"), baseError)
  }, [baseError, t])

  useEffect(() => {
    if (searchError) logError(t("loading"), searchError)
  }, [searchError, t])

  const baseSites = baseSitesResponse?.list ?? []
  const sites = searchSitesResponse?.list ?? []
  const hasSites = baseSites.length > 0
  const error = baseError || (!baseLoading && !hasSites ? { status: 404, message: t("notFound.title") } : null)

  // 点击外部关闭选择器
  useClickOutside(selectorRef, () => {
    setIsSiteSelectorOpen(false)
    setKeyword("")
  }, isSiteSelectorOpen)

  // 选择站点（含「全部站点」= null）：更新选中、关闭面板、清空搜索词
  const handleSelectSite = (site: ClientSite | null) => {
    setSelectedSite(site)
    setIsSiteSelectorOpen(false)
    setKeyword("")
  }

  if (baseLoading && !hasSites && !error) {
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
            <SiteSelector
              tenantSlug={tenantSlugValue}
              selectedSite={selectedSite}
              isOpen={isSiteSelectorOpen}
              onToggle={() => setIsSiteSelectorOpen(!isSiteSelectorOpen)}
              containerRef={selectorRef}
              keyword={keyword}
              onKeywordChange={setKeyword}
              sites={sites}
              searchLoading={searchLoading}
              onSelect={handleSelectSite}
            />
          )}
        </div>
      </header>

      {/* AI 聊天区域 */}
      <AIChatLanding
        siteName={selectedSite?.name}
        siteId={selectedSite?.id}
        tenantId={selectedSite?.tenant_id || baseSites[0]?.tenant_id}
        tenantSlug={tenantSlugValue}
        siteSlug={selectedSite?.slug}
        quickQuestions={selectedSite?.quick_questions ?? undefined}
        allSites={baseSites}
      />
    </div>
  )
}
