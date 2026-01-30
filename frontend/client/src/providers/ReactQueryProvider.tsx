"use client"

/**
 * React Query Provider
 * 提供数据缓存和请求管理能力
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'
import { makeQueryClient } from '@/lib/react-query'

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  // 确保每个请求都有自己的 QueryClient 实例
  // 避免在不同请求之间共享数据
  const [queryClient] = useState(() => makeQueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* 开发环境显示 React Query DevTools */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}

