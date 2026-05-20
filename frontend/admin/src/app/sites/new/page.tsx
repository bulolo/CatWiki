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

import { useState, useEffect } from "react"
import { useTranslations } from 'next-intl'
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  ChevronLeft,
  Save,
  Globe,
  Settings,
  Layout,
  Palette,
  ShieldCheck,
  Users,
  Loader2
} from "lucide-react"
import { toast } from "sonner"
import { useCreateSite } from "@/hooks"
import { useGetAdminCurrentTenant } from '@/lib/sdk/admin-tenants'
import { ImageUpload } from "@/components/ui/ImageUpload"

// 主题色配置
const THEME_COLOR_KEYS = ['blue', 'emerald', 'purple', 'orange', 'slate'] as const
const THEME_COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-blue-500',
  emerald: 'bg-emerald-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  slate: 'bg-slate-800',
}

export default function NewSitePage() {
  const router = useRouter()
  const t = useTranslations('SiteNew')
  const tf = useTranslations('SiteForm')
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [icon, setIcon] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [themeColor, setThemeColor] = useState<string>("blue")
  const [layoutMode, setLayoutMode] = useState<string>("sidebar")
  const [mounted, setMounted] = useState(false)

  // 站点管理员状态
  const [initAdmin, setInitAdmin] = useState(false)
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPassword, setAdminPassword] = useState("")

  // 获取当前租户标识
  const { data: tenantData } = useGetAdminCurrentTenant({
    query: { staleTime: 10 * 60 * 1000 },
  })
  const tenantSlug = tenantData?.slug || '...'

  // 确保水合一致性
  useEffect(() => {
    setMounted(true)
  }, [])

  // 使用 React Query 创建 hook
  const createSiteMutation = useCreateSite()

  const handleBack = () => {
    router.push("/settings?tab=sites")
  }

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error(tf("errorName"))
      return
    }
    if (!slug.trim()) {
      toast.error(tf("errorSlug"))
      return
    }

    if (initAdmin && !adminEmail.trim()) {
      toast.error(tf("errorAdminEmail"))
      return
    }

    createSiteMutation.mutate({
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || undefined,
      icon: icon || undefined,
      status: isActive ? "active" : "disabled",
      theme_color: themeColor,
      layout_mode: layoutMode,
      // 传递管理员信息
      admin_email: initAdmin ? adminEmail.trim() : undefined,
      admin_password: (initAdmin && adminPassword) ? adminPassword : undefined,
    }, {
      onSuccess: () => {
        toast.success(t("createSuccess"))
        router.push("/settings?tab=sites")
      }
    })
  }

  if (!mounted) {
    return null // 或者显示一个基础的骨架屏
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h1>
            <p className="text-muted-foreground text-sm">{t("description")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleBack} disabled={createSiteMutation.isPending}>
            {t("cancel")}
          </Button>
          <Button className="flex items-center gap-2" onClick={handleCreate} disabled={createSiteMutation.isPending}>
            {createSiteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {createSiteMutation.isPending ? t("creating") : t("create")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              {tf("basicConfig")}
            </CardTitle>
            <CardDescription>
              {tf("basicConfigDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex flex-col md:flex-row gap-8">
              {/* 站点图标上传 */}
              <div className="w-full md:w-48 space-y-2">
                <label className="text-sm font-semibold text-slate-700 block">{tf("siteIcon")}</label>
                <ImageUpload
                  value={icon}
                  onChange={setIcon}
                  text={tf("uploadIcon")}
                  aspect="aspect-square"
                  className="w-full"
                />
                <p className="text-[10px] text-slate-400 text-center">{tf("iconHint1")} <br />{tf("iconHint2")}</p>
              </div>

              {/* 站点基本信息字段 */}
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">{tf("siteName")}</label>
                    <input
                      className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
                      placeholder={tf("siteNamePlaceholder")}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">{tf("siteSlug")}</label>
                    <div className="flex items-center">
                      <span className="inline-flex items-center px-3 h-10 rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 text-slate-500 text-sm font-mono whitespace-nowrap overflow-hidden max-w-[200px]" title={`/${tenantSlug}/`}>
                        /{tenantSlug}/
                      </span>
                      <input
                        className="flex h-10 w-full rounded-r-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
                        placeholder="cat"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">{tf("siteDescription")}</label>
                  <textarea
                    className="flex min-h-[100px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
                    placeholder={tf("siteDescPlaceholder")}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                {tf("styleConfig")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">{tf("themeColor")}</label>
                <div className="flex gap-2">
                  {THEME_COLOR_KEYS.map((colorKey) => (
                    <div
                      key={colorKey}
                      className={`w-8 h-8 rounded-full ${THEME_COLOR_CLASSES[colorKey]} cursor-pointer ring-offset-2 transition-all ${themeColor === colorKey ? 'ring-2 ring-primary ring-offset-2' : 'hover:ring-2 ring-slate-300'
                        }`}
                      onClick={() => setThemeColor(colorKey)}
                      title={tf(`colors.${colorKey}`)}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">{tf("layoutMode")}</label>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className={`border rounded-lg p-3 text-center text-xs font-medium cursor-pointer transition-colors ${layoutMode === 'sidebar'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-slate-200 bg-slate-50 text-slate-900'
                      }`}
                    onClick={() => setLayoutMode('sidebar')}
                  >
                    {tf("sidebarLayout")}
                  </div>
                  <div
                    className="border border-slate-200 rounded-lg p-3 text-center text-xs font-medium text-slate-400 bg-slate-50 cursor-not-allowed opacity-50"
                    title={tf("topNavNotSupported")}
                  >
                    {tf("topNav")}
                  </div>
                </div>
                <p className="text-xs text-slate-500">{tf("layoutHint")}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {tf("accessControl")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium text-slate-900">{tf("enableSite")}</label>
                  <p className="text-xs text-slate-500">{tf("enableSiteHint")}</p>
                </div>
                <div
                  className={`w-10 h-5 ${isActive ? 'bg-primary' : 'bg-slate-200'} rounded-full relative cursor-pointer`}
                  onClick={() => setIsActive(!isActive)}
                >
                  <div className={`absolute ${isActive ? 'right-0.5' : 'left-0.5'} top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all`} />
                </div>
              </div>
              <div className="flex items-center justify-between opacity-50">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium text-slate-900">{tf("commentFeature")}</label>
                  <p className="text-xs text-slate-500">{tf("commentFeatureHint")}</p>
                </div>
                <div className="w-10 h-5 bg-slate-200 rounded-full relative cursor-not-allowed">
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              {tf("siteAdmin")}
            </CardTitle>
            <CardDescription>
              {tf("siteAdminDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-0.5">
                <label className="text-sm font-medium text-slate-900">{tf("initAdmin")}</label>
                <p className="text-xs text-slate-500">{tf("initAdminHint")}</p>
              </div>
              <div
                className={`w-10 h-5 ${initAdmin ? 'bg-primary' : 'bg-slate-200'} rounded-full relative cursor-pointer`}
                onClick={() => setInitAdmin(!initAdmin)}
              >
                <div className={`absolute ${initAdmin ? 'right-0.5' : 'left-0.5'} top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all`} />
              </div>
            </div>

            {initAdmin && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">{tf("adminEmail")} <span className="text-red-500">*</span></label>
                  <Input
                    placeholder="admin@catwiki.cn"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">{tf("adminPassword")}</label>
                  <Input
                    type="text"
                    placeholder={tf("passwordHint")}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                  />
                  <p className="text-[10px] text-slate-500">{tf("adminTip")}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

