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

import { useState, useEffect, useRef } from "react"
import { useTranslations } from "next-intl"
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Tabs, TabsContent, TabsList, TabsTrigger, ImageUpload } from "@/components/ui"
import {
  Settings,
  Palette,
  ShieldCheck,
  MessageSquare,
  Bot,
  Users,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Lock,
  Crown,
} from "lucide-react"
import { toast } from "sonner"
import { useSiteById, useUpdateSite, useHealth } from "@/hooks"
import { QuickQuestionsConfig } from "@/components/features"
import type { QuickQuestion } from "@/lib/sdk/sdk.schemas"
import { SiteBotSettings, SiteUsers } from "@/components/sites"
import { initialConfigs, type BotConfig } from "@/types/settings"
import { env } from "@/lib/env"
import { mergeSiteBotConfig } from "@/lib/site-bot-config"
import { useAIConfig } from "@/hooks"

// 主题色配置
const THEME_COLORS_BASE = [
  { value: "blue", colorName: "blue", className: "bg-blue-500" },
  { value: "emerald", colorName: "emerald", className: "bg-emerald-500" },
  { value: "purple", colorName: "purple", className: "bg-purple-500" },
  { value: "orange", colorName: "orange", className: "bg-orange-500" },
  { value: "slate", colorName: "slate", className: "bg-slate-800" },
] as const

interface SiteSettingsProps {
  siteId: number
  onBack?: () => void
}

interface SiteSettingsSnapshot {
  name: string
  slug: string
  description: string
  icon: string | null
  isActive: boolean
  themeColor: string
  layoutMode: string
  quickQuestions: QuickQuestion[]
  botConfig: BotConfig
  showStats: boolean
}

