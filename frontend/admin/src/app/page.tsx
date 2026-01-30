"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getLastSiteDomain, setLastSiteDomain } from "@/lib/auth"
import { useSite } from "@/contexts/SiteContext"

export default function AdminHome() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  // 从 SiteContext 获取站点列表，避免重复请求
  const { sites, isLoadingSites } = useSite()

  // 动态获取第一个站点并重定向
  useEffect(() => {
    // 等待站点列表加载完成
    if (isLoadingSites) {
      return
    }

    const redirectToDefaultSite = () => {
      try {
        // 尝试获取最近访问的站点
        const lastDomain = getLastSiteDomain()
        if (lastDomain) {
          router.replace(`/${lastDomain}`)
          return
        }

        // 获取第一个激活的站点
        const activeSite = sites.find(site => site.status === "active")
        if (activeSite) {
          const domain = activeSite.domain || activeSite.id.toString()
          setLastSiteDomain(domain)
          router.replace(`/${domain}`)
          return
        }

        // 如果没有激活的站点，尝试获取任意站点
        if (sites.length > 0) {
          const firstSite = sites[0]
          const domain = firstSite.domain || firstSite.id.toString()
          setLastSiteDomain(domain)
          router.replace(`/${domain}`)
          return
        }

        // 如果没有任何站点，重定向到站点管理页面
        router.replace('/settings?tab=sites')
      } finally {
        setLoading(false)
      }
    }

    redirectToDefaultSite()
  }, [router, sites, isLoadingSites])

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-slate-400">{loading ? "正在加载..." : "正在跳转..."}</div>
    </div>
  )
}
