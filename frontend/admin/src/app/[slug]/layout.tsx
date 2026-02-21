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

import { ReactNode, useState, useEffect } from "react"
import { useSite } from "@/contexts/SiteContext"

/**
 * Site 布局组件
 * 在站点数据加载完成前显示加载状态
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
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

