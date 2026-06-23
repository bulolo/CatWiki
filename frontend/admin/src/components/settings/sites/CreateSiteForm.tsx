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

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Textarea } from "@/components/ui"
import { ImageUpload } from "@/components/common"
import {
  ChevronLeft,
  Save,
  Settings,
  Palette,
  ShieldCheck,
  Users,
  Loader2
} from "lucide-react"
import { toast } from "sonner"
import { useCreateSite } from "@/hooks"
import { env } from "@/lib/env"

// 主题色配置
const THEME_COLORS_BASE = [
  { value: "blue", colorName: "blue", className: "bg-blue-500" },
  { value: "emerald", colorName: "emerald", className: "bg-emerald-500" },
  { value: "purple", colorName: "purple", className: "bg-purple-500" },
  { value: "orange", colorName: "orange", className: "bg-orange-500" },
  { value: "slate", colorName: "slate", className: "bg-slate-800" },
] as const

interface CreateSiteFormProps {
  onCancel: () => void
  onSuccess: () => void
}

export function CreateSiteForm({ onCancel, onSuccess }: CreateSiteFormProps) {
  const t = useTranslations("CreateSite")
  const tf = useTranslations("SiteForm")
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [icon, setIcon] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [themeColor, setThemeColor] = useState<string>("blue")
  const [layoutMode, setLayoutMode] = useState<string>("sidebar")

  // 站点管理员状态
  const [initAdmin, setInitAdmin] = useState(false)
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPassword, setAdminPassword] = useState("")

  // 使用 React Query 创建 hook
  const createSiteMutation = useCreateSite()

  const handleCreate = () => {
    if (!name.trim()) {
      toast.error(t("nameRequired"))
      return
    }
    if (!slug.trim()) {
      toast.error(t("slugRequired"))
      return
    }

    if (initAdmin && !adminEmail.trim()) {
      toast.error(t("emailRequired"))
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
        onSuccess()
      }
    })
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-10 py-4 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{t("title")}</h1>
            <p className="text-slate-500 text-xs hidden md:block">{t("description")}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={createSiteMutation.isPending}>
            {t("cancel")}
          </Button>
          <Button size="sm" className="flex items-center gap-2" onClick={handleCreate} disabled={createSiteMutation.isPending}>
            {createSiteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {createSiteMutation.isPending ? t("creating") : t("create")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 px-1">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              {t("basicInfo")}
            </CardTitle>
            <CardDescription className="text-xs">
              {t("basicDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col md:flex-row gap-8">
              {/* 站点图标上传 */}
              <div className="w-full md:w-32 space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">{t("siteIcon")}</label>
                <ImageUpload
                  value={icon}
                  onChange={setIcon}
                  text={t("upload")}
                  aspect="aspect-square"
                  className="w-full"
                />
              </div>

              {/* 站点基本信息字段 */}
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">{t("siteName")}</label>
                    <Input
                      className="h-9"
                      placeholder={t("namePlaceholder")}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">{t("siteSlug")}</label>
                    <div className="flex items-center">
                      <span
                        className="inline-flex items-center px-3 h-9 rounded-l-md border border-r-0 border-slate-200 bg-slate-50 text-slate-500 text-[10px] font-mono flex-1 min-w-0 overflow-hidden"
                        title={env.NEXT_PUBLIC_CLIENT_URL}
                      >
                        <span className="truncate">{env.NEXT_PUBLIC_CLIENT_URL}</span>/
                      </span>
                      <Input
                        className="h-9 w-[35%] min-w-[80px] rounded-l-none"
                        placeholder={t("slugPlaceholder")}
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500">{t("slugTip")}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">{t("siteDescription")}</label>
                  <Textarea
                    className="min-h-[80px] text-sm resize-none"
                    placeholder={t("descPlaceholder")}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                {t("style")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">{t("themeColor")}</label>
                <div className="flex gap-2">
                  {THEME_COLORS_BASE.map((color) => (
                    <div
                      key={color.value}
                      className={`w-8 h-8 rounded-full ${color.className} cursor-pointer ring-offset-2 transition-all ${themeColor === color.value ? "ring-2 ring-primary ring-offset-2" : "hover:ring-2 ring-slate-300"
                        }`}
                      onClick={() => setThemeColor(color.value)}
                      title={t(`colors.${color.colorName}` as Parameters<typeof t>[0])}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">{t("layoutMode")}</label>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className={`border rounded-lg p-2 text-center text-xs font-medium cursor-pointer transition-colors ${layoutMode === "sidebar"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-slate-200 bg-slate-50 text-slate-900"
                      }`}
                    onClick={() => setLayoutMode("sidebar")}
                  >
                    {t("sidebarLayout")}
                  </div>
                  <div
                    className="border border-slate-200 rounded-lg p-2 text-center text-xs font-medium text-slate-400 bg-slate-50 cursor-not-allowed opacity-50"
                    title={t("notSupported")}
                  >
                    {t("topNav")}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                {t("accessControl")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium text-slate-900">{t("enableSite")}</label>
                  <p className="text-xs text-slate-500">{t("enableTip")}</p>
                </div>
                <div
                  className={`w-10 h-5 ${isActive ? "bg-primary" : "bg-slate-200"} rounded-full relative cursor-pointer`}
                  onClick={() => setIsActive(!isActive)}
                >
                  <div className={`absolute ${isActive ? "right-0.5" : "left-0.5"} top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              {tf("siteAdmin")}
            </CardTitle>
            <CardDescription className="text-xs">
              {tf("siteAdminDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-0.5">
                <label className="text-sm font-medium text-slate-900">{t("initAdmin")}</label>
                <p className="text-xs text-slate-500">{t("initAdminTip")}</p>
              </div>
              <div
                className={`w-10 h-5 ${initAdmin ? "bg-primary" : "bg-slate-200"} rounded-full relative cursor-pointer`}
                onClick={() => setInitAdmin(!initAdmin)}
              >
                <div className={`absolute ${initAdmin ? "right-0.5" : "left-0.5"} top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all`} />
              </div>
            </div>

            {initAdmin && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">{t("adminEmail")} <span className="text-red-500">*</span></label>
                  <Input
                    className="h-9"
                    placeholder="admin@catwiki.cn"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">{t("adminPassword")}</label>
                  <Input
                    className="h-9"
                    type="text"
                    placeholder={t("passwordPlaceholder")}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    autoComplete="new-password"
                    name="site_admin_password_new"
                  />
                  <p className="text-[10px] text-slate-500">{t("adminTip")}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
