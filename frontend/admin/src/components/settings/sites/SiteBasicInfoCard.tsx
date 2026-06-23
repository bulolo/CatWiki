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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui"
import { ImageUpload } from "@/components/common"
import { Settings } from "lucide-react"

interface SiteBasicInfoCardProps {
  icon: string | null
  setIcon: (v: string | null) => void
  name: string
  setName: (v: string) => void
  slug: string
  setSlug: (v: string) => void
  description: string
  setDescription: (v: string) => void
  siteUrlPrefix: string
}

export function SiteBasicInfoCard({
  icon, setIcon, name, setName, slug, setSlug, description, setDescription, siteUrlPrefix,
}: SiteBasicInfoCardProps) {
  const t = useTranslations("SiteSettings")
  const createT = useTranslations("CreateSite")
  return (
    <Card className="border-slate-200/60 shadow-none rounded-xl overflow-hidden">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600 border border-blue-100">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">{t("basic.title")}</CardTitle>
            <CardDescription className="text-xs">
              {t("basic.description")}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-col md:flex-row gap-8">
          {/* 站点图标上传 */}
          <div className="w-full md:w-32 space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">{t("basic.icon")}</label>
            <ImageUpload
              value={icon}
              onChange={setIcon}
              text={t("basic.change")}
              aspect="aspect-square"
              className="w-full"
            />
          </div>

          {/* 站点基本信息字段 */}
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">{t("basic.name")}</label>
                <input
                  className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
                  placeholder={createT("namePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">{t("basic.slug")}</label>
                <div className="flex items-center">
                  <span
                    className="inline-flex items-center px-3 h-9 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 text-slate-500 text-[10px] font-mono flex-1 min-w-0 overflow-hidden"
                    title={siteUrlPrefix}
                  >
                    <span className="truncate">{siteUrlPrefix}</span>
                  </span>
                  <input
                    className="flex h-9 w-[35%] min-w-[80px] rounded-r-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
                    placeholder={createT("slugPlaceholder")}
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">{t("basic.desc")}</label>
              <textarea
                className="flex min-h-[80px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 resize-none"
                placeholder={createT("descPlaceholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
