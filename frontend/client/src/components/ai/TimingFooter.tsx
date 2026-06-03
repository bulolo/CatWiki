// Copyright 2026 CatWiki Authors
//
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.

"use client"

import { Timer } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import type { MessageTimings, MessageUsage } from "@/types"
import { formatDuration, formatTokens } from "./format"

interface TimingFooterProps {
  timings?: MessageTimings
  usage?: MessageUsage
  className?: string
  /** compact: 只显示 总耗时 + Tokens，避免窄屏 4 项换行；默认 false 展示全部 */
  compact?: boolean
}

export function TimingFooter({ timings, usage, className, compact = false }: TimingFooterProps) {
  const t = useTranslations("Timing")

  const ttfb = formatDuration(timings?.ttfbMs)
  const firstToken = formatDuration(timings?.firstTokenMs)
  const total = formatDuration(timings?.totalMs)
  const tokens = formatTokens(usage?.totalTokens)

  const parts: { label: string; value: string }[] = []
  if (!compact && ttfb) parts.push({ label: t("ttfb"), value: ttfb })
  if (!compact && firstToken) parts.push({ label: t("firstToken"), value: firstToken })
  if (total) parts.push({ label: t("total"), value: total })
  if (tokens) parts.push({ label: t("tokens"), value: tokens })

  if (parts.length === 0) return null

  return (
    <div
      className={cn(
        "mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400",
        className,
      )}
    >
      <Timer className="h-3 w-3 shrink-0" />
      {parts.map((p, i) => (
        <span key={p.label} className="inline-flex items-center gap-1">
          <span className="text-slate-400/80">{p.label}</span>
          <span className="font-medium text-slate-500 tabular-nums">{p.value}</span>
          {i < parts.length - 1 && <span className="text-slate-300">·</span>}
        </span>
      ))}
    </div>
  )
}
