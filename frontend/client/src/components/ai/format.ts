// Copyright 2026 CatWiki Authors
//
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.

/** AI 对话相关的小格式化工具——给 pill 末尾耗时、TimingFooter 等共用。 */

import type { MessageTimings } from "@/types"

export function formatDuration(ms?: number): string | null {
  if (ms == null || !Number.isFinite(ms)) return null
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

export function formatTokens(n?: number): string | null {
  if (n == null || !Number.isFinite(n)) return null
  return n.toLocaleString()
}

/** 后端 trace dict 的形态（snake_case，slim 后只剩这三字段）。 */
export interface RawTrace {
  ttfb?: number
  first_token?: number
  total?: number
}

/** 把后端 trace 翻译为前端 Message.timings；三字段全空时返回 undefined（避免
 *  truthy 空壳触发 hasStats 误判）。实时流和历史回看共用，行为保持一致。 */
export function toTimings(trace: RawTrace | null | undefined): MessageTimings | undefined {
  if (!trace) return undefined
  const ttfbMs = typeof trace.ttfb === "number" ? trace.ttfb : undefined
  const firstTokenMs = typeof trace.first_token === "number" ? trace.first_token : undefined
  const totalMs = typeof trace.total === "number" ? trace.total : undefined
  if (ttfbMs == null && firstTokenMs == null && totalMs == null) return undefined
  return { ttfbMs, firstTokenMs, totalMs }
}
