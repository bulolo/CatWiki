"use client"

import dynamic from "next/dynamic"

const AnalyticsPage = dynamic(
  () => import("@/ee/components/AnalyticsPage")
    .then(mod => ({ default: mod.AnalyticsPage }))
    .catch(() => ({ default: () => null })),
  { ssr: false }
)

export default function AnalyticsRoute() {
  return <AnalyticsPage />
}
