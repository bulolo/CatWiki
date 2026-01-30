"use client"

import { useState, useMemo } from "react"
import {
  ChevronDown,
  Check,
  PlusCircle,
  LayoutGrid,
  Globe,
  Edit2
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useRouter, usePathname, useParams, useSearchParams } from "next/navigation"
import type { Site } from "@/lib/api-client"
import { UserRole } from "@/lib/api-client"
import { setLastSiteDomain, getUserInfo } from "@/lib/auth"
import { useSite } from "@/contexts/SiteContext"

function SiteSwitcherComponent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const params = useParams()
  const [open, setOpen] = useState(false)
  // 检查权限
  const currentUser = typeof window !== 'undefined' ? getUserInfo() : null
  const canManageSites = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SITE_ADMIN

  // 使用 SiteContext 获取站点列表
  const { sites, isLoadingSites } = useSite()

  // 检查是否在全局管理类页面 (站点管理、系统设置、用户管理)
  const isGlobalPage = useMemo(() => {
    // 排除编辑页面，使其可以显示站点上下文
    if (pathname.startsWith('/sites/edit/')) return false

    return pathname.startsWith('/settings') ||
      pathname === '/users'
  }, [pathname])

  // 获取当前domain
  const currentDomain = params.domain as string | undefined

  // 使用 useMemo 优化站点查找
  const selectedSite = useMemo(() => {
    if (isGlobalPage) return null
    const domainOrId = (params.domain || params.id) as string | undefined
    if (!domainOrId) return null
    return sites.find(s => s.domain === domainOrId || s.id.toString() === domainOrId)
  }, [sites, params.domain, params.id, isGlobalPage])

  const handleSiteSelect = (site: Site) => {
    const domain = site.domain || site.id.toString()
    setLastSiteDomain(domain)

    // 如果当前在全局页面，跳转到选定站点的首页
    if (isGlobalPage) {
      router.push(`/${domain}`)
      return
    }

    // 使用域名路由，保持当前路径结构
    if (currentDomain) {
      const pathAfterDomain = pathname.replace(`/${currentDomain}`, '') || '/'
      router.push(`/${domain}${pathAfterDomain}`)
    } else {
      router.push(`/${domain}`)
    }
  }

  // 计算全局页面的标题
  const globalTitle = useMemo(() => {
    if (pathname.startsWith('/settings')) return "全平台设置"
    if (pathname.startsWith('/users')) return "用户管理"
    if (pathname.startsWith('/sites')) return "站点管理"
    return "全局管理"
  }, [pathname])
  // Broadway: Personal Account removed from title list.

  // 加载中或没有站点数据时显示占位符
  if (isLoadingSites || sites.length === 0) {
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
            aria-label="选择站点"
            className="flex items-center gap-2 px-3 py-2 h-auto hover:bg-slate-100 transition-colors rounded-xl border border-transparent hover:border-slate-200"
          >
            <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center shrink-0" suppressHydrationWarning>
              <LayoutGrid className="h-4 w-4" />
            </div>
            <div className="flex flex-col items-start text-left">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">系统环境</span>
              <span className="text-sm font-bold text-slate-900 leading-none">{globalTitle}</span>
            </div>
            <ChevronDown className="ml-2 h-4 w-4 text-slate-400 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[240px]">
          <DropdownMenuLabel>切换到 Wiki 站点</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {sites.map((site) => (
            <DropdownMenuItem
              key={site.id}
              onSelect={() => handleSiteSelect(site)}
              className="flex items-center gap-3 py-2.5 cursor-pointer"
            >
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-500" suppressHydrationWarning>
                <Globe className="h-4 w-4" />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-semibold truncate">{site.name}</span>
                <span className="text-xs text-slate-500 truncate">/{site.domain || 'default'}</span>
              </div>
              {canManageSites && (
                <div
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`?modal=settings&context=site&siteId=${site.id}`)
                    setOpen(false)
                  }}
                  className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-primary transition-all flex-shrink-0"
                  title="编辑站点"
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

  // 如果没有选中的站点，使用第一个站点
  const activeSite = selectedSite || sites[0]

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          aria-label="选择站点"
          className="flex items-center gap-2 px-3 py-2 h-auto hover:bg-slate-100 transition-colors rounded-xl border border-transparent hover:border-slate-200"
        >
          <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0" suppressHydrationWarning>
            <Globe className="h-4 w-4" />
          </div>
          <div className="flex flex-col items-start text-left">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">当前站点</span>
            <span className="text-sm font-bold text-slate-900 leading-none">{activeSite.name}</span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 text-slate-400 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        <DropdownMenuLabel>所有 Wiki 站点</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sites.map((site) => (
          <DropdownMenuItem
            key={site.id}
            onSelect={() => handleSiteSelect(site)}
            className="flex items-center gap-3 py-2.5 cursor-pointer"
          >
            <div className={cn(
              "p-1.5 rounded-lg transition-colors",
              activeSite.id === site.id ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
            )} suppressHydrationWarning>
              <Globe className="h-4 w-4" />
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-semibold truncate">{site.name}</span>
              <span className="text-xs text-slate-500 truncate">/{site.domain || 'default'}</span>
            </div>
            {canManageSites && (
              <div
                onClick={(e) => {
                  e.stopPropagation()
                  router.push(`?modal=settings&context=site&siteId=${site.id}`)
                  setOpen(false)
                }}
                className={cn(
                  "p-1.5 rounded-lg transition-all flex-shrink-0",
                  "hover:bg-slate-200 text-slate-400 hover:text-primary"
                )}
                title="编辑站点"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </div>
            )}
          </DropdownMenuItem>
        ))}
        {/* Admin Links Removed */}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const SiteSwitcher = SiteSwitcherComponent