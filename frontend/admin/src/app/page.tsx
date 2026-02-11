// Copyright 2024 CatWiki Authors
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
import { getLastSiteSlug, setLastSiteSlug, getUserInfo } from "@/lib/auth"
import { useSite } from "@/contexts/SiteContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Globe, Plus, Loader2 } from "lucide-react"

export default function AdminHome() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  // From SiteContext
  const { sites, isLoadingSites } = useSite()
  const userInfo = getUserInfo()

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
    router.push('?modal=settings&tab=sites&action=create')
  }

  if (loading || isLoadingSites) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-slate-50/50">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-slate-500 font-medium">正在加载站点...</p>
      </div>
    )
  }

  // Empty State
  return (
    <div className="h-screen flex items-center justify-center bg-slate-50/50 p-4">
      <Card className="max-w-md w-full shadow-xl shadow-slate-200/50 border-slate-200 bg-white/80 backdrop-blur-sm">
        <CardContent className="pt-12 pb-12 px-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 ring-4 ring-primary/5">
            <Globe className="h-8 w-8 text-primary" />
          </div>

          <h1 className="text-xl font-bold text-slate-900 mb-2">
            欢迎来到 CatWiki
          </h1>

          <p className="text-sm text-slate-500 mb-8 leading-relaxed max-w-xs mx-auto">
            当前租户下暂无任何站点。您可以创建一个新的知识库站点来开始使用。
          </p>

          <Button
            size="lg"
            className="w-full h-11 text-sm font-bold shadow-lg shadow-primary/20 rounded-xl"
            onClick={handleCreateSite}
          >
            <Plus className="h-4 w-4 mr-2" />
            创建第一个站点
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
