/**
 * 路由工具函数
 * 使用域名路由：/[domain]/documents
 */

import { useParams, usePathname } from "next/navigation"

/**
 * 根据域名生成链接
 * @param path 路径（如 "/documents", "/documents/new"）
 * @param domain 域名（必需）
 * @returns 完整的链接路径
 */
export function getRoutePath(
  path: string,
  domain: string
): string {
  // 移除路径开头的斜杠（如果有）
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  return `/${domain}${cleanPath ? `/${cleanPath}` : ''}`
}

/**
 * Hook: 获取当前路由的domain
 * 注意：必须在组件内使用
 * 在非域名路由下返回空字符串
 */
export function useRouteContext() {
  const params = useParams()
  const pathname = usePathname()
  const domain = params.domain as string | undefined
  
  return {
    domain: domain || '',
    pathname,
  }
}

