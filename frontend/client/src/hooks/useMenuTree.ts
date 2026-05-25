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
 * 获取菜单树的 Hook。直接复用 orval 生成的 useGetClientCollectionTree，
 * select 把后端 CollectionTree 转成前端业务用的 MenuItem。
 */

"use client"

import { useGetClientCollectionTree } from "@/lib/sdk/client-collections"
import type { CollectionTree } from "@/lib/sdk/sdk.schemas"
import type { MenuItem } from "@/types"

/**
 * 将后端返回的树形结构转换为菜单结构
 */
function convertTreeToMenuItems(tree: CollectionTree[]): MenuItem[] {
  const items: MenuItem[] = []

  for (const node of tree) {
    if (node.type === "collection") {
      const children = node.children ? convertTreeToMenuItems(node.children) : []
      items.push({
        id: node.id.toString(),
        title: node.title,
        type: "collection" as const,
        children: children.length > 0 ? children : undefined,
      })
    } else if (node.type === "document") {
      items.push({
        id: node.id.toString(),
        title: node.title,
        type: "article" as const,
        views: node.views ?? undefined,
        tags: node.tags || [],
      })
    }
  }

  return items
}

/**
 * 根据指定的 siteId 生成菜单树结构的 Hook
 */
export function useMenuTree(siteId: number | null, tenantId?: number | null) {
  return useGetClientCollectionTree(
    { site_id: siteId ?? 0, tenant_id: tenantId ?? undefined, include_documents: true },
    {
      query: {
        enabled: !!siteId,
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        select: (tree) => (tree ? convertTreeToMenuItems(tree) : []),
      },
    },
  )
}
