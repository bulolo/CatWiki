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

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, LoadingState, useConfirm } from "@/components/ui"
import { useState, useEffect } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import Link from "next/link"
import Image from "next/image"
import {
  Plus,
  Edit2,
  Trash2,
  Globe,
  ArrowUpRight,
  BookOpen,
  LayoutGrid
} from "lucide-react"
import { env } from "@/lib/env"
import { useSite } from "@/contexts/SiteContext"
import { useDeleteSite } from "@/hooks"

import { cn } from "@/lib/utils"
import type { Site } from "@/lib/sdk/sdk.schemas"


import { CreateSiteForm } from "./CreateSiteForm"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

export function GlobalSites() {
  const [mounted, setMounted] = useState(false)
  const t = useTranslations("Sites")
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isCreating = searchParams.get("action") === "create"

  // 确保水合一致性
  useEffect(() => {
    setMounted(true)
  }, [])

  // 从 SiteContext 获取站点列表和刷新函数，避免重复请求
  const { sites, isLoadingSites, refetchSites } = useSite()

  // 使用 React Query 删除 hook
  const deleteSiteMutation = useDeleteSite()
  const confirm = useConfirm()


  // 删除站点
  const handleDelete = async (id: number, name: string) => {
    if (!await confirm({ description: t("deleteConfirm", { name }), variant: "destructive" })) return

    deleteSiteMutation.mutate(id, {
      onSuccess: async () => {
        toast.success(t("deleteSuccess"))
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
              <h2 className="text-xl font-bold tracking-tight text-slate-900">{t("title")}</h2>
              <p className="text-sm text-slate-500 font-medium">{t("description")}</p>
            </div>
          </div>
          <Button
            className="flex items-center gap-2"
            size="sm"
            onClick={handleStartCreate}
          >
            <Plus className="h-4 w-4" />
            {t("addSite")}
          </Button>
        </div>

        {sites.length === 0 ? (
          <EmptyState
            icon={Globe}
            title={t("empty")}
            description={t("emptyDesc")}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            {sites.map((site: Site) => (

              <Card key={site.id} className="group hover:shadow-lg transition-shadow border-border/60 overflow-hidden bg-card/50 hover:bg-card">
                <CardHeader className="pb-3 pt-4 px-4">
                  <div className="flex justify-between items-start">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary group-hover:bg-white group-hover:text-primary transition-colors overflow-hidden flex items-center justify-center border border-transparent group-hover:border-primary/20 shadow-sm">
                      {site.icon ? (
                        <Image src={site.icon} alt={site.name} width={40} height={40} className="w-full h-full object-cover" unoptimized />
                      ) : (
                        <Globe className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Link href={`?modal=site-settings&siteId=${site.id}`} scroll={false}>
                        <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title={t("siteSettings")}>
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
                        <span className="text-[10px] text-muted-foreground font-mono font-medium tracking-wider">/{site.slug || "default"}</span>
                      </div>
                      <Badge variant={site.status === "active" ? "success" : "outline"} className={cn(
                        "text-[10px] px-1.5 py-0 h-4 font-bold tracking-tight border-none",
                        site.status === "active" ? "bg-emerald-500/10 text-emerald-600 shadow-sm shadow-emerald-500/10" : "bg-muted text-muted-foreground"
                      )}>
                        {site.status === "active" ? t("status.active") : t("status.inactive")}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-xs text-muted-foreground/80 line-clamp-2 h-8 mb-4 leading-relaxed">
                    {site.description || t("noDescription")}
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <a href={`${env.NEXT_PUBLIC_CLIENT_URL}/${site.tenant_slug || "default"}/${site.slug || site.id}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="w-full flex items-center justify-center gap-2">
                        <BookOpen className="h-3.5 w-3.5" />
                        {t("enterSite")}
                        <ArrowUpRight className="h-3.5 w-3.5 opacity-50" />
                      </Button>
                    </a>
                    <Link href={`/${site.slug || site.id}`}>
                      <Button size="sm" className="w-full flex items-center justify-center gap-2">
                        <LayoutGrid className="h-3.5 w-3.5" />
                        {t("contentManagement")}
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
