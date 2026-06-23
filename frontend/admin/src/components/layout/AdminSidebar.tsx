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

import { logger } from "@/lib/logger"
import { usePathname, useSearchParams } from "next/navigation"
import { useSiteData } from "@/hooks"
import { useCurrentUser } from "@/lib/auth-store"
import { useState, useMemo, useEffect } from "react"
import { useRouteContext } from "@/lib/routing"
import { useHealth } from "@/hooks/useHealth"
import { allMenuItems } from "./sidebar/menu-items"
import { GlobalManagementSidebar } from "./sidebar/GlobalManagementSidebar"
import { SitesEditSidebar } from "./sidebar/SitesEditSidebar"
import { SiteNavSidebar } from "./sidebar/SiteNavSidebar"

function AdminSidebarComponent() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isSitesPage = pathname.startsWith("/sites/edit") || pathname.startsWith("/sites/new")

  // 总是调用 hooks（React 规则要求）
  const routeContext = useRouteContext()
  const siteData = useSiteData() // 总是调用，但在 sites 页面时 slug 为空，会返回默认值

  // 响应式获取用户角色：登录/切换用户后菜单会自动重算。
  const currentUser = useCurrentUser()
  const userRole = currentUser?.role || "site_admin"

  // 获取动态版本号
  const { data: healthData } = useHealth()
  const version = healthData?.version || "..."
  const edition = healthData?.edition

  // 使用 useMemo 优化菜单过滤（只在角色变化时重新计算）
  const menuItems = useMemo(() => {
    return allMenuItems.filter(item => {
      if (!item.roles) return true // 没有角色限制的菜单项对所有人可见
      return item.roles.includes(userRole)
    })
  }, [userRole])

  // 如果是全平台系统管理页面 (用户管理、系统设置)
  const isGlobalManagement = pathname.startsWith("/users") || pathname.startsWith("/settings")

  // 直接从站点数据获取 tenantSlug，站点 API 已经返回了 tenant_slug
  const tenantSlug = siteData.tenant_slug || "default"

  const [imgError, setImgError] = useState(false)

  // 切换站点时重置错误状态
  const currentSiteId = siteData.id
  useEffect(() => {
    setImgError(false)
  }, [currentSiteId])

  const isValidIcon = siteData.icon && siteData.icon.trim() !== "" && (
    siteData.icon.startsWith("/") ||
    siteData.icon.startsWith("http://") ||
    siteData.icon.startsWith("https://") ||
    siteData.icon.startsWith("data:")
  )

  const hasCustomIcon = !!(isValidIcon && !imgError)
  const logoSrc = hasCustomIcon ? siteData.icon! : "/logo.png"

  const handleIconError = () => {
    if (logoSrc !== "/logo.png") {
      logger.warn(`Failed to load site icon: ${logoSrc}, falling back to default.`)
      setImgError(true)
    }
  }

  if (isGlobalManagement && (userRole === "admin" || userRole === "tenant_admin")) {
    return (
      <GlobalManagementSidebar
        pathname={pathname}
        activeTab={searchParams.get("tab")}
        userRole={userRole}
        edition={edition}
        version={version}
      />
    )
  }

  // 如果是 sites 编辑/新建页面，显示简化的侧边栏
  if (isSitesPage) {
    return <SitesEditSidebar edition={edition} version={version} />
  }

  return (
    <SiteNavSidebar
      menuItems={menuItems}
      slug={routeContext.slug}
      pathname={pathname}
      logoSrc={logoSrc}
      hasCustomIcon={hasCustomIcon}
      siteName={siteData.name || ""}
      tenantSlug={tenantSlug}
      edition={edition}
      version={version}
      onIconError={handleIconError}
    />
  )
}

export const AdminSidebar = AdminSidebarComponent
