"use client"

import { NotFoundState } from "@/components/ui"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"

export default function NotFound() {
  const params = useParams()
  const tenantSlug = params.tenantSlug as string
  const siteSlug = params.siteSlug as string
  const t = useTranslations("SiteNotFound")

  return (
    <div className="h-screen flex items-center justify-center bg-white">
      <NotFoundState
        title={t("title")}
        description={t("description", { tenantSlug, siteSlug })}
        showHome={false}
        showBack={true}
      />
    </div>
  )
}
