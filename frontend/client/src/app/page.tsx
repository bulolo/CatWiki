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
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { api } from "@/lib/api-client"
import { logError } from "@/lib/error-handler"
import {
  BookOpen,
  ChevronRight,
  Github,
  LayoutDashboard,
  Search,
  TrendingUp,
  Grid3X3,
  Maximize2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PageLoading, Input } from "@/components/ui"
import { SiteCard } from "@/components/sites"
import { AIChatLanding } from "@/components/ai"
import type { ClientSite } from "@/lib/api-client"
import { env } from "@/lib/env"

export default function HomePage() {
  const router = useRouter()
  const [sites, setSites] = useState<ClientSite[]>([])
  const [popularDocs, setPopularDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSite, setSelectedSite] = useState<ClientSite | null>(null)
  const [keyword, setKeyword] = useState("")

  useEffect(() => {
    const loadSites = async () => {
      try {
        const results = await Promise.allSettled([
          api.site.list({
            page: 1,
            size: 100,
            keyword: keyword || undefined
          }),
          api.document.list({
            size: 6,
            orderBy: 'views',
            orderDir: 'desc',
            includeSiteInfo: true
          })
        ])

        if (results[0].status === 'fulfilled') {
          setSites(results[0].value.list || [])
        } else {
          logError(results[0].reason, "加载站点列表失败")
        }

        if (results[1].status === 'fulfilled') {
          setPopularDocs(results[1].value.list || [])
        } else {
          logError(results[1].reason, "加载热门文档失败")
        }
      } catch (error: any) {
        logError(error, "数据加载逻辑异常")
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(() => {
      loadSites()
    }, 300)

    return () => clearTimeout(timer)
  }, [keyword])

  const handleVisit = (site: ClientSite) => {
    if (site.slug) {
      router.push(`/${site.tenant_slug || "default"}/${site.slug}`)
    }
  }

  if (loading && !keyword) {
    return <PageLoading text="正在发现新知识..." />
  }

  return (
    <div className="min-h-screen bg-slate-50/50 relative overflow-x-hidden font-sans">
      {/* 动态背景装饰 */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[0%] right-[-5%] w-[40%] h-[40%] rounded-full bg-purple-500/5 blur-[100px]" />
        <div className="absolute top-[20%] right-[-10%] w-[30%] h-[30%] rounded-full bg-amber-500/5 blur-[80px]" />
      </div>

      {/* 顶部导航 */}
      <header className="fixed top-0 left-0 w-full z-50 h-16 border-b border-slate-100 bg-white/70 backdrop-blur-xl flex items-center justify-between px-6 md:px-10">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9">
            <Image
              src="/logo.png"
              alt="CatWiki Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <span className="text-lg font-black tracking-tight text-slate-900 group">CatWiki<span className="text-primary tracking-tighter ml-0.5">.</span></span>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold text-slate-600 hover:text-primary transition-colors">广场</Link>
          <a href={env.NEXT_PUBLIC_DOCS_URL} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-slate-400 hover:text-slate-600 transition-colors">文档</a>
          <div className="w-px h-4 bg-slate-200" />
          <a
            href="https://github.com/bulolo/CatWiki"
            target="_blank"
            className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 pr-2 group"
          >
            <Github className="h-4 w-4 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-bold">Star</span>
          </a>
        </nav>

        <div className="flex items-center gap-4">
          <button
            onClick={() => window.open(env.NEXT_PUBLIC_ADMIN_URL, "_blank")}
            className="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-900/10"
          >
            <LayoutDashboard className="h-4 w-4" />
            管理中心
          </button>
        </div>
      </header>

      {/* 主体内容 */}
      <main className="relative z-10 pt-32 pb-24 px-6 max-w-[1440px] mx-auto min-h-screen">
        {/* Hero Section */}
        <section className="max-w-4xl mx-auto text-center mb-16 md:mb-24">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-primary font-bold text-xs md:text-sm mb-6">
              发现 · 连接 · 智慧
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-slate-900 tracking-tight leading-[1.1] mb-6 text-balance">
              欢迎来到 <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-purple-600 to-indigo-600 text-balance">CatWiki 知识广场</span>
            </h1>
            <p className="text-slate-500 text-base md:text-xl max-w-3xl mx-auto leading-relaxed mb-10 text-balance">
              这里是智慧的交汇点。连接分散的知识节点，发现隐藏的深度洞见，让每一个站点都能通过 AI 焕然一新，让搜索与对话触手可及。
            </p>

            {/* 中心化搜索栏 */}
            <div className="relative max-w-2xl mx-auto group">
              <div className="absolute inset-0 bg-primary/20 blur-[30px] rounded-[2rem] opacity-0 group-focus-within:opacity-100 transition-opacity" />
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400 transition-colors" />
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="搜索并探索任何感兴趣的站点或内容..."
                  className="w-full h-16 md:h-20 pl-16 pr-6 bg-white border-white rounded-2xl md:rounded-3xl shadow-2xl shadow-slate-200/50 text-base md:text-lg focus-visible:ring-primary/20 focus-visible:border-primary/30 transition-all font-medium border-2"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-2">
                  <span className="px-2 py-1 bg-slate-50 border border-slate-100 rounded text-[10px] font-bold text-slate-400">Search</span>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* 广场看板 */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-primary rounded-full" />
              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">发现站点广场</h2>
              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full ml-1">
                {sites.length} 个开放节点
              </span>
            </div>

            {/* 布局切换与全屏功能暂未开通，隐藏 */}
            {/* <div className="flex items-center gap-2">
              <button className="p-2 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-600 hover:text-primary transition-all">
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-600 hover:text-primary transition-all text-sm font-semibold">
                <Maximize2 className="h-4 w-4" />
                全屏浏览
              </button>
            </div> */}
          </div>

          {/* Grid Layout */}
          <AnimatePresence mode="popLayout">
            {sites.length > 0 ? (
              <motion.div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8"
                layout
              >
                {sites.map((site) => (
                  <SiteCard
                    key={site.id}
                    site={site}
                    onSelect={(s) => setSelectedSite(s)}
                    onVisit={(s) => handleVisit(s)}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-20 flex flex-col items-center justify-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200"
              >
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <Search className="h-8 w-8 text-slate-300" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">未找到匹配的站点</h3>
                <p className="text-slate-500 max-w-sm text-center px-6">
                  尝试更换搜索关键字，或在此创建一个属于您自己的知识空间。
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
        {/* 热门文档推荐 */}
        <section className="mt-20 mb-20">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">热门知识内容</h2>
            <TrendingUp className="h-5 w-5 text-purple-500" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {popularDocs.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                onClick={() => {
                  if (doc.site_slug && doc.id) {
                    const tSlug = doc.tenant_slug || "default";
                    router.push(`/${tSlug}/${doc.site_slug}?documentId=${doc.id}`);
                  }
                }}
              />
            ))}
          </div>
          {popularDocs.length === 0 && !loading && (
            <div className="py-12 bg-white/50 rounded-3xl border border-slate-100 flex flex-center justify-center text-slate-400 text-sm font-medium">
              暂无热门内容推荐
            </div>
          )}
        </section>
      </main>

      {/* AI Chat Drawer / Backdrop */}
      <AnimatePresence>
        {selectedSite && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
              onClick={() => setSelectedSite(null)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-screen w-full md:w-[600px] lg:w-[800px] bg-white z-[110] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white/80 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 tracking-tight">{selectedSite.name} <span className="text-slate-400 font-medium ml-1">AI 助手</span></h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{selectedSite.tenant_slug || "DEFAULT"} 知识库</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSite(null)}
                  className="p-2 hover:bg-slate-50 rounded-lg transition-colors group"
                >
                  <ChevronRight className="h-6 w-6 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>

              <div className="flex-1 overflow-hidden">
                <AIChatLanding
                  siteName={selectedSite.name}
                  siteId={selectedSite.id}
                  quickQuestions={selectedSite.quick_questions ?? undefined}
                  allSites={sites}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 页脚 */}
      <footer className="relative z-10 border-t border-slate-100 bg-white py-12">
        <div className="max-w-[1440px] mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 opacity-40">
            <BookOpen className="h-5 w-5" />
            <span className="text-sm font-bold tracking-tight">CatWiki Project &copy; {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

/**
 * 热门文档卡片组件
 */
const DocCard = ({ doc, onClick }: { doc: any; onClick: () => void }) => {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      onClick={onClick}
      className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-purple-500/5 transition-all cursor-pointer group flex flex-col h-full relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl -translate-y-12 translate-x-12 group-hover:bg-purple-500/10 transition-colors" />

      <div className="flex items-center gap-2 mb-4 relative z-10">
        <div className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase tracking-wider">
          {doc.site_name || "默认站点"}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold">
          <TrendingUp className="h-3 w-3 text-purple-400" />
          {doc.views || 0} 浏览
        </div>
      </div>

      <h4 className="font-bold text-slate-900 group-hover:text-primary transition-colors line-clamp-2 mb-2 flex-grow text-lg tracking-tight">
        {doc.title}
      </h4>

      <p className="text-sm text-slate-500 line-clamp-2 mb-5 leading-relaxed">
        {doc.summary || "聚合全平台开放知识库，实现精准检索与智能对话。"}
      </p>

      <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-slate-100 rounded-full flex items-center justify-center text-[8px] text-slate-400 font-bold uppercase">
            {doc.author?.charAt(0) || "C"}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            {doc.author || "系统管理员"} · {new Date(doc.created_at).toLocaleDateString()}
          </span>
        </div>
        <div className="flex items-center text-primary text-[10px] font-bold gap-1 translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
          阅读全文 <ChevronRight className="h-3 w-3" />
        </div>
      </div>
    </motion.div>
  )
}
