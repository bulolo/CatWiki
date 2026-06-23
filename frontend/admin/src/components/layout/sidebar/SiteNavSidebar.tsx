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
import Image from "next/image"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { ChevronRight, Github, BookOpen, ExternalLink, ShieldCheck } from "lucide-react"
import { env } from "@/lib/env"
import { getRoutePath } from "@/lib/routing"
import { SidebarVersionBadge } from "./SidebarVersionBadge"
import type { MenuItem } from "./menu-items"

interface SiteNavSidebarProps {
  menuItems: MenuItem[]
  slug?: string
  pathname: string
  logoSrc: string
  hasCustomIcon: boolean
  siteName: string
  tenantSlug: string
  edition?: string
  version: string
  onIconError: () => void
}

export function SiteNavSidebar({
  menuItems, slug, pathname, logoSrc, hasCustomIcon, siteName, tenantSlug, edition, version, onIconError,
}: SiteNavSidebarProps) {
  const t = useTranslations("Sidebar")
  return (
    <div className="w-64 bg-muted/50 border-r border-border h-screen flex flex-col sticky top-0">
      <div className="p-6">
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="relative w-9 h-9 rounded-xl overflow-hidden border border-border flex items-center justify-center shadow-sm">
            <Image
              key={logoSrc}
              src={logoSrc}
              alt={siteName || "CatWiki Logo"}
              fill
              className={hasCustomIcon ? "object-cover" : "object-contain p-1.5"}
              unoptimized={true} // 强制禁用优化，避免 /_next/image 400 错误
              onError={onIconError}
            />
          </div>
          <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70 truncate">
            {siteName || t("loading")}
          </span>
        </div>

        <nav className="space-y-1.5">
          {slug ? (
            menuItems.map((item) => {
              // 检查活动状态（所有路由都在站点标识下）
              // 对于根路径 "/"，需要同时匹配 /${slug} 和 /${slug}/
              const basePath = `/${slug}${item.href}`
              const normalizedBasePath = basePath.replace(/\/$/, "") // 移除末尾斜杠
              const normalizedPathname = pathname.replace(/\/$/, "") // 移除末尾斜杠

              const isActive = normalizedPathname === normalizedBasePath ||
                (item.children && pathname.startsWith(basePath))
              const Icon = item.icon

              // 构建链接
              const hrefWithSite = getRoutePath(item.href, slug)

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
                    <span className="text-sm font-semibold">{t(item.title as Parameters<typeof t>[0])}</span>
                    {item.children && (
                      <ChevronRight className={cn("ml-auto h-3 w-3 transition-transform duration-200", isActive && "rotate-90")} />
                    )}
                  </Link>

                  {item.children && isActive && (
                    <div className="ml-10 space-y-1 mt-1 animate-in slide-in-from-left-2 duration-300">
                      {item.children.map((child) => {
                        const isChildActive = pathname === `/${slug}${child.href}`
                        const childHrefWithSite = getRoutePath(child.href, slug)
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
                            {t(child.title as Parameters<typeof t>[0])}
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
              {t("selectSite")}
            </div>
          )}
        </nav>
      </div>

      <div className="mt-auto px-6 py-6 space-y-6">
        <div className="space-y-1">
          {slug && (
            <Link
              href={`${env.NEXT_PUBLIC_CLIENT_URL}/${tenantSlug}/${slug}`}
              target="_blank"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-primary hover:text-primary hover:bg-primary/10 transition-all group mb-2"
            >
              <ExternalLink className="h-4 w-4" />
              <span>{t("enterSite")}</span>
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
            <span className="font-medium">{t("docCenter")}</span>
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
            <SidebarVersionBadge edition={edition} version={version} />
          </div>
          <div className="text-[10px] text-muted-foreground/40 text-center font-medium">© 2026 CatWiki Team</div>
        </div>
      </div>
    </div>
  )
}
