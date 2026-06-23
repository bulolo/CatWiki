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
import { useTranslations } from "next-intl"
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui"
import { Settings, MessageSquare, Bot, Users, Save, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useSiteById, useUpdateSite, useHealth } from "@/hooks"
import { QuickQuestionsConfig } from "@/components/features"
import type { QuickQuestion } from "@/lib/sdk/sdk.schemas"
import { SiteBotSettings, SiteUsers } from "@/components/sites"
import { initialConfigs, type BotConfig } from "@/types/settings"
import { env } from "@/lib/env"
import { mergeSiteBotConfig } from "@/lib/site-bot-config"
import { useAIConfig } from "@/hooks"
import { getEeApi } from "@/ee/api"
import { SiteBasicInfoCard } from "./SiteBasicInfoCard"
import { SiteStyleCard } from "./SiteStyleCard"
import { SiteAccessCard } from "./SiteAccessCard"

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

export function SiteSettings({ siteId, onBack: _onBack }: SiteSettingsProps) {
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

  // 初始快照（用于脏检查）。用 state 而非 ref，以便在 render 期合法读取（满足 react-hooks/refs）。
  const [initialData, setInitialData] = useState<SiteSettingsSnapshot | null>(null)

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
    if (siteData && !initialData) {
      const bConfig = mergeSiteBotConfig(siteData.bot_config)

      // 从 EE API 加载全量 EE 配置（访问控制 + 机器人）
      const ee = getEeApi()
      if (ee) {
        ee.sites.getConfig(siteId).then((eeConfig) => {
          if (!eeConfig) return
          // 1. 同步机器人配置
          bConfig.api_bot = {
            enabled: eeConfig.api_bot.enabled,
            api_key: eeConfig.api_bot.api_key,
            timeout: eeConfig.api_bot.timeout,
          }
          setBotConfig({ ...bConfig })

          // 2. 同步访问控制状态
          setEeIsPublic(eeConfig.access.is_public ?? false)
          setEeHasPassword(eeConfig.access.has_password ?? false)

          setInitialData(prev => (prev ? { ...prev, botConfig: { ...bConfig } } : prev))
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

      setInitialData({
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
      })
    }
  }, [siteData, siteId, initialData])

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
      const ee = getEeApi()
      if (!ee) return

      const config = await ee.sites.updateConfig(siteId, {
        access: {
          is_public: updates.is_public,
          password: updates.password || undefined
        }
      })
      if (!config) return
      setEeIsPublic(config.access.is_public ?? false)
      setEeHasPassword(config.access.has_password ?? false)
      setEeNewPassword("")
      if (config.access.generated_password) {
        toast.success(t("accessPasswordGenerated", { password: config.access.generated_password }), { duration: 10000 })
      } else {
        toast.success(t("saveSuccess"))
      }
    } catch (e: unknown) {
      toast.error((e instanceof Error && e.message) || t("saveError"))
    }
  }

  // EE: 公开开关切换（仅企业版可点；切换后立即保存）
  const handleTogglePublic = () => {
    if (!isEnterprise) return
    const next = !eeIsPublic
    setEeIsPublic(next)
    handleSaveAccessConfig({ is_public: next })
  }

  // EE: 保存新访问密码
  const handleSavePassword = () => handleSaveAccessConfig({ password: eeNewPassword })

  const isDirty = initialData && JSON.stringify({
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
  }) !== JSON.stringify(initialData)

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

    const ee = getEeApi()
    const saveEE = ee ? ee.sites.updateConfig(siteId, {
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

      setInitialData({
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
      })
      toast.success(t("saveSuccess"))
    }).catch(() => {
      toast.error(t("saveError"))
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
              <SiteBasicInfoCard
                icon={icon}
                setIcon={setIcon}
                name={name}
                setName={setName}
                slug={slug}
                setSlug={setSlug}
                description={description}
                setDescription={setDescription}
                siteUrlPrefix={siteUrlPrefix}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SiteStyleCard
                  themeColor={themeColor}
                  setThemeColor={setThemeColor}
                  layoutMode={layoutMode}
                  setLayoutMode={setLayoutMode}
                />

                <SiteAccessCard
                  isActive={isActive}
                  onToggleActive={handleToggleActive}
                  isEnterprise={isEnterprise}
                  eeIsPublic={eeIsPublic}
                  onTogglePublic={handleTogglePublic}
                  eeHasPassword={eeHasPassword}
                  eeNewPassword={eeNewPassword}
                  setEeNewPassword={setEeNewPassword}
                  eeShowPassword={eeShowPassword}
                  setEeShowPassword={setEeShowPassword}
                  onSavePassword={handleSavePassword}
                  showStats={showStats}
                  setShowStats={setShowStats}
                />
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
