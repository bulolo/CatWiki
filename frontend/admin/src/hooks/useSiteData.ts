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
  slug: "",
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
