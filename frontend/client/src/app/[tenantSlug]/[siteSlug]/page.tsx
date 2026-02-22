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

import { useState, useEffect, Suspense, useMemo } from "react"
import { useParams, useSearchParams, useRouter, notFound } from "next/navigation"
import { Sidebar } from "@/layout/Sidebar"
import { SearchBar } from "@/components/search/SearchBar"
import { AIChat } from "@/components/ai/AIChat"
import { DocumentDetail } from "@/components/document"
import { AIChatLanding } from "@/components/ai"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSiteBySlug, useMenuTree, useDocument } from "@/hooks"
import { PageLoading } from "@/components/ui/loading"
import { NotFoundState } from "@/components/ui/not-found"
import type { MenuItem } from "@/types"
import { ThemeProvider, type ThemeColor } from "@/contexts"

function SlugPageContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const tenantSlug = params.tenantSlug as string
  const siteSlug = params.siteSlug as string
  const documentIdFromUrl = searchParams.get("documentId")

  // 使用 React Query 获取站点信息（自动缓存）
  const { data: site, isLoading: siteLoading } = useSiteBySlug(siteSlug)

  // 从站点信息中提取配置
  const siteName = site?.name || "知识库"
  const themeColor = (site?.theme_color || "blue") as ThemeColor
  const layoutMode = (site?.layout_mode || "sidebar") as "sidebar" | "top"

  // 使用 React Query 获取菜单树（自动缓存）
  const { data: menuItems = [] } = useMenuTree(site?.id || null)

  // 使用 React Query 获取文档详情（自动缓存）
  const { data: selectedDocument, isLoading: documentLoading } = useDocument(documentIdFromUrl)

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
    return <PageLoading text="正在加载站点..." />
  }

  if (!site) {
    // 触发 not-found.tsx
    notFound()
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
                aria-label="打开菜单"
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
          </header>

          {/* 视图切换 */}
          <div className="flex-1 overflow-hidden relative">
            {currentView.type === 'ai-home' ? (
              <AIChatLanding
                siteName={siteName}
                siteId={site?.id}
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
          allSites={site ? [site] : undefined}
        />
      </div>
    </ThemeProvider>
  )
}

export default function SlugPage() {
  return (
    <Suspense fallback={<PageLoading text="正在检索知识库..." />}>
      <SlugPageContent />
    </Suspense>
  )
}

