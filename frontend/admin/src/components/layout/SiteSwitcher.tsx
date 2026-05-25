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
import { useState, useMemo } from "react"
import { useTranslations } from "next-intl"
import {
  ChevronDown,
  Check,
  PlusCircle,
  LayoutGrid,
  Globe,
  Edit2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui"
import { Button } from "@/components/ui"
import Link from "next/link"
import Image from "next/image"
import { useRouter, usePathname, useParams, useSearchParams } from "next/navigation"
import type { Site } from "@/lib/sdk/sdk.schemas"
import { UserRole } from "@/lib/sdk/sdk.schemas"
import { setLastSiteSlug, getUserInfo } from "@/lib/auth"
import { useSite } from "@/contexts/SiteContext"

function SiteSwitcherComponent() {
  const t = useTranslations("SiteSwitcher")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const params = useParams()
  const [open, setOpen] = useState(false)
  // 检查权限
  const currentUser = typeof window !== "undefined" ? getUserInfo() : null
  const canManageSites = currentUser?.role === "admin" as const || currentUser?.role === "tenant_admin" as const || currentUser?.role === "site_admin" as const

  // 使用 SiteContext 获取站点列表
  const { sites, isLoadingSites } = useSite()

  // 检查是否在全局管理类页面 (站点管理、系统设置、用户管理)
  const isGlobalPage = useMemo(() => {
    // 排除编辑页面，使其可以显示站点上下文
    if (pathname.startsWith("/sites/edit/")) return false

    return pathname.startsWith("/settings") ||
      pathname === "/users"
  }, [pathname])

  // 获取当前slug
  const currentSlug = params.slug as string | undefined

  // 使用 useMemo 优化站点查找
  const selectedSite = useMemo(() => {
    if (isGlobalPage) return null
    const slugOrId = (params.slug || params.id) as string | undefined
    if (!slugOrId) return null
    return sites.find(s => s.slug === slugOrId || s.id.toString() === slugOrId)
  }, [sites, params.slug, params.id, isGlobalPage])

  const handleSiteSelect = (site: Site) => {
    const slug = site.slug || site.id.toString()
    setLastSiteSlug(slug)

    // 如果当前在全局页面，跳转到选定站点的首页
    if (isGlobalPage) {
      router.push(`/${slug}`)
      return
    }

    // 使用站点标识路由，保持当前路径结构
    if (currentSlug) {
      const pathAfterSlug = pathname.replace(`/${currentSlug}`, "") || "/"
      router.push(`/${slug}${pathAfterSlug}`)
    } else {
      router.push(`/${slug}`)
    }
  }

  // 计算全局页面的标题
  const globalTitle = useMemo(() => {
    if (pathname.startsWith("/settings")) return t("allPlatformSettings")
    if (pathname.startsWith("/users")) return t("userManagement")
    if (pathname.startsWith("/sites")) return t("siteManagement")
    return t("globalManagement")
  }, [pathname, t])
  // Broadway: Personal Account removed from title list.

  // 加载中显示占位符
  if (isLoadingSites) {
    return (
      <div className="w-40 h-12 bg-slate-100 rounded-xl" />
    )
  }

  // 在全局管理类页面时，显示全局状态
  if (isGlobalPage) {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            role="combobox"
            aria-expanded={open}
            aria-label={t("selectSite")}
            className="flex items-center gap-2 px-3 py-2 h-auto hover:bg-slate-100 transition-colors rounded-xl border border-transparent hover:border-slate-200"
          >
            <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0" suppressHydrationWarning>
              <LayoutGrid className="h-4 w-4" />
            </div>
            <div className="flex flex-col items-start text-left">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{t("systemEnvironment")}</span>
              <span className="text-sm font-bold text-slate-900 leading-none">{globalTitle}</span>
            </div>
            <ChevronDown className="ml-2 h-4 w-4 text-slate-400 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[240px]">
          <DropdownMenuLabel>{t("switchToSite")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {sites.map((site) => (
            <DropdownMenuItem
              key={site.id}
              onSelect={() => handleSiteSelect(site)}
              className="flex items-center gap-3 py-2.5 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 overflow-hidden flex items-center justify-center border border-slate-200/50" suppressHydrationWarning>
                {site.icon ? (
                  <Image src={site.icon} alt={site.name} width={32} height={32} className="w-full h-full object-cover" unoptimized />
                ) : (
                  <Globe className="h-4 w-4" />
                )}
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-semibold truncate">{site.name}</span>
                <span className="text-xs text-slate-500 truncate">/{site.slug || "default"}</span>
              </div>
              {canManageSites && (
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`?modal=site-settings&siteId=${site.id}`)
                    setOpen(false)
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-primary transition-all flex-shrink-0"
                  title={t("editSite")}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </div>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu >
    )
  }

  // 如果没有选中的站点，使用第一个站点 (可能为空)
  const activeSite = selectedSite || sites[0]

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          aria-label={t("selectSite")}
          className="flex items-center gap-2 px-3 py-2 h-auto hover:bg-slate-100 transition-colors rounded-xl border border-transparent hover:border-slate-200"
        >
          <div className={cn(
            "w-6 h-6 rounded-lg flex items-center justify-center shrink-0 overflow-hidden",
            activeSite ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-400"
          )} suppressHydrationWarning>
            {activeSite?.icon ? (
              <Image src={activeSite.icon} alt={activeSite.name} width={24} height={24} className="w-full h-full object-cover" unoptimized />
            ) : activeSite ? (
              <Globe className="h-4 w-4" />
            ) : (
              <PlusCircle className="h-4 w-4" />
            )}
          </div>
          <div className="flex flex-col items-start text-left">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">
              {activeSite ? t("currentSite") : t("noSites")}
            </span>
            <span className="text-sm font-bold text-slate-900 leading-none">
              {activeSite ? activeSite.name : t("createSite")}
            </span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 text-slate-400 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        <DropdownMenuLabel>{t("allSites")}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {sites.length === 0 && (
          <DropdownMenuItem
            onSelect={() => {
              router.push("?modal=settings&tab=sites&action=create")
            }}
            className="flex items-center gap-3 py-2.5 cursor-pointer text-primary"
          >
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <PlusCircle className="h-4 w-4" />
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-semibold">{t("createNewSite")}</span>
              <span className="text-xs text-primary/70">{t("startUsing")}</span>
            </div>
          </DropdownMenuItem>
        )}

        {sites.map((site) => (
          <DropdownMenuItem
            key={site.id}
            onSelect={() => handleSiteSelect(site)}
            className="flex items-center gap-3 py-2.5 cursor-pointer"
          >
            <div className={cn(
              "w-8 h-8 rounded-lg transition-colors overflow-hidden flex items-center justify-center",
              activeSite?.id === site.id ? "bg-primary text-white shadow-sm ring-1 ring-primary-foreground/20" : "bg-slate-100 text-slate-500 border border-slate-200/50"
            )} suppressHydrationWarning>
              {site.icon ? (
                <Image src={site.icon} alt={site.name} width={32} height={32} className="w-full h-full object-cover" unoptimized />
              ) : (
                <Globe className="h-4 w-4" />
              )}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-semibold truncate">{site.name}</span>
              <span className="text-xs text-slate-500 truncate">/{site.slug || "default"}</span>
            </div>
            {canManageSites && (
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  router.push(`?modal=site-settings&siteId=${site.id}`)
                  setOpen(false)
                }}
                className={cn(
                  "p-1.5 rounded-lg transition-all flex-shrink-0",
                  "hover:bg-slate-200 text-slate-400 hover:text-primary"
                )}
                title={t("editSite")}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </div>
            )}
          </DropdownMenuItem>
        ))}

        {sites.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                router.push("?modal=settings&tab=sites&action=create")
              }}
              className="flex items-center gap-2 py-2 cursor-pointer text-slate-500"
            >
              <PlusCircle className="h-4 w-4" />
              <span className="text-sm">{t("createNewSite")}</span>
            </DropdownMenuItem>
          </>
        )}

      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const SiteSwitcher = SiteSwitcherComponent