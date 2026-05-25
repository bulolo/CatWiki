// Copyright 2026 CatWiki Authors
//
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://github.com/CatWiki/CatWiki/blob/main/LICENSE

/**
 * 统一日志工具。
 *
 * - logger.debug / info / success：仅 dev 输出
 * - logger.warn / error：始终输出
 *
 * Why: dev 下 `console.error` 会触发 Next.js 全屏错误遮罩、干扰调试。
 * 所以 logger.error 在 dev 走 console.warn 仅打印日志，prod 才走 console.error
 * 以便后续接入 Sentry 等监控。
 */

import { isDevelopment } from "./env"

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDevelopment) console.log("[DEBUG]", ...args)
  },

  info: (...args: unknown[]) => {
    if (isDevelopment) console.info("[INFO]", ...args)
  },

  warn: (...args: unknown[]) => {
    console.warn("[WARN]", ...args)
  },

  error: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn("[ERROR]", ...args)
    } else {
      console.error("[ERROR]", ...args)
    }
  },

  success: (...args: unknown[]) => {
    if (isDevelopment) console.log("[SUCCESS]", ...args)
  },
}
