// Copyright 2026 CatWiki Authors
//
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.

"use client"

import { useState } from "react"
import { ThumbsUp, ThumbsDown } from "lucide-react"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"

export type NegativeReason = "incorrect" | "irrelevant" | "incomplete" | "slow"

interface MessageActionsProps {
  className?: string
  /** rating=null 表示撤销；reason 仅在 rating="down" 时有意义 */
  onFeedback?: (rating: "up" | "down" | null, reason: NegativeReason | null) => void
}

const NEGATIVE_REASONS: NegativeReason[] = ["incorrect", "irrelevant", "incomplete", "slow"]

/**
 * 助手消息底部反馈条。点 👎 后同一行展开原因 chip 单选，便于快速收集"为什么不好"。
 * 实际持久化由父组件通过 onFeedback 接管（如 useAIChat 的 submitFeedback）。
 */
export function MessageActions({ className, onFeedback }: MessageActionsProps) {
  const t = useTranslations("Feedback")
  const [rating, setRating] = useState<"up" | "down" | null>(null)
  const [reason, setReason] = useState<NegativeReason | null>(null)

  const setRatingValue = (next: "up" | "down") => {
    const newRating = rating === next ? null : next
    setRating(newRating)
    // 切走 👎 时清空原因
    const newReason = newRating === "down" ? reason : null
    if (newReason !== reason) setReason(newReason)
    onFeedback?.(newRating, newReason)
  }

  const pickReason = (r: NegativeReason) => {
    const next = reason === r ? null : r
    setReason(next)
    onFeedback?.(rating, next)
  }

  return (
    <div className={cn("inline-flex items-center flex-wrap gap-x-1 gap-y-1", className)}>
      <div className="inline-flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => setRatingValue("up")}
          title={t("helpful")}
          aria-label={t("helpful")}
          aria-pressed={rating === "up"}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/60",
            rating === "up" && "text-emerald-600 bg-emerald-50/80",
          )}
        >
          <ThumbsUp className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() => setRatingValue("down")}
          title={t("notHelpful")}
          aria-label={t("notHelpful")}
          aria-pressed={rating === "down"}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            "text-slate-400 hover:text-rose-600 hover:bg-rose-50/60",
            rating === "down" && "text-rose-600 bg-rose-50/80",
          )}
        >
          <ThumbsDown className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      {rating === "down" && (
        <div
          className="inline-flex items-center flex-wrap gap-1 pl-1 animate-in fade-in slide-in-from-left-1 duration-200"
          role="radiogroup"
          aria-label={t("reasonGroup")}
        >
          {NEGATIVE_REASONS.map((r) => {
            const active = reason === r
            return (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => pickReason(r)}
                className={cn(
                  "px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors",
                  active
                    ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-white border-slate-200 text-slate-500 hover:border-rose-200 hover:text-rose-600",
                )}
              >
                {t(`reasons.${r}`)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
