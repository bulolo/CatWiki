"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutGrid,
  FileText,
  Settings,
  Cpu,
  Users,
  ChevronRight,
  Globe,
  Github,
  BookOpen
} from "lucide-react"
import { useSiteData } from "@/hooks"
import { getUserInfo } from "@/lib/auth"
import { useEffect, useState, useMemo } from "react"
import { getRoutePath, useRouteContext } from "@/lib/routing"
import packageInfo from "../../../package.json"
const { version } = packageInfo

interface MenuItem {
  title: string
  href: string
  icon: any
  children?: { title: string; href: string }[]
  roles?: string[] // 允许访问的角色列表
}

const allMenuItems: MenuItem[] = [
  {
    title: "运营概览",
    href: "/",
    icon: LayoutGrid,
    roles: ["admin", "site_admin"] // 管理员和站点管理员可见
  },
  {
    title: "文档管理",
    href: "/documents",
    icon: FileText,
    children: [
      { title: "文档列表", href: "/documents" },
      { title: "发布文档", href: "/documents/new" },
    ],
    roles: ["admin", "site_admin", "editor"] // 所有角色都可见
  },
]

function AdminSidebarComponent() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isSitesPage = pathname.startsWith('/sites/edit') || pathname.startsWith('/sites/new')

  // 总是调用 hooks（React 规则要求）
  const routeContext = useRouteContext()
  const siteData = useSiteData() // 总是调用，但在 sites 页面时 domain 为空，会返回默认值

  // 一次性获取用户角色（不需要 useState + useEffect）
  const [userRole] = useState(() => {
    const user = getUserInfo()
    return user?.role || 'editor'
  })

  // 使用 useMemo 优化菜单过滤（只在角色变化时重新计算）
  const menuItems = useMemo(() => {
    return allMenuItems.filter(item => {
      if (!item.roles) return true // 没有角色限制的菜单项对所有人可见
      return item.roles.includes(userRole)
    })
  }, [userRole])

  // 如果是全平台系统管理页面 (用户管理、系统设置)
  const isGlobalManagement = pathname.startsWith('/users') || pathname.startsWith('/settings')
  if (isGlobalManagement && userRole === 'admin') {
    return (
      <div className="w-64 bg-muted/50 border-r border-border h-screen flex flex-col sticky top-0">
        <div className="p-6">
          <div className="flex items-center gap-3 px-2 mb-10">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 transition-transform hover:scale-105 duration-300" suppressHydrationWarning>
              <Settings className="text-primary-foreground h-5 w-5" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70 truncate">
              系统管理
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
          </nav>
        </div>

        <div className="mt-auto px-6 py-6 space-y-4">
          <div className="px-2 pt-2 border-t border-border/40">
            <Link
              href="/"
              className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-primary transition-colors"
            >
              <ChevronRight className="h-3 w-3 rotate-180" />
              返回控制台
            </Link>
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

        <div className="mt-auto px-6 py-6 space-y-4">
          <div className="space-y-1">
            <Link
              href="https://github.com/bulolo/catwiki"
              target="_blank"
              className="flex items-center gap-3 px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-primary transition-all group"
            >
              <Github className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
              <span className="font-medium">GitHub</span>
            </Link>
            <Link
              href="http://docs.catwiki.cn"
              target="_blank"
              className="flex items-center gap-3 px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-primary transition-all group"
            >
              <BookOpen className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
              <span className="font-medium">Documentation</span>
            </Link>
          </div>
          <div className="px-2 pt-2 border-t border-border/40 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400/50 font-bold uppercase tracking-wider">
              <span>CatWiki © 2026</span>
              <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] border border-slate-200/50">V{version}</span>
            </div>
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
          {routeContext.domain ? (
            menuItems.map((item) => {
              // 检查活动状态（所有路由都在域名下）
              // 对于根路径 "/"，需要同时匹配 /${domain} 和 /${domain}/
              const basePath = `/${routeContext.domain}${item.href}`
              const normalizedBasePath = basePath.replace(/\/$/, '') // 移除末尾斜杠
              const normalizedPathname = pathname.replace(/\/$/, '') // 移除末尾斜杠

              const isActive = normalizedPathname === normalizedBasePath ||
                (item.children && pathname.startsWith(basePath))
              const Icon = item.icon

              // 构建链接
              const hrefWithSite = getRoutePath(item.href, routeContext.domain)

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
                        const isChildActive = pathname === `/${routeContext.domain}${child.href}`
                        const childHrefWithSite = getRoutePath(child.href, routeContext.domain)
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

      <div className="mt-auto px-6 py-6 space-y-4">
        <div className="space-y-1">
          <Link
            href="https://github.com/bulolo/catwiki"
            target="_blank"
            className="flex items-center gap-3 px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-primary transition-all group"
          >
            <Github className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
            <span className="font-medium">GitHub</span>
          </Link>
          <Link
            href="http://docs.catwiki.cn"
            target="_blank"
            className="flex items-center gap-3 px-2 py-1.5 rounded-lg text-xs text-slate-400 hover:text-primary transition-all group"
          >
            <BookOpen className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
            <span className="font-medium">Documentation</span>
          </Link>
        </div>
        <div className="px-2 pt-2 border-t border-border/40 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-slate-400/50 font-bold uppercase tracking-wider">
            <span>CatWiki © 2026</span>
            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] border border-slate-200/50">V{version}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export const AdminSidebar = AdminSidebarComponent
