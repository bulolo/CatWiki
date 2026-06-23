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
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/components/ui"
import {
  ChevronLeft,
  UserPlus,
  Mail,
  Shield,
  Check,
  Loader2
} from "lucide-react"
import { toast } from "sonner"
import { useInviteUser, useSitesList } from "@/hooks"
import { useCurrentUser } from "@/lib/auth-store"
import { useHealth } from "@/hooks/useHealth"
import { UserRole, type Site } from "@/lib/sdk/sdk.schemas"
import { parseInviteResponse } from "@/lib/user-response-parsers"
import { useTranslations } from "next-intl"

interface CreateUserFormProps {
  onCancel: () => void
  onSuccess: () => void
  fixedSiteId?: number
  fixedSiteName?: string
}

export function CreateUserForm({ onCancel, onSuccess, fixedSiteId, fixedSiteName }: CreateUserFormProps) {
  const t = useTranslations("CreateUser")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<UserRole>("site_admin" as const)
  const [selectedSites, setSelectedSites] = useState<number[]>(fixedSiteId ? [fixedSiteId] : [])

  const userInfo = useCurrentUser()
  const isPlatformAdmin = userInfo?.role === "admin" as const
  const { data: healthData } = useHealth()
  const edition = healthData?.edition || "community"

  const { data: sites } = useSitesList({ page: 1, size: 100 })
  const inviteUserMutation = useInviteUser()

  const toggleSite = (siteId: number) => {
    setSelectedSites(prev =>
      prev.includes(siteId)
        ? prev.filter(id => id !== siteId)
        : [...prev, siteId]
    )
  }

  const handleInvite = () => {
    if (!email.trim()) {
      toast.error(t("errorEmptyEmail"))
      return
    }

    inviteUserMutation.mutate({
      email: email.trim(),
      role: role,
      managed_site_ids: (role === "admin" as const || role === "tenant_admin" as const) ? [] : selectedSites,
    }, {
      onSuccess: (data) => {
        const parsed = parseInviteResponse(data)
        if (parsed) {
          const { user, password } = parsed

          toast.success(
            <div className="space-y-2">
              <div className="font-semibold">{t("successTitle")}</div>
              <div className="text-sm">
                <div>{t("successEmail")}: {user.email}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span>{t("successPassword")}: </span>
                  <code className="px-2 py-1 bg-slate-800 text-white rounded font-mono text-xs">
                    {password}
                  </code>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {t("successTip")}
              </div>
            </div>,
            { duration: 10000 }
          )

          onSuccess()
        }
      },
      onError: (error: unknown) => {
        const apiLike = error as { status?: number; body?: { code?: number; msg?: string }; message?: string }
        // Handle 409 Conflict (Email already exists)
        if (apiLike?.status === 409 || apiLike?.body?.code === 409) {
          toast.error(t("errorConflict"), {
            description: t("errorConflictDesc")
          })
          return
        }

        // Handle other errors
        const msg = apiLike?.body?.msg || apiLike?.message || t("errorFailed")
        toast.error(msg)
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
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {fixedSiteName ? t("titleTo", { name: fixedSiteName }) : t("title")}
            </h1>
            <p className="text-slate-500 text-xs hidden md:block">
              {fixedSiteName ? t("descriptionTo", { name: fixedSiteName }) : t("description")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={inviteUserMutation.isPending}>
            {t("cancel")}
          </Button>
          <Button size="sm" className="flex items-center gap-2" onClick={handleInvite} disabled={inviteUserMutation.isPending}>
            {inviteUserMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {inviteUserMutation.isPending ? t("creating") : t("confirm")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 px-1">
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              {t("accountInfo")}
            </CardTitle>
            <CardDescription className="text-xs">
              {t("accountDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">{t("emailLabel")} <span className="text-red-500">*</span></label>
              <Input
                className="h-9 max-w-md"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              {t("roleLabel")}
            </CardTitle>
            <CardDescription className="text-xs">
              {fixedSiteId ? t("roleDescTo") : t("roleDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                <div
                  className={`border rounded-xl p-4 cursor-pointer transition-all ${role === "site_admin" as const ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-slate-200 hover:border-slate-300"}`}
                  onClick={() => setRole("site_admin" as const)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-sm">{t("siteAdmin")}</span>
                    {role === "site_admin" as const && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {t("siteAdminDesc")}
                  </p>
                </div>

                <div
                  className={`border rounded-xl p-4 cursor-pointer transition-all ${role === "tenant_admin" as const ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-slate-200 hover:border-slate-300"}`}
                  onClick={() => setRole("tenant_admin" as const)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-sm">{t("orgAdmin")}</span>
                    {role === "tenant_admin" as const && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {edition === "community"
                      ? t("superAdminDesc")
                      : t("orgAdminDesc")}
                  </p>
                </div>

                {edition !== "community" && !fixedSiteId && isPlatformAdmin && (
                  <div
                    className={`border rounded-xl p-4 cursor-pointer transition-all ${role === "admin" as const ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-slate-200 hover:border-slate-300"}`}
                    onClick={() => setRole("admin" as const)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-sm">{t("sysAdmin")}</span>
                      {role === "admin" as const && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {t("sysAdminDesc")}
                    </p>
                  </div>
                )}
              </div>
            </div>


            {(role !== "admin" as const && role !== "tenant_admin" as const) && !fixedSiteId && (
              <div className="mt-6 pt-6 border-t border-slate-100">
                <label className="text-sm font-medium text-slate-700 block mb-3">
                  {t("assignSites")} <span className="text-slate-500 font-normal">{t("selectedCount", { count: selectedSites.length })}</span>
                </label>

                {(!sites || sites.length === 0) ? (
                  <div className="text-sm text-slate-500 bg-slate-50 p-4 rounded-lg text-center">
                    {t("noSites")}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2">
                    {sites.map((site: Site) => (
                      <div
                        key={site.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedSites.includes(site.id) ? "border-primary bg-primary/5" : "border-slate-200 hover:bg-slate-50"}`}
                        onClick={() => toggleSite(site.id)}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${selectedSites.includes(site.id) ? "bg-primary border-primary text-white" : "border-slate-300 bg-white"}`}>
                          {selectedSites.includes(site.id) && <Check className="h-3.5 w-3.5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{site.name}</div>
                          <div className="text-xs text-slate-500 truncate">{site.slug || (edition === "community" ? "" : t("noSlug"))}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  {t("assignTip")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div >
  )
}
