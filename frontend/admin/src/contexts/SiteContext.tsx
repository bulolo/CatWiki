"use client"

/**
 * 简化的 SiteContext
 * 
 * 职责：
 * 1. 提供当前路由的 domain 参数
 * 2. 提供全局站点列表（使用 React Query）
 * 3. 提供当前站点数据（使用 React Query）
 * 
 * 移除：
 * - 手动缓存逻辑（由 React Query 自动处理）
 * - 并发请求控制（由 React Query 自动处理）
 * - 复杂的 useRef 和 useCallback（简化为直接使用 hooks）
 */

import { createContext, useContext, ReactNode, useMemo } from "react"
import { useParams, usePathname } from "next/navigation"
import { useSitesList, useSiteByDomain } from "@/hooks/useSites"
import { getUserInfo } from "@/lib/auth"
import { type Site, UserRole } from "@/lib/api-client"

interface SiteContextType {
  // 当前路由的 domain
  domain: string | undefined
  // 当前站点数据（通过 domain 获取）
  currentSite: Site | undefined
  // 当前站点加载状态
  isLoadingSite: boolean
  // 当前站点错误信息
  siteError: Error | null
  // 所有站点列表
  sites: Site[]
  // 站点列表加载状态
  isLoadingSites: boolean
  // 站点列表错误信息
  sitesError: Error | null
  // 刷新当前站点
  refetchSite: () => void
  // 刷新站点列表
  refetchSites: () => void
}

const SiteContext = createContext<SiteContextType | undefined>(undefined)

export function SiteProvider({ children }: { children: ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const domain = params.domain as string | undefined

  // 判断是否在登录页（登录页不需要加载站点数据）
  const isLoginPage = pathname === '/login'

  // 使用 React Query 获取站点列表
  const {
    data: allSites = [],
    isLoading: isLoadingSites,
    error: sitesError,
    refetch: refetchSites,
  } = useSitesList({
    page: 1,
    size: 100,
  })

  // Filter sites based on user role
  const currentUser = typeof window !== 'undefined' ? getUserInfo() : null

  const sites = useMemo(() => {
    if (!currentUser) return []
    // System Admins see all sites
    if (currentUser.role === UserRole.ADMIN) {
      return allSites
    }
    // Others only see managed sites
    const managedIds = currentUser.managed_site_ids || []
    return allSites.filter((site: Site) => managedIds.includes(site.id))

  }, [allSites, currentUser])

  // 使用 React Query 获取当前站点数据
  // 只在非登录页且有 domain 时才查询
  const {
    data: currentSite,
    isLoading: isLoadingSite,
    error: siteError,
    refetch: refetchSite,
  } = useSiteByDomain(!isLoginPage ? domain : undefined)

  const value: SiteContextType = {
    domain,
    currentSite,
    isLoadingSite,
    siteError,
    sites,
    isLoadingSites,
    sitesError,
    refetchSite,
    refetchSites,
  }

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

/**
 * 使用 SiteContext
 * 
 * 使用示例：
 * ```tsx
 * const { currentSite, sites, isLoadingSite } = useSite()
 * ```
 */
export function useSite() {
  const context = useContext(SiteContext)
  if (context === undefined) {
    throw new Error("useSite must be used within a SiteProvider")
  }
  return context
}

/**
 * 获取当前站点数据（简化版，向后兼容）
 * 
 * 如果组件只需要当前站点数据，可以使用这个 hook
 */
export function useCurrentSite() {
  const { currentSite, isLoadingSite, siteError } = useSite()
  return {
    site: currentSite,
    loading: isLoadingSite,
    error: siteError?.message || null,
  }
}
