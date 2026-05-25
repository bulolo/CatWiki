"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui"
import { logError } from "@/lib/error-handler"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("GlobalError")

  useEffect(() => {
    logError("GlobalError", error)
  }, [error])

  return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center max-w-sm px-6">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">{t("title")}</h2>
        <p className="text-sm text-slate-500 mb-6">
          {error.message || t("fallback")}
        </p>
        <Button onClick={reset}>{t("retry")}</Button>
      </div>
    </div>
  )
}
