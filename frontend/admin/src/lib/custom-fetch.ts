// Copyright 2026 CatWiki Authors
//
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://github.com/CatWiki/CatWiki/blob/main/LICENSE

/**
 * orval mutator — admin 端统一 fetch client。
 *
 * 负责：
 * 1. 注入 baseURL（env.NEXT_PUBLIC_API_URL）
 * 2. 注入 Authorization Bearer token
 * 3. 注入 X-App-State / X-Admin-Origin
 * 4. 注入 EE 租户选择 header
 * 5. 401 → 清登录态 + 跳 /login
 * 6. 解包 CatWiki ApiResponse: { code, msg, data } → 仅返回 data
 * 7. code !== 0 时抛 Error（消息优先用后端 msg）
 */

import { env } from "./env"
import { getToken, clearAllAuth } from "./auth"

const BASE_URL = env.NEXT_PUBLIC_API_URL

/**
 * 业务异常：携带 HTTP 状态码 + 后端 msg。
 * 上层 useQuery / useMutation 的 onError 拿到的就是这个类型。
 */
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = "ApiError"
  }
}

function handleUnauthorized(): void {
  clearAllAuth()
  if (typeof window === "undefined") return
  const currentPath = window.location.pathname
  if (currentPath !== "/login") {
    window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`
  }
}

function buildHeaders(init?: HeadersInit, token?: string): Headers {
  const headers = new Headers(init)

  // App 状态指纹（用于后端 / 监控识别 admin 端是否真渲染）
  let isInitialized = false
  if (typeof document !== "undefined") {
    try {
      const node = document.getElementById("cw-sys-mount")
      if (node) {
        const style = window.getComputedStyle(node)
        isInitialized =
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          parseFloat(style.opacity) > 0.1
      }
    } catch {
      /* ignore */
    }
  }
  headers.set("X-App-State", isInitialized ? "0x4f4b" : "0x4b4f")
  headers.set("X-Admin-Origin", typeof window !== "undefined" ? window.location.origin : "")

  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }

  // EE: 注入租户选择 header。
  // EE 构建里 @/ee/api 实现真正的 injectEEHeaders；CE 构建里它是个 noop stub
  // (frontend/admin/src/ee/_ce_stubs/api.ts),require 不会抛,injectEEHeaders 调用
  // 是空操作。try/catch 仅作为 EE 模块被进一步剥离时的额外保险。
  try {
    const { injectEEHeaders } = require("@/ee/api")
    const tmp: Record<string, string> = {}
    injectEEHeaders(tmp)
    for (const [k, v] of Object.entries(tmp)) headers.set(k, v)
  } catch {
    /* 极端兜底:EE 模块 / stub 都不存在时静默忽略 */
  }

  return headers
}

/**
 * orval mutator 主体。
 *
 * @param url    生成器传入的相对 URL（含 query string，如 ``/admin/v1/sites?page=1``）
 * @param init   生成器传入的 method / body / signal / headers
 * @returns      已经解包过的业务数据（直接是后端 ``data`` 字段）
 */
export async function customFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getToken() ?? ""
  const headers = buildHeaders(init?.headers, token)

  const res = await fetch(`${BASE_URL}${url}`, { ...init, headers })

  // 解析 body：204/205/304 没 body；其他按 JSON 解（失败回退 text）
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

  // HTTP 错误（4xx / 5xx）
  if (!res.ok) {
    if (res.status === 401) handleUnauthorized()
    const msg =
      (body && typeof body === "object" && "msg" in body && typeof body.msg === "string"
        ? body.msg
        : typeof body === "string"
          ? body
          : null) || res.statusText || "Request failed"
    throw new ApiError(res.status, msg)
  }

  // CatWiki ApiResponse 解包：{ code, msg, data }
  if (
    body &&
    typeof body === "object" &&
    "code" in body &&
    typeof (body as { code: unknown }).code === "number"
  ) {
    const envelope = body as { code: number; msg?: string; data?: unknown }
    if (envelope.code === 0) {
      return envelope.data as T
    }
    throw new ApiError(res.status, envelope.msg || "Operation failed")
  }

  // 非 ApiResponse 形态（如健康检查直接返字符串）：原样返回
  return body as T
}

export default customFetch
