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

import { useTranslations } from "next-intl"
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui"
import { ShieldCheck, Crown, Lock, Eye, EyeOff, Save } from "lucide-react"

interface SiteAccessCardProps {
  isActive: boolean
  onToggleActive: () => void
  isEnterprise: boolean
  eeIsPublic: boolean
  onTogglePublic: () => void
  eeHasPassword: boolean
  eeNewPassword: string
  setEeNewPassword: (v: string) => void
  eeShowPassword: boolean
  setEeShowPassword: (v: boolean) => void
  onSavePassword: () => void
  showStats: boolean
  setShowStats: (v: boolean) => void
}

export function SiteAccessCard({
  isActive, onToggleActive, isEnterprise,
  eeIsPublic, onTogglePublic, eeHasPassword,
  eeNewPassword, setEeNewPassword, eeShowPassword, setEeShowPassword, onSavePassword,
  showStats, setShowStats,
}: SiteAccessCardProps) {
  const t = useTranslations("SiteSettings")
  const createT = useTranslations("CreateSite")
  return (
    <Card className="border-slate-200/60 shadow-none rounded-xl overflow-hidden">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">{t("access.title")}</CardTitle>
            <CardDescription className="text-xs">{t("access.description")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
          <div className="space-y-0.5">
            <label className="text-sm font-semibold text-slate-900">{createT("enableSite")}</label>
            <p className="text-xs text-slate-500">{createT("enableTip")}</p>
          </div>
          <div
            className={`w-11 h-6 ${isActive ? "bg-primary" : "bg-slate-200"} rounded-full relative cursor-pointer transition-colors`}
            onClick={onToggleActive}
          >
            <div className={`absolute ${isActive ? "right-1" : "left-1"} top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all`} />
          </div>
        </div>

        {/* EE: 是否公开 + 访问密码 */}
        <div className={!isEnterprise ? "pointer-events-none select-none" : undefined}>
          <div className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-slate-900">{t("access.isPublic")}</label>
                {!isEnterprise && (
                  <span className="inline-flex items-center gap-1 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-[10px] font-bold px-1.5 py-0 rounded-full shadow-sm h-4">
                    <Crown className="h-2.5 w-2.5" />
                    {t("access.eeBadge")}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">{t("access.isPublicTip")}</p>
            </div>
            <div
              className={`w-11 h-6 ${eeIsPublic ? "bg-primary" : "bg-slate-200"} rounded-full relative cursor-pointer transition-colors`}
              onClick={onTogglePublic}
            >
              <div className={`absolute ${eeIsPublic ? "right-1" : "left-1"} top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all`} />
            </div>
          </div>

          {!isEnterprise && (
            <div className="flex items-center gap-3 px-3 py-2 mt-3 bg-violet-50 text-violet-700 rounded-lg border border-violet-200 shadow-sm">
              <Crown className="h-4 w-4 shrink-0" />
              <p className="text-[13px] font-medium">{t("access.enterpriseOnly")}</p>
            </div>
          )}

          {!eeIsPublic && (
            <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl space-y-3 mt-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                  <label className="text-sm font-semibold text-slate-900">{t("access.accessPassword")}</label>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${eeHasPassword ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {eeHasPassword ? t("access.passwordSet") : t("access.passwordNotSet")}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{t("access.accessPasswordTip")}</p>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={eeShowPassword ? "text" : "password"}
                    className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-9 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
                    placeholder={t("access.passwordPlaceholder")}
                    value={eeNewPassword}
                    onChange={(e) => setEeNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    onClick={() => setEeShowPassword(!eeShowPassword)}
                  >
                    {eeShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  size="sm"
                  className="h-9 px-4"
                  disabled={!eeNewPassword.trim()}
                  onClick={onSavePassword}
                >
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {t("save")}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* CE: 对话性能统计开关（mock，尚未接通后端） */}
        <div className="flex items-center justify-between gap-4 p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
          <div className="space-y-0.5 min-w-0 flex-1">
            <label className="text-sm font-semibold text-slate-900">{t("stats.show")}</label>
            <p className="text-xs text-slate-500">{t("stats.showHint")}</p>
          </div>
          <div
            className={`shrink-0 w-11 h-6 ${showStats ? "bg-primary" : "bg-slate-200"} rounded-full relative cursor-pointer transition-colors`}
            onClick={() => setShowStats(!showStats)}
          >
            <div className={`absolute ${showStats ? "right-1" : "left-1"} top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
