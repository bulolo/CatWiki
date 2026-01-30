/**
 * 认证工具函数
 * 
 * 安全说明：
 * ⚠️ 当前实现使用 localStorage 存储 token，存在 XSS 风险
 * 
 * 推荐的生产环境安全方案：
 * 1. 后端通过 HttpOnly Cookie 返回 token
 * 2. 前端不直接访问 token，通过 credentials: 'include' 自动发送
 * 3. 实施 CSRF 保护（如 Double Submit Cookie 或 Synchronizer Token）
 * 4. 启用 CSP（Content Security Policy）
 * 
 * 当前临时方案的安全措施：
 * - Token 存储在 localStorage（便于跨标签页共享）
 * - 添加 token 过期时间管理
 * - 使用 Secure Cookie 标志（生产环境）
 * - 添加 SameSite 保护
 */

import type { UserInfo } from '@/types/auth'

// ==================== 类型定义 ====================

interface TokenData {
  token: string
  expiresAt: number // 过期时间戳
}

// ==================== 常量配置 ====================

const TOKEN_KEY = 'auth_token_data'
const AUTH_COOKIE_NAME = 'isAuthenticated'
const USER_INFO_KEY = 'userInfo'
const LAST_SITE_DOMAIN_KEY = 'lastSiteDomain'

// Token 默认有效期：7 天
const TOKEN_EXPIRES_DAYS = 7
const TOKEN_EXPIRES_MS = TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000

// Cookie 配置
const COOKIE_EXPIRES_DAYS = 7

// ==================== Token 管理 ====================

/**
 * 获取 token
 * @returns token 字符串，如果不存在或已过期则返回 null
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null

  try {
    const dataStr = localStorage.getItem(TOKEN_KEY)
    if (!dataStr) return null

    const data: TokenData = JSON.parse(dataStr)

    // 检查是否过期
    if (Date.now() > data.expiresAt) {
      clearToken()
      return null
    }

    return data.token
  } catch (error) {
    console.error('Failed to get token:', error)
    clearToken()
    return null
  }
}

/**
 * 设置 token
 * @param token - JWT token
 * @param expiresInMs - 过期时间（毫秒），默认 7 天
 */
export function setToken(token: string, expiresInMs: number = TOKEN_EXPIRES_MS) {
  if (typeof window === 'undefined') return

  try {
    const data: TokenData = {
      token,
      expiresAt: Date.now() + expiresInMs,
    }
    localStorage.setItem(TOKEN_KEY, JSON.stringify(data))

    // 同步设置认证状态 Cookie
    setAuthCookie(true)
  } catch (error) {
    console.error('Failed to set token:', error)
  }
}

/**
 * 清除 token
 */
export function clearToken() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
}

/**
 * 检查 token 是否即将过期（1小时内）
 */
export function isTokenExpiringSoon(): boolean {
  if (typeof window === 'undefined') return false

  try {
    const dataStr = localStorage.getItem(TOKEN_KEY)
    if (!dataStr) return true

    const data: TokenData = JSON.parse(dataStr)
    const oneHourFromNow = Date.now() + 60 * 60 * 1000

    return data.expiresAt < oneHourFromNow
  } catch {
    return true
  }
}

/**
 * 刷新 token 过期时间
 */
export function refreshTokenExpiry() {
  const token = getToken()
  if (token) {
    setToken(token, TOKEN_EXPIRES_MS)
  }
}

// ==================== Cookie 管理 ====================

/**
 * 设置认证状态 Cookie
 * 注意：此 Cookie 仅用于 middleware 检查，不存储敏感信息
 */
export function setAuthCookie(isAuthenticated: boolean) {
  if (typeof document === 'undefined') return

  const expires = new Date()
  expires.setDate(expires.getDate() + COOKIE_EXPIRES_DAYS)

  // 安全配置
  const isSecure = window.location.protocol === 'https:'
  const secure = isSecure ? 'Secure;' : ''
  const sameSite = 'Lax' // 使用 Lax 以获得更好的兼容性，Strict 可能过于严格

  document.cookie = `${AUTH_COOKIE_NAME}=${isAuthenticated}; path=/; expires=${expires.toUTCString()}; ${secure} SameSite=${sameSite}`
}

