"use client"

import { ReactNode, useState, useEffect } from "react"
import { useSite } from "@/contexts/SiteContext"

/**
 * Domain 布局组件
 * 在站点数据加载完成前显示加载状态
 */
export default function DomainLayout({ children }: { children: ReactNode }) {
  const { isLoadingSite, siteError, currentSite } = useSite()
  const [isMounted, setIsMounted] = useState(false)

  // 检测客户端挂载状态，避免 SSR/CSR 不匹配
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // 服务器端和首次渲染时显示加载状态（避免 hydration 错误）
  if (!isMounted || isLoadingSite) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">正在加载站点...</div>
      </div>
    )
  }

  // 加载错误
  if (siteError) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">{siteError.message || '加载失败'}</div>
      </div>
    )
  }

  // 站点不存在
  if (!currentSite) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">站点不存在</div>
      </div>
    )
  }

  return <>{children}</>
}

