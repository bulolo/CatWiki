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
import { Globe, Github, BookOpen, ShieldCheck } from "lucide-react"
import { SidebarVersionBadge } from "./SidebarVersionBadge"

interface SitesEditSidebarProps {
  edition?: string
  version: string
}

/** sites 编辑/新建页面的简化侧边栏。 */
export function SitesEditSidebar({ edition, version }: SitesEditSidebarProps) {
  const t = useTranslations("Sidebar")
  return (
    <div className="w-64 bg-muted/50 border-r border-border h-screen flex flex-col sticky top-0">
      <div className="p-6">
        <div className="flex items-center gap-3 px-2 mb-10">
          <div className="relative w-9 h-9">
            <Image
              src="/logo.png"
              alt="CatWiki Logo"
              fill
              className="object-contain"
              unoptimized
              priority
            />
          </div>
          <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70 truncate">
            {t("siteManagement")}
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
            <span className="text-sm font-semibold">{t("backToSiteManagement")}</span>
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
            <span className="font-medium">{t("docCenter")}</span>
          </Link>
        </div>

        <div className="space-y-4 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-muted-foreground/60">
              <ShieldCheck className="h-3.5 w-3.5 opacity-70" />
              <span>CATWIKI</span>
            </div>
            <SidebarVersionBadge edition={edition} version={version} />
          </div>
          <div className="text-[10px] text-muted-foreground/40 text-center font-medium">© 2026 CatWiki Team</div>
        </div>
      </div>
    </div>
  )
}
