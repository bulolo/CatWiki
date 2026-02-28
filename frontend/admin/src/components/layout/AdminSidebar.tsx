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

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  type LucideIcon,
  LayoutGrid,
  FileText,
  Settings,
  Cpu,
  Users,
  ChevronRight,
  Globe,
  Github,
  BookOpen,
  ExternalLink,
  ShieldCheck
} from "lucide-react"
import { env } from "@/lib/env"
import { useSiteData } from "@/hooks"
import { getUserInfo } from "@/lib/auth"
import { useState, useMemo } from "react"
import { getRoutePath, useRouteContext } from "@/lib/routing"
import { useHealth } from "@/hooks/useHealth"

interface MenuItem {
  title: string
  href: string
  icon: LucideIcon
  children?: { title: string; href: string }[]
  roles?: string[] // 允许访问的角色列表
}

const allMenuItems: MenuItem[] = [
  {
    title: "运营概览",
    href: "/",
    icon: LayoutGrid,
    roles: ["admin", "tenant_admin", "site_admin"] // 管理员和站点管理员可见
  },
  {
    title: "文档管理",
    href: "/documents",
    icon: FileText,
    children: [
      { title: "文档列表", href: "/documents" },
      { title: "发布文档", href: "/documents/new" },
    ],
    roles: ["admin", "tenant_admin", "site_admin"] // 所有角色都可见
  },
]

