/**
 * 获取当前站点数据的自定义 Hook
 * 从 SiteContext 获取站点数据（使用 React Query）
 * 
 * 这是一个便捷的 hook，用于向后兼容
 */

"use client"

import { useSite } from "@/contexts/SiteContext"
import type { Site } from "@/lib/api-client"

const defaultSite: Site = {
  id: 0,
  name: "加载中",
  domain: "",
  description: "",
  article_count: 0,
  created_at: "",
  updated_at: ""
}

/**
 * 获取当前站点数据
 * 如果站点正在加载或不存在，返回默认值
 */
export function useSiteData(): Site {
  const { currentSite } = useSite()

  // 如果没有当前站点，返回默认值
  return currentSite || defaultSite
}
