// Copyright 2026 CatWiki Authors
// 
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     https://github.com/CatWiki/CatWiki/blob/main/LICENSE
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { getLastSiteSlug, setLastSiteSlug } from "@/lib/auth"
import { useSite } from "@/contexts/SiteContext"
import { Button, Card, CardContent } from "@/components/ui"
import { Globe, Plus, Loader2 } from "lucide-react"

export default function AdminHome() {
  const t = useTranslations("AdminHome")
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  // From SiteContext
  const { sites, isLoadingSites } = useSite()

  // Dynamic redirect logic
  useEffect(() => {
    // Wait for sites to load
    if (isLoadingSites) {
      return
    }

    const redirectToDefaultSite = () => {
      try {
        // 1. Try last visited site
        const lastSlug = getLastSiteSlug()
        if (lastSlug) {
          // Verify if it still exists in the user's sites
          const exists = sites.find(s => s.slug === lastSlug || s.id.toString() === lastSlug)
          if (exists) {
            router.replace(`/${lastSlug}`)
            return
          }
        }

        // 2. Try first active site
        const activeSite = sites.find(site => site.status === "active")
        if (activeSite) {
          const slug = activeSite.slug || activeSite.id.toString()
          setLastSiteSlug(slug)
          router.replace(`/${slug}`)
          return
        }

        // 3. Try any site
        if (sites.length > 0) {
          const firstSite = sites[0]
          const slug = firstSite.slug || firstSite.id.toString()
          setLastSiteSlug(slug)
          router.replace(`/${slug}`)
          return
        }

        // 4. No sites found - Stop loading and show empty state
        setLoading(false)
      } catch (e) {
        setLoading(false)
      }
    }

    redirectToDefaultSite()
  }, [router, sites, isLoadingSites])

  const handleCreateSite = () => {
    router.push("?modal=settings&tab=sites&action=create")
  }

  if (loading || isLoadingSites) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-slate-50/50">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-slate-500 font-medium">{t("loading")}</p>
      </div>
    )
  }

  // Empty State
  return (
    <div className="h-screen flex items-center justify-center bg-slate-50/50 p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-12 pb-12 px-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mb-6">
            <Globe className="h-8 w-8 text-primary" />
          </div>

          <h1 className="text-xl font-bold text-foreground mb-2">
            {t("welcome")}
          </h1>

          <p className="text-sm text-muted-foreground mb-8 leading-relaxed max-w-xs mx-auto">
            {t("noSites")}
          </p>

          <Button
            size="lg"
            className="w-full"
            onClick={handleCreateSite}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("createFirstSite")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
