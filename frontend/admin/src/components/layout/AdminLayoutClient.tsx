// Copyright 2024 CatWiki Authors
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

import { Suspense } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Toaster } from 'sonner'
import { ReactQueryProvider } from '@/providers/ReactQueryProvider'
import { SiteProvider } from '@/contexts/SiteContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { UserMenu } from '@/components/layout/UserMenu'
import Link from 'next/link'
import {
  Search,
  Settings,
  ShieldCheck,
  User
} from "lucide-react"
import { getUserInfo } from '@/lib/auth'
import { useState, useEffect } from 'react'
import { StatePersistence } from '@/components/layout/StatePersistence'

// 动态导入侧边栏和站点切换器，禁用 SSR 以避免 hydration 错误
const AdminSidebar = dynamic(() => import('@/components/layout/AdminSidebar').then(mod => ({ default: mod.AdminSidebar })), {
  ssr: false,
  loading: () => <div className="w-64 bg-slate-50 border-r border-slate-200" />
})

const SiteSwitcher = dynamic(() => import('@/components/layout/SiteSwitcher').then(mod => ({ default: mod.SiteSwitcher })), {
  ssr: false,
  loading: () => <div className="w-40 h-12 bg-slate-100 rounded-xl" />
})

const TenantSwitcher = dynamic(() => import('@/components/layout/TenantSwitcher').then(mod => ({ default: mod.TenantSwitcher })), {
  ssr: false,
  loading: () => <div className="w-40 h-12 bg-slate-100 rounded-xl" />
})

const SettingsModal = dynamic(() => import('@/components/settings/SettingsModal').then(mod => ({ default: mod.SettingsModal })), {
  ssr: false
})

const PlatformModal = dynamic(() => import('@/components/platform/PlatformModal').then(mod => ({ default: mod.PlatformModal })), {
  ssr: false
})

/**
 * 管理后台客户端布局组件
 * 负责：
 * 1. 提供全局 Provider（React Query, Site Context）
 * 2. 根据路由显示不同布局（登录页 vs 管理后台）
 * 3. 错误边界保护
 */
/**
 * 内部布局组件 - 包含主要 UI 逻辑
 * 必须在 ReactQueryProvider 内部使用
 */
function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isLoginPage = pathname === '/login'
  const isSettingsPage = pathname === '/settings'

  const [mounted, setMounted] = useState(false)

  /* eslint-disable-next-line react-hooks/exhaustive-deps */
  useEffect(() => {
    setMounted(true)
  }, [])

  const userInfo = mounted ? getUserInfo() : null
  const welcomeName = userInfo?.name || "管理员"

  // 登录页面布局
  if (isLoginPage) {
    return (
      <div className="min-h-screen">
        {children}
      </div>
    )
  }

  // 设置页面布局 (全屏)
  if (isSettingsPage) {
    return (
      <div className="min-h-screen bg-slate-50/50">
        <ErrorBoundary>
          <Suspense fallback={<div className="w-full h-full bg-slate-50 animate-pulse" />}>
            {children}
          </Suspense>
        </ErrorBoundary>
      </div>
    )
  }

  // 管理后台布局
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50/50">
      {/* Settings Modal Overlay */}
      {searchParams.get('modal') === 'settings' && <SettingsModal />}
      {searchParams.get('modal') === 'platform' && <PlatformModal />}

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
            <div className="flex items-center gap-3">
              <Suspense fallback={<div className="w-40 h-12 bg-slate-100 animate-pulse rounded-xl" />}>
                <TenantSwitcher />
              </Suspense>
              <Suspense fallback={<div className="w-32 h-10 bg-slate-100 animate-pulse rounded-xl" />}>
                <SiteSwitcher />
              </Suspense>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <h2 className="text-sm font-medium text-slate-500">欢迎回来, {welcomeName}</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">

            {/* 平台管理入口 - 仅 admin 可见 (常驻) */}
            {userInfo?.role === 'admin' && (
              <button
                onClick={() => {
                  router.push('?modal=platform')
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-xl border border-primary/20 hover:bg-primary/20 transition-all active:scale-95"
                title="平台租户管理"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="text-xs font-bold">平台</span>
              </button>
            )}

            {(userInfo?.role === 'admin' || userInfo?.role === 'tenant_admin' || userInfo?.role === 'site_admin') && (
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
      <StatePersistence />
    </div>
  )
}

/**
 * 管理后台客户端布局组件
 * 负责：
 * 1. 提供全局 Provider（React Query, Site Context）
 * 2. 根据路由显示不同布局（登录页 vs 管理后台）
 * 3. 错误边界保护
 */
export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <ReactQueryProvider>
        <SiteProvider>
          <Toaster position="top-center" richColors />
          <AdminLayoutContent>{children}</AdminLayoutContent>
        </SiteProvider>
      </ReactQueryProvider>
    </ErrorBoundary>
  )
}

