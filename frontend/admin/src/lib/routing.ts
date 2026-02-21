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

/**
 * 路由工具函数
 * 使用标识路由：/[slug]/documents
 */

import { useParams, usePathname } from "next/navigation"

/**
 * 根据标识生成链接
 * @param path 路径（如 "/documents", "/documents/new"）
 * @param slug 站点标识（必需）
 * @returns 完整的链接路径
 */
export function getRoutePath(
  path: string,
  slug: string
): string {
  // 移除路径开头的斜杠（如果有）
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  return `/${slug}${cleanPath ? `/${cleanPath}` : ''}`
}

/**
 * Hook: 获取当前路由的 slug
 * 注意：必须在组件内使用
 * 在非站点路由下返回空字符串
 */
export function useRouteContext() {
  const params = useParams()
  const pathname = usePathname()
  const slug = params.slug as string | undefined

  return {
    slug: slug || '',
    pathname,
  }
}

