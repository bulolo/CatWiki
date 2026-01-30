/**
 * React Query 配置
 */

import { QueryClient, DefaultOptions } from '@tanstack/react-query'

// 默认配置
const queryConfig: DefaultOptions = {
  queries: {
    // 数据保持新鲜的时间（5分钟）
    staleTime: 5 * 60 * 1000,
    // 缓存时间（10分钟）
    gcTime: 10 * 60 * 1000,
    // 失败后重试次数
    retry: 1,
    // 窗口聚焦时重新获取
    refetchOnWindowFocus: true,
    // 网络重新连接时重新获取
    refetchOnReconnect: true,
    // 挂载时不自动重新获取（除非过期）
    refetchOnMount: false,
  },
  mutations: {
    // mutation 失败后重试次数
    retry: 0,
  },
}

// 创建 QueryClient 工厂函数
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: queryConfig,
  })
}

// 全局 QueryClient 实例（仅在客户端使用）
let browserQueryClient: QueryClient | undefined = undefined

export function getQueryClient() {
  if (typeof window === 'undefined') {
    // 服务器端：总是创建新实例
    return makeQueryClient()
  } else {
    // 浏览器端：复用同一个实例
    if (!browserQueryClient) {
      browserQueryClient = makeQueryClient()
    }
    return browserQueryClient
  }
}




