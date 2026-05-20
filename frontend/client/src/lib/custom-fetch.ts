// Copyright 2026 CatWiki Authors
//
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://github.com/CatWiki/CatWiki/blob/main/LICENSE

/**
 * orval mutator — client 端统一 fetch client。
 *
 * 负责：
 * 1. 注入 baseURL（env.NEXT_PUBLIC_API_URL）
 * 2. 注入 X-App-State / X-Client-Origin
 * 3. 注入 X-Site-Access-Token（EE 站点密码保护，从 sessionStorage 取）
 * 4. 解包 CatWiki ApiResponse: { code, msg, data } → 仅返回 data
 * 5. 业务错误 / HTTP 4xx-5xx → 抛 HttpError（带状态码 + msg）
 *
 * client 端不存在登录态，401 不做跳转，原样抛给上层。
 */

import { env } from './env'

const BASE_URL = env.NEXT_PUBLIC_API_URL

/**
 * 业务异常：携带 HTTP 状态码 + 后端 msg。
 * 上层 useQuery / useMutation 的 onError 拿到的就是这个类型。
 */
export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'HttpError'
  }
}

function buildHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init)

  // App 状态指纹
  let isInitialized = false
  if (typeof document !== 'undefined') {
    try {
      const node = document.getElementById('cw-sys-mount')
      if (node) {
        const style = window.getComputedStyle(node)
        isInitialized =
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          parseFloat(style.opacity) > 0.1
      }
    } catch {
      /* ignore */
    }
  }
  headers.set('X-App-State', isInitialized ? '0x4f4b' : '0x4b4f')
  headers.set('X-Client-Origin', typeof window !== 'undefined' ? window.location.origin : '')

  // EE 站点访问 token（URL 第二段是站点 slug）
  if (typeof window !== 'undefined') {
    const siteSlug = window.location.pathname.split('/')[2]
    if (siteSlug) {
      const token = sessionStorage.getItem(`site_access_token:${siteSlug}`)
      if (token) headers.set('X-Site-Access-Token', token)
    }
  }

  return headers
}

/**
 * orval mutator 主体。
 *
 * @param url    生成器传入的相对 URL（含 query string）
 * @param init   生成器传入的 method / body / signal / headers
 * @returns      已经解包过的业务数据（直接是后端 ``data`` 字段）
 */
export async function customFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = buildHeaders(init?.headers)
  const res = await fetch(`${BASE_URL}${url}`, { ...init, headers })

  let body: unknown = null
  if (![204, 205, 304].includes(res.status)) {
    const text = await res.text()
    if (text) {
      try {
        body = JSON.parse(text)
      } catch {
        body = text
      }
    }
  }

  if (!res.ok) {
    const msg =
      (body && typeof body === 'object' && 'msg' in body && typeof body.msg === 'string'
        ? body.msg
        : typeof body === 'string'
          ? body
          : null) || res.statusText || 'Request failed'
    throw new HttpError(res.status, msg)
  }

  if (
    body &&
    typeof body === 'object' &&
    'code' in body &&
    typeof (body as { code: unknown }).code === 'number'
  ) {
    const envelope = body as { code: number; msg?: string; data?: unknown }
    if (envelope.code === 0) {
      return envelope.data as T
    }
    throw new HttpError(res.status, envelope.msg || 'Operation failed')
  }

  return body as T
}

export default customFetch
