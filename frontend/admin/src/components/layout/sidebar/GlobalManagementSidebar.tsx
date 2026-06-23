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
import { Settings, Users, ChevronRight, Globe, FileText, ShieldCheck } from "lucide-react"
import { SidebarVersionBadge } from "./SidebarVersionBadge"

interface GlobalManagementSidebarProps {
  pathname: string
  activeTab: string | null
  userRole: string
  edition?: string
  version: string
}

export function GlobalManagementSidebar({ pathname, activeTab, userRole, edition, version }: GlobalManagementSidebarProps) {
  const t = useTranslations("Sidebar")
  const onSettings = pathname.startsWith("/settings")
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
            {edition === "community"
              ? t("systemSettings")
              : (userRole === "admin" ? t("systemManagement") : t("orgSettings"))}
          </span>
        </div>

        <nav className="space-y-1.5">
          <Link
            href="/settings?tab=models"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
              onSettings && (activeTab === "models" || !activeTab)
                ? "bg-card text-primary shadow-md shadow-black/5 border border-border"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              onSettings && (activeTab === "models" || !activeTab)
                ? "bg-primary text-primary-foreground"
                : "bg-muted group-hover:bg-card text-muted-foreground"
            )} suppressHydrationWarning>
              <Settings className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">{t("modelConfig")}</span>
          </Link>

          <Link
            href="/settings?tab=sites"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
              onSettings && activeTab === "sites"
                ? "bg-card text-primary shadow-md shadow-black/5 border border-border"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              onSettings && activeTab === "sites"
                ? "bg-primary text-primary-foreground"
                : "bg-muted group-hover:bg-card text-muted-foreground"
            )} suppressHydrationWarning>
              <Globe className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">{t("siteManagement")}</span>
          </Link>

          <Link
            href="/settings?tab=users"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
              onSettings && activeTab === "users"
                ? "bg-card text-primary shadow-md shadow-black/5 border border-border"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              onSettings && activeTab === "users"
                ? "bg-primary text-primary-foreground"
                : "bg-muted group-hover:bg-card text-muted-foreground"
            )} suppressHydrationWarning>
              <Users className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">{t("userPermissions")}</span>
          </Link>

          <Link
            href="/settings?tab=doc-processor"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group",
              onSettings && activeTab === "doc-processor"
                ? "bg-card text-primary shadow-md shadow-black/5 border border-border"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <div className={cn(
              "p-2 rounded-lg transition-colors",
              onSettings && activeTab === "doc-processor"
                ? "bg-primary text-primary-foreground"
                : "bg-muted group-hover:bg-card text-muted-foreground"
            )} suppressHydrationWarning>
              <FileText className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold">{t("docProcessor")}</span>
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
            <span>{t("backToConsole")}</span>
          </Link>
          <div className="flex items-center justify-between px-0.5">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-wider text-muted-foreground/60">
              <ShieldCheck className="h-3.5 w-3.5 opacity-70" />
              <span>CATWIKI</span>
            </div>
            <SidebarVersionBadge edition={edition} version={version} />
          </div>
        </div>
      </div>
    </div>
  )
}
