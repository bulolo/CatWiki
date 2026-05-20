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
import { useTranslations } from 'next-intl'
import { useRouter, useParams } from "next/navigation"
import { Button, Card, CardContent, CardHeader, CardTitle, CardDescription, Input, Tabs, TabsContent, TabsList, TabsTrigger, ImageUpload } from "@/components/ui"
import {
  ChevronLeft,
  Save,
  Settings,
  Palette,
  ShieldCheck,
  MessageSquare,
  Bot,
  Users,
  Loader2
} from "lucide-react"
import { toast } from "sonner"
import { useSiteById, useUpdateSite } from "@/hooks"
import { QuickQuestionsConfig } from "@/components/features"
import type { QuickQuestion } from '@/lib/sdk/sdk.schemas'
import { SiteBotSettings, SiteUsers } from "@/components/sites"
import { initialConfigs, type BotConfig } from "@/types/settings"
import { env } from "@/lib/env"
import { mergeSiteBotConfig } from "@/lib/site-bot-config"

export default function EditSitePage() {
  const router = useRouter()
  const t = useTranslations('SiteEdit')
  const tf = useTranslations('SiteForm')
  const params = useParams()

  const THEME_COLORS = [
    { value: 'blue', label: tf('colors.blue'), className: 'bg-blue-500' },
    { value: 'emerald', label: tf('colors.green'), className: 'bg-emerald-500' },
    { value: 'purple', label: tf('colors.purple'), className: 'bg-purple-500' },
    { value: 'orange', label: tf('colors.orange'), className: 'bg-orange-500' },
    { value: 'slate', label: tf('colors.gray'), className: 'bg-slate-800' },
  ]
  const siteId = parseInt(params.id as string)

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [icon, setIcon] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(true)
  const [themeColor, setThemeColor] = useState<string>("blue")
  const [layoutMode, setLayoutMode] = useState<string>("sidebar")
  const [quickQuestions, setQuickQuestions] = useState<QuickQuestion[]>([])
  const [botConfig, setBotConfig] = useState(initialConfigs.bot_config)
  const [isPublic, setIsPublic] = useState(true) // EE: 是否公开
  const [password, setPassword] = useState("") // EE: 访问密码
  const [hasPassword, setHasPassword] = useState(false) // EE: 是否已有密码
  const [mounted, setMounted] = useState(false)

  const initialDataRef = useRef<{
    name: string
    slug: string
    description: string
    icon: string | null
    isActive: boolean
    themeColor: string
    layoutMode: string
    quickQuestions: QuickQuestion[]
    botConfig: BotConfig
    isPublic: boolean
  } | null>(null)

  // 确保水合一致性
  useEffect(() => {
    setMounted(true)
  }, [])

  // 使用 React Query hooks
  const { data: siteData, isLoading: loading } = useSiteById(siteId)
  const updateSiteMutation = useUpdateSite()
  
  // 从站点数据中获取租户标识
  const tenantSlug = siteData?.tenant_slug || '...'

  // 加载站点数据
  useEffect(() => {
    if (siteData && !initialDataRef.current) {
      const bConfig = mergeSiteBotConfig(siteData.bot_config)

      // 从 EE API 加载全量配置（EE 版本）
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
          setIsPublic(eeConfig.access.is_public)
          setHasPassword(eeConfig.access.has_password)
          
          initialDataRef.current = { 
            ...initialDataRef.current!, 
            botConfig: { ...bConfig },
            isPublic: eeConfig.access.is_public
          }
        }).catch(() => {
          // EE 未启用或加载失败
        })
      }

      setName(siteData.name)
      setSlug(siteData.slug || "")
      setDescription(siteData.description || "")
      setIcon(siteData.icon || null)
      setIsActive(siteData.status === "active")
      setThemeColor(siteData.theme_color || "blue")
      setLayoutMode(siteData.layout_mode || "sidebar")
      setQuickQuestions(siteData.quick_questions || [])
      setBotConfig(bConfig)

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
        isPublic: true,
      }
    }
  }, [siteData, siteId])

  const handleBack = () => {
    router.back()
  }

  const isDirty = initialDataRef.current && JSON.stringify({
    name,
    slug,
    description,
    icon,
    isActive,
    isPublic,
    password,
    themeColor,
    layoutMode,
    quickQuestions: quickQuestions.filter(q => q.text.trim()),
    botConfig
  }) !== JSON.stringify({ ...initialDataRef.current, password: "" })

  const handleSave = () => {
    if (!name.trim()) {
      toast.error(tf("errorName"))
      return
    }
    if (!slug.trim()) {
      toast.error(tf("errorSlug"))
      return
    }

    const cleanedQuestions = quickQuestions.filter(q => q.text.trim())

    // api_bot 单独走 EE API，从主表 bot_config 中剔除
    const { api_bot, ...botConfigWithoutApiBot } = botConfig

    // 并行保存：主表 + EE api_bot
    const saveMain = updateSiteMutation.mutateAsync({
      siteId,
      data: {
        name: name.trim(),
        slug: slug.trim() || undefined,
        description: description.trim() || undefined,
        icon: icon || null,
        status: isActive ? "active" : "disabled",
        theme_color: themeColor,
        layout_mode: layoutMode,
        quick_questions: cleanedQuestions.length > 0 ? cleanedQuestions : null,
        bot_config: botConfigWithoutApiBot
      }
    })

    let eeApi: any = null
    try { eeApi = require("@/ee/api").eeApi } catch (e) { }

    const saveEE = eeApi ? eeApi.sites.updateConfig(siteId, {
      access: {
        is_public: isPublic,
        password: password.trim() || undefined,
      },
      api_bot: {
        enabled: api_bot.enabled,
        api_key: api_bot.api_key,
        timeout: api_bot.timeout,
      }
    }).then((res: any) => {
      if (res.access.generated_password) {
        toast.info(`系统已自动生成访问密码: ${res.access.generated_password}`, { duration: 10000 })
      }
      setHasPassword(res.access.has_password)
      setPassword("")
    }).catch(() => {
      // EE 未启用静默忽略
    }) : Promise.resolve()

    Promise.all([saveMain, saveEE]).then(() => {
      initialDataRef.current = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        icon,
        isActive,
        themeColor,
        layoutMode,
        quickQuestions: cleanedQuestions,
        botConfig,
        isPublic,
      }
      toast.success(tf("saveSuccess"))
    }).catch(() => {
      toast.error(tf("saveError") || "保存失败")
    })
  }

  const handleBotConfigChange = <S extends keyof BotConfig,>(
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
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500">{t("loading")}</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            className="rounded-xl hover:bg-slate-100 transition-colors h-10 w-10 border border-slate-200 bg-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("title")}</h1>
            <p className="text-muted-foreground text-sm">{t("description")}</p>
          </div>
        </div>
        {isDirty && (
          <Button
            onClick={handleSave}
            disabled={updateSiteMutation.isPending}
            className="flex items-center gap-2 h-11 px-8 animate-in fade-in duration-200"
          >
            {updateSiteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {updateSiteMutation.isPending ? t("saving") : t("save")}
          </Button>
        )}
      </div>

      <Tabs defaultValue="basic" className="space-y-0">
        <div className="grid grid-cols-12 gap-8 items-start">
          {/* 左侧导航 */}
          <div className="col-span-3">
            <Card className="border-slate-200/60 shadow-sm bg-muted/30 overflow-hidden p-2">
              <TabsList className="grid grid-cols-1 h-auto bg-transparent gap-1 p-0">
                <TabsTrigger
                  value="basic"
                  className="w-full justify-start rounded-xl px-4 py-3 h-auto data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary text-slate-600 hover:bg-card/50 hover:text-foreground transition-all font-bold group"
                >
                  <div className="p-1.5 rounded-lg bg-muted text-muted-foreground group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary mr-3 transition-colors">
                    <Settings className="h-4 w-4" />
                  </div>
                  {t("tabs.basic")}
                </TabsTrigger>
                <TabsTrigger
                  value="questions"
                  className="w-full justify-start rounded-xl px-4 py-3 h-auto data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary text-slate-600 hover:bg-card/50 hover:text-foreground transition-all font-bold data-[state=active]:ring-1 data-[state=active]:ring-border group"
                >
                  <div className="p-1.5 rounded-lg bg-muted text-muted-foreground group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary mr-3 transition-colors">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  {t("tabs.questions")}
                </TabsTrigger>
                <TabsTrigger
                  value="users"
                  className="w-full justify-start rounded-xl px-4 py-3 h-auto data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary text-slate-600 hover:bg-card/50 hover:text-foreground transition-all font-bold data-[state=active]:ring-1 data-[state=active]:ring-border group"
                >
                  <div className="p-1.5 rounded-lg bg-muted text-muted-foreground group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary mr-3 transition-colors">
                    <Users className="h-4 w-4" />
                  </div>
                  {t("tabs.users")}
                </TabsTrigger>
                <TabsTrigger
                  value="bot"
                  className="w-full justify-start rounded-xl px-4 py-3 h-auto data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary text-slate-600 hover:bg-card/50 hover:text-foreground transition-all font-bold data-[state=active]:ring-1 data-[state=active]:ring-border group"
                >
                  <div className="p-1.5 rounded-lg bg-muted text-muted-foreground group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary mr-3 transition-colors">
                    <Bot className="h-4 w-4" />
                  </div>
                  {t("tabs.bot")}
                </TabsTrigger>
              </TabsList>
            </Card>
          </div>

          {/* 右侧内容 */}
          <div className="col-span-9 min-w-0">
            <TabsContent value="basic" className="space-y-6 mt-0 animate-in fade-in-50 duration-300">
              <Card className="border-slate-200/60 shadow-sm overflow-hidden">
                <CardHeader className="border-b border-border/40 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600 border border-blue-100">
                      <Settings className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold">{tf("basicConfig")}</CardTitle>
                      <CardDescription>
                        {tf("basicConfigDesc")}
                      </CardDescription>
                    </div>
                  </div>
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
                      <p className="text-[10px] text-slate-400 text-center">{tf("iconHint")}</p>
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
                              placeholder={tf("siteSlugPlaceholder")}
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
                          placeholder={tf("siteDescriptionPlaceholder")}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-slate-200/60 shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-border/40 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-50 rounded-lg text-purple-600 border border-purple-100">
                        <Palette className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold">{tf("styleConfig")}</CardTitle>
                        <CardDescription>{tf("styleConfigDesc")}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">{tf("themeColor")}</label>
                      <div className="flex gap-2">
                        {THEME_COLORS.map((color) => (
                          <div
                            key={color.value}
                            className={`w-8 h-8 rounded-full ${color.className} cursor-pointer ring-offset-2 transition-all ${themeColor === color.value ? 'ring-2 ring-primary ring-offset-2' : 'hover:ring-2 ring-slate-300'
                              }`}
                            onClick={() => setThemeColor(color.value)}
                            title={color.label}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">{tf("layoutMode")}</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div
                          className={`border rounded-xl p-3 text-center text-xs font-bold cursor-pointer transition-all ${layoutMode === 'sidebar'
                            ? 'border-primary bg-primary/5 text-primary shadow-sm'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                            }`}
                          onClick={() => setLayoutMode('sidebar')}
                        >
                          {tf("layoutSidebar")}
                        </div>
                        <div
                          className="border border-slate-200 rounded-xl p-3 text-center text-xs font-bold text-slate-400 bg-slate-50/50 cursor-not-allowed opacity-50"
                          title={tf("layoutTopNavUnsupported")}
                        >
                          {tf("layoutTopNav")}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200/60 shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-border/40 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold">{tf("accessControl")}</CardTitle>
                        <CardDescription>{tf("accessControlDesc")}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    <div className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                      <div className="space-y-0.5">
                        <label className="text-sm font-semibold text-slate-900">{tf("enableSite")}</label>
                        <p className="text-xs text-slate-500">{tf("enableSiteHint")}</p>
                      </div>
                      <div
                        className={`w-11 h-6 ${isActive ? 'bg-primary' : 'bg-slate-200'} rounded-full relative cursor-pointer transition-colors`}
                        onClick={() => setIsActive(!isActive)}
                      >
                        <div className={`absolute ${isActive ? 'right-1' : 'left-1'} top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all`} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                      <div className="space-y-0.5">
                        <label className="text-sm font-semibold text-slate-900">{tf("publicSite") || "公开访问"}</label>
                        <p className="text-xs text-slate-500">{tf("publicSiteHint") || "关闭后需输入密码才能访问站点"}</p>
                      </div>
                      <div
                        className={`w-11 h-6 ${isPublic ? 'bg-primary' : 'bg-slate-200'} rounded-full relative cursor-pointer transition-colors`}
                        onClick={() => setIsPublic(!isPublic)}
                      >
                        <div className={`absolute ${isPublic ? 'right-1' : 'left-1'} top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all`} />
                      </div>
                    </div>

                    {!isPublic && (
                      <div className="space-y-2 p-3 bg-orange-50/30 border border-orange-100 rounded-xl animate-in slide-in-from-top-1 duration-200">
                        <label className="text-sm font-semibold text-slate-700">{tf("sitePassword") || "访问密码"}</label>
                        <Input
                          type="password"
                          placeholder={hasPassword ? "****** (已设置，输入新密码可修改)" : "输入站点访问密码"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="bg-white rounded-xl"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="questions" className="space-y-6 mt-0 animate-in fade-in-50 duration-300">
              <QuickQuestionsConfig
                questions={quickQuestions}
                onChange={setQuickQuestions}
              />
            </TabsContent>


            <TabsContent value="users" className="space-y-6 mt-0 animate-in fade-in-50 duration-300">
              <SiteUsers siteId={siteId} siteName={name} />
            </TabsContent>

            <TabsContent value="bot" className="space-y-6 mt-0 animate-in fade-in-50 duration-300">
              <SiteBotSettings
                siteId={siteId}
                config={botConfig}
                onChange={handleBotConfigChange}
              />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  )
}
