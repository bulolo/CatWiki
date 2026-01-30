/**
 * React Query 配置
 * 用于数据缓存和请求管理
 */

import { QueryClient } from '@tanstack/react-query'

/**
 * 创建 Query Client 实例
 * 配置全局默认选项
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 5 分钟内不会重新获取数据
        staleTime: 5 * 60 * 1000,
        // 缓存时间 10 分钟
        gcTime: 10 * 60 * 1000,
        // 窗口重新获得焦点时重新获取
        refetchOnWindowFocus: false,
        // 网络重新连接时重新获取
        refetchOnReconnect: true,
        // 组件挂载时的行为：如果数据过期则重新获取
        refetchOnMount: true,
        // 重试配置
        retry: 1,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      },
      mutations: {
        // 失败后重试一次
        retry: 1,
      },
    },
  })
}

/**
 * 查询键工厂
 * 用于生成标准化的查询键
 */
export const queryKeys = {
  // 站点相关
  sites: {
    all: ['sites'] as const,
    list: (params?: { page?: number; size?: number }) => 
      ['sites', 'list', params] as const,
    detail: (id: number) => ['sites', 'detail', id] as const,
    byDomain: (domain: string) => ['sites', 'byDomain', domain] as const,
  },
  
  // 文档相关
  documents: {
    all: ['documents'] as const,
    list: (params?: { 
      page?: number; 
      size?: number; 
      siteId?: number;
      collectionId?: number;
      keyword?: string;
    }) => ['documents', 'list', params] as const,
    detail: (id: number) => ['documents', 'detail', id] as const,
  },
  
  // 目录相关
  collections: {
    all: ['collections'] as const,
    tree: (siteId: number, includeDocuments?: boolean) => 
      ['collections', 'tree', siteId, includeDocuments] as const,
  },
}

