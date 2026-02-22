"use client"

import { NotFoundState } from "@/components/ui/not-found"
import { useParams } from "next/navigation"

export default function NotFound() {
  const params = useParams()
  const tenantSlug = params.tenantSlug as string
  const siteSlug = params.siteSlug as string

  return (
    <div className="h-screen flex items-center justify-center bg-white">
      <NotFoundState
        title="站点不存在"
        description={`抱歉，在租户 "${tenantSlug}" 下未找到标识为 "${siteSlug}" 的站点。此站点可能已被移除，或者您输入的链接有误。`}
        showHome={false}
        showBack={true}
      />
    </div>
  )
}
