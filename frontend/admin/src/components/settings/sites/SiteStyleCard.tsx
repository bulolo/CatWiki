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
import { Palette } from "lucide-react"

// 主题色配置
const THEME_COLORS_BASE = [
  { value: "blue", colorName: "blue", className: "bg-blue-500" },
  { value: "emerald", colorName: "emerald", className: "bg-emerald-500" },
  { value: "purple", colorName: "purple", className: "bg-purple-500" },
  { value: "orange", colorName: "orange", className: "bg-orange-500" },
  { value: "slate", colorName: "slate", className: "bg-slate-800" },
] as const

interface SiteStyleCardProps {
  themeColor: string
  setThemeColor: (v: string) => void
  layoutMode: string
  setLayoutMode: (v: string) => void
}

export function SiteStyleCard({ themeColor, setThemeColor, layoutMode, setLayoutMode }: SiteStyleCardProps) {
  const t = useTranslations("SiteSettings")
  const createT = useTranslations("CreateSite")
  return (
    <Card className="border-slate-200/60 shadow-none rounded-xl overflow-hidden">
      <CardHeader className="border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 rounded-lg text-purple-600 border border-purple-100">
            <Palette className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">{t("style.title")}</CardTitle>
            <CardDescription className="text-xs">{t("style.description")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">{createT("themeColor")}</label>
          <div className="flex gap-2">
            {THEME_COLORS_BASE.map((color) => (
              <div
                key={color.value}
                className={`w-8 h-8 rounded-full ${color.className} cursor-pointer ring-offset-2 transition-all ${themeColor === color.value ? "ring-2 ring-primary ring-offset-2" : "hover:ring-2 ring-slate-300"
                  }`}
                onClick={() => setThemeColor(color.value)}
                title={createT(`colors.${color.colorName}` as Parameters<typeof createT>[0])}
              />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">{createT("layoutMode")}</label>
          <div className="grid grid-cols-2 gap-2">
            <div
              className={`border rounded-xl p-3 text-center text-xs font-bold cursor-pointer transition-all ${layoutMode === "sidebar"
                ? "border-primary bg-primary/5 text-primary shadow-sm"
                : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white"
                }`}
              onClick={() => setLayoutMode("sidebar")}
            >
              {createT("sidebarLayout")}
            </div>
            <div
              className="border border-slate-200 rounded-xl p-3 text-center text-xs font-bold text-slate-400 bg-slate-50/50 cursor-not-allowed opacity-50"
              title={createT("notSupported")}
            >
              {createT("topNav")}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
