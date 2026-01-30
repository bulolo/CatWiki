import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 定义公开路由
const publicRoutes = ['/login']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // 检查是否是公开路由
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  
  // 所有非公开路由都需要认证（域名路由和根路径）
  const isProtectedRoute = !isPublicRoute && pathname !== '/login'

  // 从 cookie 中获取认证状态
  const isAuthenticated = request.cookies.get('isAuthenticated')?.value === 'true'

  // 如果访问受保护的路由但未登录，重定向到登录页
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 如果已登录用户访问登录页，重定向到首页
  if (isAuthenticated && pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * 匹配所有路由除了:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