function AdminSidebarComponent() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isSitesPage = pathname.startsWith('/sites/edit') || pathname.startsWith('/sites/new')

  // 总是调用 hooks（React 规则要求）
  const routeContext = useRouteContext()
  const siteData = useSiteData() // 总是调用，但在 sites 页面时 slug 为空，会返回默认值

  // 一次性获取用户角色（不需要 useState + useEffect）
  const [userRole] = useState(() => {
    const user = getUserInfo()
    return user?.role || 'site_admin'
  })

  // 获取动态版本号
  const { data: healthData } = useHealth()
  const version = healthData?.version || "..."

  // 使用 useMemo 优化菜单过滤（只在角色变化时重新计算）
  const menuItems = useMemo(() => {
    return allMenuItems.filter(item => {
      if (!item.roles) return true // 没有角色限制的菜单项对所有人可见
      return item.roles.includes(userRole)
    })
  }, [userRole])

  // 如果是全平台系统管理页面 (用户管理、系统设置)
  const isGlobalManagement = pathname.startsWith('/users') || pathname.startsWith('/settings')

  // 直接从站点数据获取 tenantSlug，站点 API 已经返回了 tenant_slug
  const tenantSlug = siteData.tenant_slug || 'default'

  if (isGlobalManagement && (userRole === 'admin' || userRole === 'tenant_admin')) {
    return (
      <div className="w-64 bg-muted/50 border-r border-border h-screen flex flex-col sticky top-0">
        <div className="p-6">
          <div className="flex items-center gap-3 px-2 mb-10">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 transition-transform hover:scale-105 duration-300" suppressHydrationWarning>
              <Settings className="text-primary-foreground h-5 w-5" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70 truncate">
              {healthData?.edition === 'community'
                ? '系统设置'
                : (userRole === 'admin' ? '系统管理' : '组织设置')}
            </span>
          </div>

          <nav className="space-y-1.5">



            <Link
              href="/settings?tab=models"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
                pathname.startsWith('/settings') && (searchParams.get('tab') === 'models' || !searchParams.get('tab'))
                  ? "bg-card text-primary shadow-md shadow-black/5 border border-border"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className={cn(
                "p-2 rounded-lg transition-colors",
                pathname.startsWith('/settings') && (searchParams.get('tab') === 'models' || !searchParams.get('tab'))
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted group-hover:bg-card text-muted-foreground"
              )} suppressHydrationWarning>
                <Settings className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold">模型配置</span>
            </Link>

            <Link
              href="/settings?tab=sites"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
                pathname.startsWith('/settings') && searchParams.get('tab') === 'sites'
                  ? "bg-card text-primary shadow-md shadow-black/5 border border-border"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className={cn(
                "p-2 rounded-lg transition-colors",
                pathname.startsWith('/settings') && searchParams.get('tab') === 'sites'
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted group-hover:bg-card text-muted-foreground"
              )} suppressHydrationWarning>
                <Globe className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold">站点管理</span>
            </Link>

            <Link
              href="/settings?tab=users"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
                pathname.startsWith('/settings') && searchParams.get('tab') === 'users'
                  ? "bg-card text-primary shadow-md shadow-black/5 border border-border"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className={cn(
                "p-2 rounded-lg transition-colors",
                pathname.startsWith('/settings') && searchParams.get('tab') === 'users'
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted group-hover:bg-card text-muted-foreground"
              )} suppressHydrationWarning>
                <Users className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold">用户权限</span>
            </Link>

            <Link
              href="/settings?tab=doc-processor"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
                pathname.startsWith('/settings') && searchParams.get('tab') === 'doc-processor'
                  ? "bg-card text-primary shadow-md shadow-black/5 border border-border"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className={cn(
                "p-2 rounded-lg transition-colors",
                pathname.startsWith('/settings') && searchParams.get('tab') === 'doc-processor'
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted group-hover:bg-card text-muted-foreground"
              )} suppressHydrationWarning>
                <FileText className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold">文档解析</span>
            </Link>
          </nav>
        </div>

        <div className="mt-auto px-6 py-6 space-y-4">
          <div className="px-2 pt-4 border-t border-border/40 space-y-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-primary transition-colors px-2 py-1.5 rounded-md hover:bg-muted/50"
            >
              <ChevronRight className="h-3 w-3 rotate-180" />
              <span>返回控制台</span>
            </Link>
            <div className="flex items-center justify-between px-0.5">
              <div className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-muted-foreground/60">
                <ShieldCheck className="h-3.5 w-3.5 opacity-70" />
                <span>CATWIKI</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border shadow-sm",
                  healthData?.edition === 'enterprise'
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    : "bg-muted text-muted-foreground border-border"
                )}>
                  {healthData?.edition === 'enterprise' ? 'EE' : 'CE'}
                </span>
                <span className="px-2 py-0.5 bg-primary/5 text-primary/80 rounded-full text-[10px] font-bold border border-primary/10 shadow-sm">
                  v{version}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 如果是 sites 编辑/新建页面，显示简化的侧边栏
  if (isSitesPage) {
    return (
      <div className="w-64 bg-muted/50 border-r border-border h-screen flex flex-col sticky top-0">
        <div className="p-6">
          <div className="flex items-center gap-3 px-2 mb-10">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 transition-transform hover:scale-105 duration-300" suppressHydrationWarning>
              <Globe className="text-primary-foreground h-5 w-5" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70 truncate">
              站点管理
            </span>
          </div>

          <nav className="space-y-1.5">
            <Link
              href="/settings?tab=sites"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
                "bg-card text-primary shadow-md shadow-black/5 border border-border"
              )}
            >
              <div className={cn(
                "p-2 rounded-lg transition-colors",
                "bg-primary text-primary-foreground"
              )} suppressHydrationWarning>
                <Globe className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold">返回站点管理</span>
            </Link>
          </nav>
        </div>

        <div className="mt-auto px-6 py-6 space-y-6">
          <div className="space-y-1">
            <Link
              href="https://github.com/bulolo/catwiki"
              target="_blank"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-primary hover:bg-muted/50 transition-all group"
            >
              <Github className="h-4 w-4 opacity-60 group-hover:opacity-100 transition-opacity" />
              <span className="font-medium">GitHub</span>
            </Link>
            <Link
              href="https://docs.catwiki.cn"
              target="_blank"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-primary hover:bg-muted/50 transition-all group"
            >
              <BookOpen className="h-4 w-4 opacity-60 group-hover:opacity-100 transition-opacity" />
              <span className="font-medium">文档中心</span>
            </Link>
          </div>

          <div className="space-y-4 pt-2 border-t border-border/40">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-muted-foreground/60">
                <ShieldCheck className="h-3.5 w-3.5 opacity-70" />
                <span>CATWIKI</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border shadow-sm",
                  healthData?.edition === 'enterprise'
                    ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    : "bg-muted text-muted-foreground border-border"
                )}>
                  {healthData?.edition === 'enterprise' ? 'EE' : 'CE'}
                </span>
                <span className="px-2 py-0.5 bg-primary/5 text-primary/80 rounded-full text-[10px] font-bold border border-primary/10 shadow-sm">
                  v{version}
                </span>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground/40 text-center font-medium">© 2026 CatWiki Team</div>
          </div>
        </div>
      </div>
    )
  }



  return (
    <div className="w-64 bg-muted/50 border-r border-border h-screen flex flex-col sticky top-0">
      <div className="p-6">
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 transition-transform hover:scale-105 duration-300" suppressHydrationWarning>
            <Globe className="text-primary-foreground h-5 w-5" />
          </div>
          <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70 truncate">
            {isSitesPage ? '站点管理' : (siteData.name || '加载中')}
          </span>
        </div>

        <nav className="space-y-1.5">
          {routeContext.slug ? (
            menuItems.map((item) => {
              // 检查活动状态（所有路由都在站点标识下）
              // 对于根路径 "/"，需要同时匹配 /${slug} 和 /${slug}/
              const basePath = `/${routeContext.slug}${item.href}`
              const normalizedBasePath = basePath.replace(/\/$/, '') // 移除末尾斜杠
              const normalizedPathname = pathname.replace(/\/$/, '') // 移除末尾斜杠

              const isActive = normalizedPathname === normalizedBasePath ||
                (item.children && pathname.startsWith(basePath))
              const Icon = item.icon

              // 构建链接
              const hrefWithSite = getRoutePath(item.href, routeContext.slug)

              return (
                <div key={item.href} className="space-y-1">
                  <Link
                    href={hrefWithSite}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
                      isActive
                        ? "bg-card text-primary shadow-md shadow-black/5 border border-border"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <div className={cn(
                      "p-2 rounded-lg transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted group-hover:bg-card text-muted-foreground"
                    )} suppressHydrationWarning>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-semibold">{item.title}</span>
                    {item.children && (
                      <ChevronRight className={cn("ml-auto h-3 w-3 transition-transform duration-200", isActive && "rotate-90")} />
                    )}
                  </Link>

                  {item.children && isActive && (
                    <div className="ml-10 space-y-1 mt-1 animate-in slide-in-from-left-2 duration-300">
                      {item.children.map((child) => {
                        const isChildActive = pathname === `/${routeContext.slug}${child.href}`
                        const childHrefWithSite = getRoutePath(child.href, routeContext.slug)
                        return (
                          <Link
                            key={child.href}
                            href={childHrefWithSite}
                            className={cn(
                              "block px-3 py-2 text-xs font-medium rounded-lg transition-all",
                              isChildActive
                                ? "text-primary bg-primary/10"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            )}
                          >
                            {child.title}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="px-3 py-8 text-sm text-muted-foreground text-center bg-muted/30 rounded-2xl border border-dashed border-border mx-2">
              请选择一个站点
            </div>
          )}
        </nav>
      </div>

      <div className="mt-auto px-6 py-6 space-y-6">
        <div className="space-y-1">
          {routeContext.slug && (
            <Link
              href={`${env.NEXT_PUBLIC_CLIENT_URL}/${tenantSlug}/${routeContext.slug}`}
              target="_blank"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 transition-all group mb-2"
            >
              <ExternalLink className="h-4 w-4" />
              <span>进入站点</span>
            </Link>
          )}

          <Link
            href="https://github.com/bulolo/catwiki"
            target="_blank"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-primary hover:bg-muted/50 transition-all group"
          >
            <Github className="h-4 w-4 opacity-60 group-hover:opacity-100 transition-opacity" />
            <span className="font-medium">GitHub</span>
          </Link>
          <Link
            href="https://docs.catwiki.cn"
            target="_blank"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-primary hover:bg-muted/50 transition-all group"
          >
            <BookOpen className="h-4 w-4 opacity-60 group-hover:opacity-100 transition-opacity" />
            <span className="font-medium">文档中心</span>
          </Link>
        </div>

        <div className="space-y-4 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between px-1">
            <Link
              href="https://catwiki.ai"
              target="_blank"
              className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-muted-foreground/60 hover:text-primary transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5 opacity-70" />
              <span>CATWIKI</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border shadow-sm",
                healthData?.edition === 'enterprise'
                  ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                  : "bg-muted text-muted-foreground border-border"
              )}>
                {healthData?.edition === 'enterprise' ? 'EE' : 'CE'}
              </span>
              <span className="px-2 py-0.5 bg-primary/5 text-primary/80 rounded-full text-[10px] font-bold border border-primary/10 shadow-sm">
                v{version}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground/40 text-center font-medium">© 2026 CatWiki Team</div>
        </div>
      </div>
    </div>
  )
}

export const AdminSidebar = AdminSidebarComponent
