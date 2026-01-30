"use client"

import { motion } from "framer-motion"
import { ArrowRight, Code2, Database, Globe, Lock, Rocket, Zap, Check, Shield, Users, HardDrive, Terminal, Book, Lightbulb, FileText, Search, Github, ChevronRight, Star } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Container } from "@/components/ui/container"
import { cn } from "@/lib/utils"

// --- Data ---
const features = [
  {
    name: "AI 智能问答",
    description: "基于 RAG 引擎的对话助手，支持上下文理解、流式输出及引用溯源，让知识获取更智能。",
    icon: Rocket, // Using Rocket for AI/Speed
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    name: "向量语义搜索",
    description: "内置 pgvector 向量检索与全文搜索，支持关键词高亮，帮您瞬间找到任何文档或代码片段。",
    icon: Search, // Changed to Search icon
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    name: "企业级权限控制",
    description: "完善的 RBAC 权限体系，支持细粒度的角色管理、用户邀请及 SSO 单点登录。",
    icon: Lock,
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  {
    name: "多站点独立部署",
    description: "支持创建多个隔离的知识库站点，可配置独立域名，满足不同团队或项目的个性化需求。",
    icon: Globe,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    name: "现代化文档管理",
    description: "层级目录结构，支持无限级分类、拖拽排序及批量操作。内置 Markdown 高级编辑器。",
    icon: FileText, // Changed to FileText
    color: "text-pink-600",
    bg: "bg-pink-50",
  },
  {
    name: "全栈类型安全",
    description: "基于 FastAPI + Next.js 14 构建，前后端全链路 TypeScript/Pydantic 类型安全，稳健可靠。",
    icon: Code2,
    color: "text-sky-600",
    bg: "bg-sky-50",
  },
]

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-white font-sans selection:bg-sky-100 selection:text-sky-900">

      {/* --- HERO SECTION --- */}
      <section id="hero" className="relative pt-32 pb-24 md:pt-48 md:pb-32 overflow-hidden">
        {/* Background Patterns */}
        <div className="absolute inset-0 bg-dot-slate-200 [mask-image:radial-gradient(ellipse_at_center,white,transparent)] pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
          <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] bg-sky-100/50 rounded-full blur-[120px] mix-blend-multiply" />
          <div className="absolute top-[10%] right-[10%] w-[500px] h-[500px] bg-indigo-100/50 rounded-full blur-[120px] mix-blend-multiply" />
        </div>

        <Container className="relative z-10 text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center rounded-full border border-sky-100 bg-sky-50 px-3 py-1 mb-8 text-sm text-sky-600 font-medium"
          >
            <span className="flex h-2 w-2 rounded-full bg-sky-500 mr-2 animate-pulse" />
            CatWiki v1.0 正式发布
            <ChevronRight className="ml-1 h-4 w-4" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 mb-8 drop-shadow-sm leading-[1.1]">
              企业级 AI 知识库平台 <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600">
                万象在握，知几随行
              </span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-500 mb-12 leading-relaxed">
              集成现代化内容管理、深度 AI 智能问答与极致用户体验。
              <br className="hidden sm:block" />
              专为工程团队设计，完全开源，支持私有化部署。
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" variant="premium" className="w-full sm:w-auto h-12 px-8 text-base shadow-lg shadow-sky-200/50 hover:shadow-sky-300/50 transition-all rounded-full" onClick={() => {
                document.querySelector('#opensource')?.scrollIntoView({ behavior: 'smooth' })
              }}>
                立即开始
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8 text-base bg-white/80 backdrop-blur border-slate-200 hover:bg-white text-slate-700 hover:text-slate-900 rounded-full group" asChild>
                <Link href="https://github.com/bulolo/CatWiki" target="_blank" className="flex items-center gap-2">
                  <Github className="h-5 w-5 text-slate-500 group-hover:text-black transition-colors" />
                  <span>GitHub</span>
                </Link>
              </Button>
            </div>
          </motion.div>

          {/* Hero Image / Preview Placeholder */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-20 relative mx-auto max-w-6xl"
          >
            <div className="glass-card rounded-2xl p-2 md:p-3 shadow-2xl shadow-slate-200/50 border border-slate-200/60 bg-white/50 ring-1 ring-slate-900/5">
              <div className="aspect-[16/10] rounded-xl bg-slate-50 overflow-hidden border border-slate-100 relative shadow-inner group">
                {/* UI Mockup - Sidebar */}
                <div className="absolute top-0 bottom-0 left-0 w-64 bg-white border-r border-slate-100 hidden md:block">
                  <div className="h-14 border-b border-slate-50 flex items-center px-6">
                    <div className="w-20 h-4 bg-slate-100 rounded" />
                  </div>
                  <div className="p-6 space-y-4">
                    <div className="w-full h-8 bg-sky-50 rounded-lg" />
                    <div className="w-3/4 h-4 bg-slate-50 rounded mt-6" />
                    <div className="w-full h-4 bg-slate-50 rounded" />
                    <div className="w-5/6 h-4 bg-slate-50 rounded" />
                  </div>
                </div>

                {/* UI Mockup - Content */}
                <div className="absolute top-0 right-0 bottom-0 left-0 md:left-64 bg-white">
                  <div className="h-14 border-b border-slate-50 flex items-center justify-between px-8">
                    <div className="w-32 h-4 bg-slate-100 rounded" />
                    <div className="flex space-x-2">
                      <div className="w-8 h-8 rounded-full bg-slate-100" />
                      <div className="w-8 h-8 rounded-full bg-sky-500" />
                    </div>
                  </div>
                  <div className="p-10 max-w-3xl mx-auto">
                    <div className="w-3/4 h-10 bg-slate-100 rounded-lg mb-8" />
                    <div className="space-y-4">
                      <div className="w-full h-4 bg-slate-50 rounded" />
                      <div className="w-full h-4 bg-slate-50 rounded" />
                      <div className="w-5/6 h-4 bg-slate-50 rounded" />
                      <div className="w-full h-4 bg-slate-50 rounded" />
                    </div>
                    <div className="mt-12 w-full aspect-video bg-gradient-to-br from-sky-50 to-indigo-50 rounded-xl border border-dashed border-slate-200" />
                  </div>
                </div>

                {/* Browser Controls Overlay */}
                <div className="absolute inset-x-0 top-0 h-10 bg-white/90 backdrop-blur border-b border-slate-100 flex items-center px-4 space-x-2">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]" />
                  <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]" />
                  <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]" />
                  <div className="ml-4 flex-1 h-6 bg-slate-100/50 rounded-md text-xs text-slate-400 flex items-center justify-center font-mono">
                    catwiki.cn
                  </div>
                </div>

                <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent pointer-events-none" />
              </div>
            </div>

            {/* Floating Elements */}
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-8 -bottom-8 md:right-[-50px] md:bottom-20 p-4 bg-white rounded-2xl shadow-xl border border-slate-100 z-20 hidden md:block"
            >
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 p-2 rounded-full"><Check className="w-5 h-5 text-green-600" /></div>
                <div>
                  <div className="text-sm font-bold text-slate-900">部署成功</div>
                  <div className="text-xs text-slate-500">刚刚</div>
                </div>
              </div>
            </motion.div>

          </motion.div>
        </Container>
      </section>

      {/* --- FEATURES SECTION --- */}
      <section className="py-32 relative bg-slate-50/50">
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] pointer-events-none" />
        <Container className="relative">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-slate-900 tracking-tight">为什么开发者选择 CatWiki?</h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-lg leading-relaxed">
              不仅仅是文档工具，更是一个促进团队知识流动、提升协作效率的现代化平台。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="group relative p-8 rounded-2xl bg-white border border-slate-100/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] transition-all duration-300 hover:-translate-y-1"
              >
                <div className="relative z-10">
                  <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-all duration-300 group-hover:scale-110", feature.bg, feature.color)}>
                    <feature.icon className="w-7 h-7" />
                  </div>
                  <h3 className="text-lg font-bold mb-3 text-slate-900">{feature.name}</h3>
                  <p className="text-slate-500 leading-relaxed text-sm">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </Container>
      </section>

      {/* --- LIVE DEMOS SECTION (NEW) --- */}
      <section id="demos" className="py-24 relative bg-white border-t border-slate-100">
        <Container>
          <div className="text-center mb-16">
            <div className="inline-flex items-center space-x-2 bg-indigo-50 rounded-full px-3 py-1 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              <span className="text-sm font-medium text-indigo-600">Online Preview</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-slate-900 tracking-tight">亲身体验 CatWiki</h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-lg">
              无需安装，立即访问我们的在线演示环境，体验管理端、客户端及完整文档。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Admin Demo */}
            <a href="http://admin.catwiki.cn" target="_blank" rel="noreferrer" className="group relative p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 block overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 rounded-bl-[100px] -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform" />
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-xl bg-slate-900 flex items-center justify-center mb-6 text-white shadow-lg shadow-slate-200">
                  <Lock className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors flex items-center">
                  管理后台
                  <ArrowRight className="w-4 h-4 ml-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-indigo-500" />
                </h3>
                <p className="text-slate-500 mb-4 h-12">
                  强大的企业级管理控制台，支持 SSO 配置、审计日志查看及权限管理。
                </p>
                <div className="text-sm font-mono text-slate-400 bg-slate-50 py-2 px-3 rounded border border-slate-100 truncate group-hover:border-indigo-100 group-hover:text-indigo-500 transition-colors">
                  http://admin.catwiki.cn
                </div>
              </div>
            </a>

            {/* Client Demo */}
            <a href="http://demo.catwiki.cn" target="_blank" rel="noreferrer" className="group relative p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 block overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-sky-100 to-blue-200 rounded-bl-[100px] -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform" />
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-xl bg-sky-500 flex items-center justify-center mb-6 text-white shadow-lg shadow-sky-200">
                  <Rocket className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-sky-600 transition-colors flex items-center">
                  知识库前台
                  <ArrowRight className="w-4 h-4 ml-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-sky-500" />
                </h3>
                <p className="text-slate-500 mb-4 h-12">
                  现代化的阅读与搜索体验，支持光速全文检索与向量语义查询。
                </p>
                <div className="text-sm font-mono text-slate-400 bg-slate-50 py-2 px-3 rounded border border-slate-100 truncate group-hover:border-sky-100 group-hover:text-sky-500 transition-colors">
                  http://demo.catwiki.cn
                </div>
              </div>
            </a>

            {/* Docs Demo */}
            <a href="http://docs.catwiki.cn" target="_blank" rel="noreferrer" className="group relative p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 block overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-100 to-teal-200 rounded-bl-[100px] -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform" />
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-xl bg-emerald-500 flex items-center justify-center mb-6 text-white shadow-lg shadow-emerald-200">
                  <Book className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-emerald-600 transition-colors flex items-center">
                  官方文档
                  <ArrowRight className="w-4 h-4 ml-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-emerald-500" />
                </h3>
                <p className="text-slate-500 mb-4 h-12">
                  详尽的开发指南、API 参考手册以及私有化部署最佳实践。
                </p>
                <div className="text-sm font-mono text-slate-400 bg-slate-50 py-2 px-3 rounded border border-slate-100 truncate group-hover:border-emerald-100 group-hover:text-emerald-500 transition-colors">
                  http://docs.catwiki.cn
                </div>
              </div>
            </a>
          </div>
        </Container>
      </section>

      {/* --- OPEN SOURCE SECTION --- */}
      <section id="opensource" className="py-32 relative overflow-hidden bg-white">
        <Container>
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center space-x-2 bg-slate-100 rounded-full px-3 py-1 mb-6">
                <Github className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-600">Open Source</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6 text-slate-900 tracking-tight">
                开源已融入我们的 DNA
              </h2>
              <p className="text-lg text-slate-500 mb-8 leading-relaxed">
                CatWiki 是一款令人自豪的开源软件。无论是代码审计、私有化部署，还是功能扩展，您都拥有完全的掌控权。
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10">
                <div className="flex items-start">
                  <div className="bg-emerald-100 rounded-full p-1 mr-3 mt-1"><Check className="w-3 h-3 text-emerald-600" /></div>
                  <div>
                    <h4 className="font-bold text-slate-900">私有化部署</h4>
                    <p className="text-sm text-slate-500 mt-1">Docker/K8s 一键部署</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="bg-emerald-100 rounded-full p-1 mr-3 mt-1"><Check className="w-3 h-3 text-emerald-600" /></div>
                  <div>
                    <h4 className="font-bold text-slate-900">数据自主</h4>
                    <p className="text-sm text-slate-500 mt-1">支持 Markdown/JSON 导出</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                <Button size="lg" className="bg-slate-900 text-white hover:bg-slate-800 rounded-full px-8 shadow-xl shadow-slate-200 h-12" asChild>
                  <Link href="https://github.com/bulolo/CatWiki" target="_blank" className="flex items-center gap-2">
                    <Github className="h-5 w-5" />
                    <span>在 GitHub 上标星</span>
                  </Link>
                </Button>
              </div>
            </div>

            <div className="flex-1 w-full relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-sky-100 to-indigo-100 rounded-[2rem] blur-2xl opacity-50" />
              <div className="relative bg-[#1e293b] rounded-2xl shadow-2xl overflow-hidden border border-slate-700">
                <div className="flex items-center px-4 py-3 border-b border-slate-700 bg-[#0f172a]">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
                  </div>
                  <div className="ml-4 text-xs text-slate-400 font-mono">terminal — -zsh — 80x24</div>
                </div>
                <div className="p-6 font-mono text-sm leading-relaxed">
                  <div className="flex mb-2">
                    <span className="text-green-400 mr-2">➜</span>
                    <span className="text-sky-400 mr-2">~</span>
                    <span className="text-slate-300">git clone https://github.com/bulolo/CatWiki.git</span>
                  </div>
                  <div className="text-slate-500 mb-4">Cloning into 'CatWiki'...</div>

                  <div className="flex mb-2">
                    <span className="text-green-400 mr-2">➜</span>
                    <span className="text-sky-400 mr-2">~</span>
                    <span className="text-slate-300">cd CatWiki && make prod-init && make prod-up</span>
                  </div>
                  <div className="text-slate-500 mb-1">Creating network "catwiki_default" with the default driver</div>
                  <div className="text-slate-500 mb-1">Creating catwiki_db_1 ... <span className="text-green-400">done</span></div>
                  <div className="text-slate-500 mb-1">Creating catwiki_api_1 ... <span className="text-green-400">done</span></div>
                  <div className="text-slate-500 mb-4">Creating catwiki_web_1 ... <span className="text-green-400">done</span></div>

                  <div className="flex animate-pulse">
                    <span className="text-green-400 mr-2">➜</span>
                    <span className="text-sky-400 mr-2">catwiki</span>
                    <span className="w-2 h-5 bg-slate-500 block" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* --- ENTERPRISE SECTION --- */}
      <section id="enterprise" className="py-32 bg-slate-50 relative">
        <Container>
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-6 text-slate-900 tracking-tight">灵活的方案，满足不同需求</h2>
            <p className="text-slate-500 max-w-2xl mx-auto text-lg">
              无论您是个人开发者还是大型企业，CatWiki 都有适合您的版本。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <div className="p-8 rounded-[2rem] bg-white border border-slate-200 shadow-sm flex flex-col hover:shadow-lg transition-all duration-300">
              <h3 className="text-xl font-bold text-slate-900 mb-2">开源版</h3>
              <p className="text-slate-500 mb-6 text-sm h-10">适合个人开发者与技术尝鲜。</p>
              <div className="text-4xl font-bold text-slate-900 mb-6 tracking-tight">Free</div>

              <ul className="space-y-4 mb-8 flex-1">
                {["无限公开文档", "基础搜索功能", "社区技术支持", "Docker 部署", "PostgreSQL 数据库"].map((feature) => (
                  <li key={feature} className="flex items-center text-slate-600 text-sm">
                    <div className="mr-3 bg-emerald-100 rounded-full p-1"><Check className="h-3 w-3 text-emerald-600" /></div>
                    {feature}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full rounded-full border-slate-300 hover:border-slate-400 text-slate-700 h-10">
                立即下载
              </Button>
            </div>

            {/* Customized Plan (New) */}
            <div className="p-8 rounded-[2rem] bg-slate-900 text-white shadow-2xl flex flex-col relative overflow-hidden hover:-translate-y-1 transition-all duration-300">
              <h3 className="text-xl font-bold mb-2 text-white">定制版</h3>
              <p className="text-slate-400 mb-6 text-sm h-10">针对大型企业的深度定制与专属服务。</p>
              <div className="text-4xl font-bold mb-6 tracking-tight">定制</div>

              <ul className="space-y-4 mb-8 flex-1">
                {["包含所有标准功能", "SSO 单点登录", "源码交付", "私有化部署实施", "定制向量模型", "专属客户经理"].map((feature) => (
                  <li key={feature} className="flex items-center text-slate-300 text-sm">
                    <div className="mr-3 bg-sky-500/20 rounded-full p-1"><Check className="h-3 w-3 text-sky-400" /></div>
                    {feature}
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full bg-transparent text-white border-slate-700 hover:bg-slate-800 hover:text-white h-10 rounded-full">
                联系销售
              </Button>
            </div>
          </div>
        </Container>
      </section>


      {/* --- CTA BOTTOM --- */}
      <section className="py-24 relative overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <Container>
          <div className="relative z-10 max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-8">
              准备好重塑团队的知识管理了吗？
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="w-full sm:w-auto h-14 px-10 rounded-full text-lg bg-white text-slate-900 hover:bg-sky-50 hover:text-slate-900 border-0 shadow-lg shadow-white/10 font-bold">
                免费开始使用
              </Button>
            </div>
            <p className="mt-8 text-slate-400 text-sm">
              开源版本永久免费 · 包含所有核心功能 · 无需信用卡
            </p>
          </div>
        </Container>
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-12 bg-slate-950 text-slate-400 border-t border-slate-800">
        <Container>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-1">
              <div className="font-bold text-white text-2xl mb-4">CatWiki</div>
              <p className="text-sm leading-relaxed">
                为未来构建的开源知识库系统。
              </p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">产品</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">功能</a></li>
                <li><a href="#enterprise" className="hover:text-white transition-colors">企业版</a></li>
                <li><a href="#" className="hover:text-white transition-colors">路线图</a></li>
                <li><a href="#" className="hover:text-white transition-colors">更新日志</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">资源</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
                <li><a href="#" className="hover:text-white transition-colors">社区</a></li>
                <li><a href="https://github.com/bulolo/CatWiki" className="hover:text-white transition-colors">GitHub</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">公司</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">关于我们</a></li>
                <li><a href="#" className="hover:text-white transition-colors">博客</a></li>
                <li><a href="#" className="hover:text-white transition-colors">联系我们</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center text-xs">
            <p>&copy; {new Date().getFullYear()} CatWiki. 保留所有权利。 <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer" className="hover:text-white transition-colors ml-4">粤ICP备15028622号-16</a></p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href="#" className="hover:text-white transition-colors">隐私政策</Link>
              <Link href="#" className="hover:text-white transition-colors">服务条款</Link>
              <Link href="#" className="hover:text-white transition-colors">Cookies</Link>
            </div>
          </div>
        </Container>
      </footer>
    </div>
  )
}
