"use client"

import { useState, useEffect, Suspense, useMemo, useCallback } from "react"
import { useParams, useSearchParams, useRouter, notFound } from "next/navigation"
import { useTranslations } from "next-intl"
import { Sidebar } from "@/components/layout"
import { SearchBar } from "@/components/search/SearchBar"
import { AIChat, AIChatLanding } from "@/components/ai"
import { DocumentDetail } from "@/components/document"
import { Menu } from "lucide-react"
import { useSiteBySlug, useMenuTree, useDocument } from "@/hooks"
import { PageLoading, NotFoundState, Button } from "@/components/ui"
import type { MenuItem } from "@/types"
import { ThemeProvider, type ThemeColor } from "@/contexts"
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher"
import { SitePasswordGate } from "@/components/auth/SitePasswordGate"
import { HttpError } from "@/lib/api-client"

function SlugPageContent() {
  const t = useTranslations("SlugPage")
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const tenantSlug = params.tenantSlug as string
  const siteSlug = params.siteSlug as string
  const documentIdFromUrl = searchParams.get("documentId")

  // 使用 React Query 获取站点信息（自动缓存）
  const { data: site, isLoading: siteLoading } = useSiteBySlug(siteSlug)

  // 站点访问验证状态
  const [siteAccessVerified, setSiteAccessVerified] = useState(() => {
    if (typeof window === "undefined") return false
    return !!sessionStorage.getItem(`site_access_token:${siteSlug}`)
  })

  // 403 回调：token 失效时清除并重新要求验证
  const resetSiteAccess = useCallback(() => {
    sessionStorage.removeItem(`site_access_token:${siteSlug}`)
    setSiteAccessVerified(false)
  }, [siteSlug])

  // 是否被密码门拦截（需要密码且尚未验证）
  const isPasswordGated = !!site?.requires_password && !siteAccessVerified
  // 站点内容可加载（站点已获取 + 密码已通过）
  const contentReady = !!site?.id && !isPasswordGated

  // 从站点信息中提取配置
  const siteName = site?.name || t("defaultSiteName")
  const themeColor = (site?.theme_color || "blue") as ThemeColor
  const layoutMode = (site?.layout_mode || "sidebar") as "sidebar" | "top"

  // 使用 React Query 获取菜单树（仅在验证通过后请求）
  const { data: menuItems = [], error: menuError } = useMenuTree(contentReady ? site!.id : null)

  // 使用 React Query 获取文档详情（自动缓存）
  const { data: selectedDocument, isLoading: documentLoading } = useDocument(
    contentReady ? documentIdFromUrl : null
  )

  // 检测 403：token 失效（管理员改了密码），重新要求验证
  useEffect(() => {
    if (menuError instanceof HttpError && menuError.status === 403) {
      resetSiteAccess()
    }
  }, [menuError, resetSiteAccess])

  // 计算当前视图（使用 useMemo 避免不必要的重新计算）
  const currentView = useMemo(() => {
    // 如果有 documentId，即使文档还在加载，也应该显示文档视图
    if (documentIdFromUrl) {
      return { id: selectedDocument?.id || documentIdFromUrl, type: 'article' as const }
    }
    return { id: 'ai-home', type: 'ai-home' as const }
  }, [documentIdFromUrl, selectedDocument])

  // 设置浏览器标题（优化：只在实际变化时更新）
  useEffect(() => {
    const newTitle = selectedDocument
      ? `${selectedDocument.title} - ${siteName}`
      : siteName

    if (document.title !== newTitle) {
      document.title = newTitle
    }
  }, [siteName, selectedDocument])

  const [isChatOpen, setIsChatOpen] = useState(false)
  const [initialAIQuery, setInitialAIQuery] = useState("")
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  const handleSelectItem = (item: MenuItem | { id: string, type: 'special' }) => {
    if ('type' in item && item.type === 'special' && item.id === 'ai-home') {
      router.push(`/${tenantSlug}/${siteSlug}`, { scroll: false })
    } else {
      const menuItem = item as MenuItem
      if (menuItem.type === "article") {
        router.push(`/${tenantSlug}/${siteSlug}?documentId=${menuItem.id}`, { scroll: false })
      }
    }
    setIsMobileSidebarOpen(false)
  }

  const handleOpenAIChat = (query: string) => {
    setInitialAIQuery(query)
    setIsChatOpen(true)
  }

  const handleChatOpenChange = (open: boolean) => {
    setIsChatOpen(open)
    if (!open) {
      setInitialAIQuery("")
    }
  }

  if (siteLoading) {
    return <PageLoading text={t("loading")} />
  }

  if (!site) {
    // 触发 not-found.tsx
    notFound()
  }

  // 密码保护拦截
  if (isPasswordGated) {
    return (
      <SitePasswordGate
        siteSlug={siteSlug}
        siteName={site.name}
        hasPassword={site.has_password ?? false}
        onVerified={() => setSiteAccessVerified(true)}
      />
    )
  }

  return (
    <ThemeProvider initialThemeColor={themeColor} initialLayoutMode={layoutMode}>
      <div className="h-screen flex bg-white overflow-hidden">
        {/* 移动端遮罩层 */}
        {isMobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
        )}

        {/* 左侧目录 - 根据布局模式显示/隐藏 */}
        {layoutMode === "sidebar" && (
          <Sidebar
            items={menuItems}
            selectedId={currentView.id}
            onSelect={handleSelectItem}
            isOpen={isMobileSidebarOpen}
            onClose={() => setIsMobileSidebarOpen(false)}
            siteName={siteName}
          />
        )}

        {/* 主内容区域 */}
        <main className="flex-1 flex flex-col min-w-0 bg-white relative">
          {/* 顶部固定导航栏 */}
          <header className="h-14 md:h-16 border-b border-slate-100 flex items-center gap-4 px-4 md:px-8 bg-white/80 backdrop-blur-md z-20 shrink-0">
            {/* 移动端菜单按钮 - 仅在侧边栏模式下显示 */}
            {layoutMode === "sidebar" && (
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden shrink-0"
                onClick={() => setIsMobileSidebarOpen(true)}
                aria-label={t("openMenu")}
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}

            {/* 搜索栏 */}
            <div className="flex-1 max-w-3xl">
              <SearchBar
                items={menuItems}
                onSelect={(item) => handleSelectItem(item)}
                onAskAI={handleOpenAIChat}
              />
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
            </div>
          </header>

          {/* 视图切换 */}
          <div className="flex-1 overflow-hidden relative">
            {currentView.type === 'ai-home' ? (
              <AIChatLanding
                siteName={siteName}
                siteId={site?.id}
                tenantId={site?.tenant_id}
                quickQuestions={site?.quick_questions ?? undefined}
                allSites={site ? [site] : undefined}
              />
            ) : (
              <DocumentDetail
                document={selectedDocument}
                isLoading={documentLoading && !selectedDocument}
              />
            )}
          </div>
        </main>

        {/* 弹窗式 AI 聊天对话框 (用于搜索触发) */}
        <AIChat
          open={isChatOpen}
          onOpenChange={handleChatOpenChange}
          initialQuery={initialAIQuery}
          siteId={site?.id}
          tenantId={site?.tenant_id}
          allSites={site ? [site] : undefined}
        />
      </div>
    </ThemeProvider>
  )
}

export default function SlugPage() {
  const t = useTranslations("SlugPage")
  return (
    <Suspense fallback={<PageLoading text={t("retrieving")} />}>
      <SlugPageContent />
    </Suspense>
  )
}