export function SiteSettings({ siteId, onBack }: SiteSettingsProps) {
  const t = useTranslations("SiteSettings")
  const createT = useTranslations("CreateSite")
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [icon, setIcon] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [themeColor, setThemeColor] = useState<string>("blue")
  const [layoutMode, setLayoutMode] = useState<string>("sidebar")
  const [quickQuestions, setQuickQuestions] = useState<QuickQuestion[]>([])
  const [botConfig, setBotConfig] = useState(initialConfigs.bot_config)
  // CE: 是否在对话页面展示性能统计（TTFB / 首字 / 总耗时 / 工具耗时 / Tokens）
  const [showStats, setShowStats] = useState(false)
  const [mounted, setMounted] = useState(false)

  // EE: 站点访问控制状态
  const { data: healthData } = useHealth()
  const isEnterprise = healthData?.edition === "enterprise"
  const [eeIsPublic, setEeIsPublic] = useState(true)
  const [eeHasPassword, setEeHasPassword] = useState(false)
  const [eeNewPassword, setEeNewPassword] = useState("")
  const [eeShowPassword, setEeShowPassword] = useState(false)

  const initialDataRef = useRef<SiteSettingsSnapshot | null>(null)

  // 确保水合一致性
  useEffect(() => {
    setMounted(true)
  }, [])

  // 使用 React Query hooks
  const { data: siteData, isLoading: loading } = useSiteById(siteId)
  const updateSiteMutation = useUpdateSite()
  const { data: aiConfigData } = useAIConfig("tenant")

  // 模型显示逻辑：优先使用租户自定义模型，如果是平台模式则取平台默认模型
  const chatConfig = aiConfigData?.configs?.chat as { mode?: string; model?: string } | undefined
  const platformChat = aiConfigData?.platform_defaults?.chat as { model?: string } | undefined
  const chatModel = (chatConfig?.mode === "platform" ? platformChat?.model : chatConfig?.model) || ""
  const tenantSlug = siteData?.tenant_slug || "..."
  const siteUrlPrefix = `${env.NEXT_PUBLIC_CLIENT_URL}/${tenantSlug}/`

  // 加载站点数据
  useEffect(() => {
    if (siteData && !initialDataRef.current) {
      const bConfig = mergeSiteBotConfig(siteData.bot_config)

      // 从 EE API 加载全量 EE 配置（访问控制 + 机器人）
      let eeApi: any = null
      try { eeApi = require("@/ee/api").eeApi } catch (e) { }

      if (eeApi) {
        eeApi.sites.getConfig(siteId).then((eeConfig: any) => {
          // 1. 同步机器人配置
          bConfig.api_bot = {
            enabled: eeConfig.api_bot.enabled,
            api_key: eeConfig.api_bot.api_key,
            timeout: eeConfig.api_bot.timeout,
          }
          setBotConfig({ ...bConfig })
          
          // 2. 同步访问控制状态
          setEeIsPublic(eeConfig.access.is_public)
          setEeHasPassword(eeConfig.access.has_password)
          
          initialDataRef.current = { 
            ...initialDataRef.current!, 
            botConfig: { ...bConfig } 
          }
        }).catch(() => {
          // EE 未启用或加载失败
        })
      }

      const initialShowStats = !!siteData.show_pipeline_trace
      setName(siteData.name)
      setSlug(siteData.slug || "")
      setDescription(siteData.description || "")
      setIcon(siteData.icon || null)
      setIsActive(siteData.status === "active")
      setThemeColor(siteData.theme_color || "blue")
      setLayoutMode(siteData.layout_mode || "sidebar")
      setQuickQuestions(siteData.quick_questions || [])
      setBotConfig(bConfig)
      setShowStats(initialShowStats)

      initialDataRef.current = {
        name: siteData.name,
        slug: siteData.slug || "",
        description: siteData.description || "",
        icon: siteData.icon || null,
        isActive: siteData.status === "active",
        themeColor: siteData.theme_color || "blue",
        layoutMode: siteData.layout_mode || "sidebar",
        quickQuestions: siteData.quick_questions || [],
        botConfig: bConfig,
        showStats: initialShowStats,
      }
    }
  }, [siteData, siteId])

  // (加载逻辑已合并到上方数据加载 useEffect 中)

  // 启用/禁用站点立即生效
  const handleToggleActive = async () => {
    const next = !isActive
    setIsActive(next)
    try {
      await updateSiteMutation.mutateAsync({ siteId, data: { status: next ? "active" : "disabled" } })
      toast.success(t("saveSuccess"))
    } catch (e: unknown) {
      setIsActive(!next)
      toast.error((e instanceof Error && e.message) || t("saveError"))
    }
  }

  // EE: 保存访问控制配置
  const handleSaveAccessConfig = async (updates: { is_public?: boolean; password?: string | null }) => {
    try {
      let eeApi: any = null
      try { eeApi = require("@/ee/api").eeApi } catch (e) { }
      if (!eeApi) return

      const config = await eeApi.sites.updateConfig(siteId, {
        access: {
          is_public: updates.is_public,
          password: updates.password || undefined
        }
      })
      setEeIsPublic(config.access.is_public)
      setEeHasPassword(config.access.has_password)
      setEeNewPassword("")
      if (config.access.generated_password) {
        toast.success(`访问密码已自动设置为：${config.access.generated_password}，请妥善保存`, { duration: 10000 })
      } else {
        toast.success(t("saveSuccess"))
      }
    } catch (e: unknown) {
      toast.error((e instanceof Error && e.message) || "保存失败")
    }
  }

  const isDirty = initialDataRef.current && JSON.stringify({
    name,
    slug,
    description,
    icon,
    isActive,
    themeColor,
    layoutMode,
    quickQuestions: quickQuestions.filter(q => q.text.trim()),
    botConfig,
    showStats
  }) !== JSON.stringify(initialDataRef.current)

  const handleSave = () => {
    if (!name.trim()) {
      toast.error(createT("nameRequired"))
      return
    }
    if (!slug.trim()) {
      toast.error(createT("slugRequired"))
      return
    }

    const cleanedQuestions = quickQuestions.filter(q => q.text.trim())
    const { api_bot, ...botConfigWithoutApiBot } = botConfig

    const saveMain = updateSiteMutation.mutateAsync({
      siteId,
      data: {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        icon: icon || null,
        status: isActive ? "active" : "disabled",
        theme_color: themeColor,
        layout_mode: layoutMode,
        quick_questions: cleanedQuestions.length > 0 ? cleanedQuestions : null,
        bot_config: botConfigWithoutApiBot,
        show_pipeline_trace: showStats,
      }
    })

    let eeApi: any = null
    try { eeApi = require("@/ee/api").eeApi } catch (e) { }

    const saveEE = eeApi ? eeApi.sites.updateConfig(siteId, {
      api_bot: {
        enabled: api_bot.enabled,
        api_key: api_bot.api_key,
        timeout: api_bot.timeout,
      }
    }).catch(() => {
      // EE 未启用静默忽略
    }) : Promise.resolve()

    Promise.all([saveMain, saveEE]).then(([updatedSite]) => {
      if (!updatedSite) return
      const bConfig = mergeSiteBotConfig(updatedSite.bot_config)
      bConfig.api_bot = api_bot
      const nextShowStats = !!updatedSite.show_pipeline_trace

      setBotConfig(bConfig)
      setName(updatedSite.name)
      setSlug(updatedSite.slug || "")
      setDescription(updatedSite.description || "")
      setIcon(updatedSite.icon || null)
      setIsActive(updatedSite.status === "active")
      setThemeColor(updatedSite.theme_color || "blue")
      setLayoutMode(updatedSite.layout_mode || "sidebar")
      setQuickQuestions(updatedSite.quick_questions || [])
      setShowStats(nextShowStats)

      initialDataRef.current = {
        name: updatedSite.name,
        slug: updatedSite.slug || "",
        description: updatedSite.description || "",
        icon: updatedSite.icon || null,
        isActive: updatedSite.status === "active",
        themeColor: updatedSite.theme_color || "blue",
        layoutMode: updatedSite.layout_mode || "sidebar",
        quickQuestions: updatedSite.quick_questions || [],
        botConfig: bConfig,
        showStats: nextShowStats,
      }
      toast.success(t("saveSuccess"))
    }).catch(() => {
      toast.error("保存失败")
    })
  }

  const handleBotConfigChange = <S extends keyof BotConfig>(
    section: S,
    field: keyof BotConfig[S],
    value: BotConfig[S][keyof BotConfig[S]]
  ) => {
    setBotConfig((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      } as BotConfig[S]
    }))
  }

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-500 flex items-center gap-2">
          <div className="h-4 w-4 bg-slate-200 animate-pulse rounded-full" />
          {t("loading")}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Actions Bar - Replaces the Page Header */}
      <div className="flex items-center justify-between px-1 pb-4 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{name} {t("title")}</h2>
          <p className="text-xs text-slate-500">{t("description")}</p>
        </div>

        {isDirty && (
          <Button
            onClick={handleSave}
            disabled={updateSiteMutation.isPending}
            size="sm"
            className="flex items-center gap-2 h-9 px-4 animate-in fade-in duration-200"
          >
            {updateSiteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {updateSiteMutation.isPending ? t("saving") : t("save")}
          </Button>
        )}
      </div>

      <Tabs defaultValue="basic" className="flex-1 flex flex-col min-h-0">
        <div className="flex flex-1 gap-6 min-h-0">
          {/* 左侧导航 - Sidebar Style */}
          <div className="w-48 shrink-0 overflow-y-auto pr-1">
            <TabsList className="flex flex-col h-auto bg-transparent gap-1 p-0 w-full justify-start">
              <TabsTrigger
                value="basic"
                className="w-full justify-start rounded-lg px-3 py-2.5 h-auto data-[state=active]:bg-primary/5 data-[state=active]:text-primary text-slate-600 hover:bg-slate-100/80 transition-all font-medium group"
              >
                <Settings className="h-4 w-4 mr-2.5 opacity-70 group-data-[state=active]:opacity-100" />
                {t("tabs.basic")}
              </TabsTrigger>
              <TabsTrigger
                value="questions"
                className="w-full justify-start rounded-lg px-3 py-2.5 h-auto data-[state=active]:bg-primary/5 data-[state=active]:text-primary text-slate-600 hover:bg-slate-100/80 transition-all font-medium group"
              >
                <MessageSquare className="h-4 w-4 mr-2.5 opacity-70 group-data-[state=active]:opacity-100" />
                {t("tabs.questions")}
              </TabsTrigger>
              <TabsTrigger
                value="users"
                className="w-full justify-start rounded-lg px-3 py-2.5 h-auto data-[state=active]:bg-primary/5 data-[state=active]:text-primary text-slate-600 hover:bg-slate-100/80 transition-all font-medium group"
              >
                <Users className="h-4 w-4 mr-2.5 opacity-70 group-data-[state=active]:opacity-100" />
                {t("tabs.users")}
              </TabsTrigger>
              <TabsTrigger
                value="bot"
                className="w-full justify-start rounded-lg px-3 py-2.5 h-auto data-[state=active]:bg-primary/5 data-[state=active]:text-primary text-slate-600 hover:bg-slate-100/80 transition-all font-medium group"
              >
                <Bot className="h-4 w-4 mr-2.5 opacity-70 group-data-[state=active]:opacity-100" />
                {t("tabs.bot")}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 右侧内容 - Scrollable Area */}
          <div className="flex-1 overflow-y-auto pr-2 pb-10">
            <TabsContent value="basic" className="space-y-6 mt-0 animate-in fade-in-50 duration-300 data-[state=inactive]:hidden">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        onClick={handleToggleActive}
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
                          onClick={() => {
                            if (!isEnterprise) return
                            const next = !eeIsPublic
                            setEeIsPublic(next)
                            handleSaveAccessConfig({ is_public: next })
                          }}
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
                              onClick={() => handleSaveAccessConfig({ password: eeNewPassword })}
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
              </div>
            </TabsContent>

            <TabsContent value="questions" className="space-y-6 mt-0 animate-in fade-in-50 duration-300 data-[state=inactive]:hidden">
              <QuickQuestionsConfig
                questions={quickQuestions}
                onChange={setQuickQuestions}
              />
            </TabsContent>


            <TabsContent value="users" className="space-y-6 mt-0 animate-in fade-in-50 duration-300 data-[state=inactive]:hidden">
              <SiteUsers siteId={siteId} siteName={name} />
            </TabsContent>

            <TabsContent value="bot" className="space-y-6 mt-0 animate-in fade-in-50 duration-300 data-[state=inactive]:hidden">
              <SiteBotSettings
                siteId={siteId}
                config={botConfig}
                onChange={handleBotConfigChange}
                chatModel={chatModel}
              />
            </TabsContent>

          </div>
        </div>
      </Tabs>
    </div>
  )
}
