/**
 * 获取菜单树的 Hook
 * 使用 React Query 进行数据缓存和优化
 */

"use client"

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { queryKeys } from '@/lib/react-query'
import type { MenuItem } from '@/types'
import type { CollectionTree } from '@/lib/sdk/models/CollectionTree'
import { logError } from '@/lib/error-handler'

/**
 * 将后端返回的树形结构转换为菜单结构
 */
function convertTreeToMenuItems(tree: CollectionTree[]): MenuItem[] {
  const items: MenuItem[] = []

  for (const node of tree) {
    if (node.type === "collection") {
      // 递归处理子节点（包括子目录和文档）
      const children = node.children ? convertTreeToMenuItems(node.children) : []

      items.push({
        id: node.id.toString(),
        title: node.title,
        type: "collection" as const,
        children: children.length > 0 ? children : undefined
      })
    } else if (node.type === "document") {
      // 文档节点
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
export function useMenuTree(siteId: number | null) {
  return useQuery({
    queryKey: queryKeys.collections.tree(siteId!, true),
    queryFn: async () => {
      try {
        // 一次性获取完整的目录树（包含文档节点）
        const tree = await api.collection.getTree(siteId!, true)


        // 转换为菜单项
        return convertTreeToMenuItems(tree)
      } catch (error) {
        logError('加载菜单数据', error)
        throw error
      }
    },
    enabled: !!siteId,
    // 菜单树变化不频繁，可以缓存较长时间
    staleTime: 5 * 60 * 1000, // 5 分钟
    gcTime: 15 * 60 * 1000, // 15 分钟
  })
}

