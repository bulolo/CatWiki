"use client"

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Toaster } from 'sonner'
import { ReactQueryProvider } from '@/providers/ReactQueryProvider'
import { SiteProvider } from '@/contexts/SiteContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { UserMenu } from '@/components/layout/UserMenu'
import Link from 'next/link'
import { Settings } from 'lucide-react'
import { getUserInfo } from '@/lib/auth'
import { useState, useEffect } from 'react'

// 动态导入侧边栏和站点切换器，禁用 SSR 以避免 hydration 错误
const AdminSidebar = dynamic(() => import('@/components/layout/AdminSidebar').then(mod => ({ default: mod.AdminSidebar })), {
  ssr: false,
  loading: () => <div className="w-64 bg-slate-50 border-r border-slate-200" />
})

const SiteSwitcher = dynamic(() => import('@/components/layout/SiteSwitcher').then(mod => ({ default: mod.SiteSwitcher })), {
  ssr: false,
  loading: () => <div className="w-40 h-12 bg-slate-100 rounded-xl" />
})

const SettingsModal = dynamic(() => import('@/components/settings/SettingsModal').then(mod => ({ default: mod.SettingsModal })), {
  ssr: false
})

/**
 * 管理后台客户端布局组件
 * 负责：
 * 1. 提供全局 Provider（React Query, Site Context）
 * 2. 根据路由显示不同布局（登录页 vs 管理后台）
 * 3. 错误边界保护
 */
export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isLoginPage = pathname === '/login'
  const isSettingsPage = pathname === '/settings'

  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const userInfo = mounted ? getUserInfo() : null
  const welcomeName = userInfo?.name || "管理员"

  return (
    <ErrorBoundary>
      <ReactQueryProvider>
        <SiteProvider>
          <Toaster position="top-center" richColors />

          {/* Settings Modal Overlay */}
          {searchParams.get('modal') === 'settings' && <SettingsModal />}

          {isLoginPage ? (
            // 登录页面布局
            <div className="min-h-screen">
              {children}
            </div>
          ) : isSettingsPage ? (
            // 设置页面布局 (全屏)
            <div className="min-h-screen bg-slate-50/50">
              <ErrorBoundary>
                <Suspense fallback={<div className="w-full h-full bg-slate-50 animate-pulse" />}>
                  {children}
                </Suspense>
              </ErrorBoundary>
            </div>
          ) : (
            // 管理后台布局
            <div className="flex h-screen overflow-hidden bg-slate-50/50">
              <ErrorBoundary
                fallback={
                  <div className="w-64 bg-slate-50 border-r border-slate-200 flex items-center justify-center h-full">
                    <p className="text-sm text-slate-500">侧边栏加载失败</p>
                  </div>
                }
              >
                <Suspense fallback={<div className="w-64 bg-slate-50 border-r border-slate-200 h-full" />}>
                  <AdminSidebar />
                </Suspense>
              </ErrorBoundary>

              <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto stable-gutter relative">
                {/* Top Header */}
                <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-10 px-8 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-6">
                    <Suspense fallback={<div className="w-32 h-10 bg-slate-100 animate-pulse rounded-xl" />}>
                      <SiteSwitcher />
                    </Suspense>
                    <div className="h-6 w-px bg-slate-200" />
                    <div>
                      <h2 className="text-sm font-medium text-slate-500">欢迎回来, {welcomeName}</h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {(userInfo?.role === 'admin' || userInfo?.role === 'site_admin') && (
                      <Link
                        href="?modal=settings"
                        scroll={false}
                        className="p-2 transition-all hover:bg-slate-100 rounded-xl text-slate-500 hover:text-primary active:scale-95 group relative"
                        title="系统设置"
                      >
                        <Settings className="h-5 w-5" />
                      </Link>
                    )}
                    <div className="w-px h-6 bg-slate-200 mx-1" />
                    <UserMenu />
                  </div>
                </header>

                <div className="p-8 flex-1">
                  <ErrorBoundary>
                    <Suspense fallback={<div className="w-full h-full bg-slate-50 animate-pulse" />}>
                      {children}
                    </Suspense>
                  </ErrorBoundary>
                </div>
              </main>
            </div>
          )}
        </SiteProvider>
      </ReactQueryProvider>
    </ErrorBoundary>
  )
}