/**
 * 获取认证状态 Cookie
 */
export function getAuthCookie(): boolean {
  if (typeof document === 'undefined') return false

  const cookies = document.cookie.split(';')
  const authCookie = cookies.find(cookie =>
    cookie.trim().startsWith(`${AUTH_COOKIE_NAME}=`)
  )

  return authCookie?.split('=')[1] === 'true'
}

/**
 * 清除认证状态 Cookie
 */
export function clearAuthCookie() {
  if (typeof document === 'undefined') return

  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`
}

// ==================== 用户信息管理 ====================

/**
 * 获取用户信息
 */
export function getUserInfo(): UserInfo | null {
  if (typeof window === 'undefined') return null

  const userInfo = localStorage.getItem(USER_INFO_KEY)
  if (!userInfo) return null

  try {
    return JSON.parse(userInfo) as UserInfo
  } catch (error) {
    console.error('Failed to parse user info:', error)
    return null
  }
}

/**
 * 设置用户信息
 */
export function setUserInfo(user: UserInfo) {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(USER_INFO_KEY, JSON.stringify(user))
  } catch (error) {
    console.error('Failed to set user info:', error)
  }
}

/**
 * 清除用户信息
 */
export function clearUserInfo() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(USER_INFO_KEY)
}

// ==================== 站点域名管理 ====================

/**
 * 获取最近访问的站点域名
 */
export function getLastSiteDomain(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(LAST_SITE_DOMAIN_KEY)
}

/**
 * 设置最近访问的站点域名
 */
export function setLastSiteDomain(domain: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LAST_SITE_DOMAIN_KEY, domain)
}

// ==================== 认证状态管理 ====================

/**
 * 检查是否已认证
 * 同时检查 Cookie 和 Token 有效性
 */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false

  // 检查 Cookie（快速检查）
  const hasCookie = getAuthCookie()
  if (!hasCookie) return false

  // 检查 Token 是否有效
  const token = getToken()
  if (!token) {
    // Token 无效，清除 Cookie
    clearAuthCookie()
    return false
  }

  return true
}

/**
 * 清除所有认证相关数据
 */
export function clearAllAuth() {
  clearAuthCookie()
  clearToken()
  clearUserInfo()
}

/**
 * 登出
 */
export function logout() {
  clearAllAuth()

  // 重定向到登录页
  if (typeof window !== 'undefined') {
    // 清除所有查询参数，防止敏感信息泄露
    window.location.href = '/login'
  }
}

/**
 * 登录
 * @param token - JWT token
 * @param userInfo - 用户信息
 * @param remember - 是否记住登录状态（影响过期时间）
 */
export function login(token: string, userInfo: UserInfo, remember: boolean = true) {
  const expiresInMs = remember ? TOKEN_EXPIRES_MS : 24 * 60 * 60 * 1000 // 不记住则 1 天

  setToken(token, expiresInMs)
  setUserInfo(userInfo)
  setAuthCookie(true)
}

// ==================== 安全工具函数 ====================

/**
 * 生成用于 CSRF 保护的 token
 * 注意：这需要后端支持验证
 */
export function generateCSRFToken(): string {
  if (typeof window === 'undefined') return ''

  // 简单的随机 token 生成
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * 获取或创建 CSRF token
 */
export function getOrCreateCSRFToken(): string {
  if (typeof window === 'undefined') return ''

  const existingToken = sessionStorage.getItem('csrf_token')
  if (existingToken) return existingToken

  const newToken = generateCSRFToken()
  sessionStorage.setItem('csrf_token', newToken)
  return newToken
}

/**
 * 清除 CSRF token
 */
export function clearCSRFToken() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem('csrf_token')
}
