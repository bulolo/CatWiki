"use client"

import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Plus,
  Edit2,
  Trash2,
  Globe,
  ArrowUpRight,
  BookOpen,
  Settings,
  LayoutGrid,
  Loader2
} from "lucide-react"
import { CLIENT_SITE_URL } from "@/constants/constants"
import { useSite } from "@/contexts/SiteContext"
import { useDeleteSite } from "@/hooks"
import { cn } from "@/lib/utils"
import type { Site } from "@/lib/api-client"


import { CreateSiteForm } from "./CreateSiteForm"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

export function GlobalSites() {
  const [mounted, setMounted] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isCreating = searchParams.get('action') === 'create'

  // 确保水合一致性
  useEffect(() => {
    setMounted(true)
  }, [])

  // 从 SiteContext 获取站点列表和刷新函数，避免重复请求
  const { sites, isLoadingSites, refetchSites } = useSite()

  // 使用 React Query 删除 hook
  const deleteSiteMutation = useDeleteSite()

  // 删除站点
  const handleDelete = (id: number, name: string) => {
    if (!confirm(`确定要删除站点"${name}"吗?此操作不可恢复。`)) {
      return
    }

    deleteSiteMutation.mutate(id, {
      onSuccess: async () => {
        // 刷新站点列表
        await refetchSites()
      }
    })
  }

  const handleStartCreate = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("action", "create")
    router.replace(`${pathname}?${params.toString()}`)
  }

  const handleCancelCreate = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("action")
    router.replace(`${pathname}?${params.toString()}`)
  }

  const handleCreateSuccess = async () => {
    await refetchSites()
    handleCancelCreate()
  }

  if (isCreating) {
    return (
      <div key="create" className="animate-in fade-in slide-in-from-right-4 duration-300">
        <CreateSiteForm
          onCancel={handleCancelCreate}
          onSuccess={handleCreateSuccess}
        />
      </div>
    )
  }

  if (!mounted || isLoadingSites || deleteSiteMutation.isPending) {
    return (
      <LoadingState />
    )
  }

  return (
    <div key="list" className="animate-in fade-in slide-in-from-left-4 duration-300">
      <div className="space-y-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-5">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm ring-1 ring-primary/20">
            <Globe className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">站点管理</h2>
            <p className="text-sm text-slate-500 font-medium">全局管理您的所有 Wiki 知识库站点。</p>
          </div>
        </div>
        <Button
          className="flex items-center gap-2 rounded-xl shadow-lg shadow-primary/20"
          size="default"
          onClick={handleStartCreate}
        >
          <Plus className="h-4 w-4" />
          创建站点
        </Button>
      </div>

      {sites.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="暂无站点"
          description="暂无站点，点击上方按钮创建第一个站点"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {sites.map((site: Site) => (

            <Card key={site.id} className="group hover:shadow-lg transition-all duration-300 border-border/60 rounded-2xl overflow-hidden bg-card/50 hover:bg-card">
              <CardHeader className="pb-3 pt-4 px-4">
                <div className="flex justify-between items-start">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                    <Globe className="h-4 w-4" />
                  </div>
                  <div className="flex gap-1">
                    <Link href={`?modal=settings&context=site&siteId=${site.id}`} scroll={false}>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="站点设置">
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={() => handleDelete(site.id, site.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3">
                  <CardTitle className="text-base font-bold group-hover:text-primary transition-colors line-clamp-1 tracking-tight">
                    {site.name}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="px-1.5 py-0.5 rounded-md bg-muted/50 border border-border/50">
                      <span className="text-[10px] text-muted-foreground font-mono font-medium tracking-wider">/{site.domain || 'default'}</span>
                    </div>
                    <Badge variant={site.status === "active" ? "success" : "outline"} className={cn(
                      "text-[10px] px-1.5 py-0 h-4 font-bold tracking-tight border-none",
                      site.status === "active" ? "bg-emerald-500/10 text-emerald-600 shadow-sm shadow-emerald-500/10" : "bg-muted text-muted-foreground"
                    )}>
                      {site.status === "active" ? "已激活" : "已禁用"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-xs text-muted-foreground/80 line-clamp-2 h-8 mb-4 leading-relaxed">
                  {site.description || "该站点暂无详细描述，您可以在编辑页面中添加相关说明。"}
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <a href={`${CLIENT_SITE_URL}/${site.domain || site.id}`} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="w-full h-9 text-xs font-bold flex items-center justify-center gap-2 rounded-xl border-border/60 hover:bg-slate-100 hover:text-slate-900 transition-all duration-300 shadow-sm">
                      <BookOpen className="h-3.5 w-3.5" />
                      进入站点
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-50" />
                    </Button>
                  </a>
                  <Link href={`/${site.domain || site.id}`}>
                    <Button size="sm" className="w-full h-9 text-xs font-bold flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground transition-all duration-300 shadow-sm shadow-primary/20">
                      <LayoutGrid className="h-3.5 w-3.5" />
                      内容管理
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
