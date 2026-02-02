"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Settings,
  Palette,
  ShieldCheck,
  MessageSquare,
  Bot,
  Users,
  Save,
  History
} from "lucide-react"
import { toast } from "sonner"
import { useSiteById, useUpdateSite } from "@/hooks"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { QuickQuestionsConfig } from "@/components/features/QuickQuestionsConfig"
import type { QuickQuestion } from "@/lib/api-client"
import { SiteBotSettings } from "@/components/sites/SiteBotSettings"
import { SiteUsers } from "@/components/sites/SiteUsers"
import { SiteChatHistory } from "@/components/sites/SiteChatHistory"
import { initialConfigs } from "@/types/settings"
import { env } from "@/lib/env"

// 主题色配置
const THEME_COLORS = [
  { value: 'blue', label: '蓝色', className: 'bg-blue-500' },
  { value: 'emerald', label: '绿色', className: 'bg-emerald-500' },
  { value: 'purple', label: '紫色', className: 'bg-purple-500' },
  { value: 'orange', label: '橙色', className: 'bg-orange-500' },
  { value: 'slate', label: '灰色', className: 'bg-slate-800' },
] as const

interface SiteSettingsProps {
  siteId: number
  onBack?: () => void
}

export function SiteSettings({ siteId, onBack }: SiteSettingsProps) {
  const router = useRouter()

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [isActive, setIsActive] = useState(true)
  const [themeColor, setThemeColor] = useState<string>("blue")
  const [layoutMode, setLayoutMode] = useState<string>("sidebar")
  const [quickQuestions, setQuickQuestions] = useState<QuickQuestion[]>([])
  const [botConfig, setBotConfig] = useState(initialConfigs.botConfig)
  const [mounted, setMounted] = useState(false)

  const initialDataRef = useRef<any>(null)

  // 确保水合一致性
  useEffect(() => {
    setMounted(true)
  }, [])

  // 使用 React Query hooks
  const { data: siteData, isLoading: loading } = useSiteById(siteId)
  const updateSiteMutation = useUpdateSite()

  // 加载站点数据
  useEffect(() => {
    if (siteData && !initialDataRef.current) {
      const bConfig = siteData.bot_config ? {
        ...initialConfigs.botConfig,
        ...siteData.bot_config,
        webWidget: { ...initialConfigs.botConfig.webWidget, ...siteData.bot_config.webWidget },
        apiBot: { ...initialConfigs.botConfig.apiBot, ...siteData.bot_config.apiBot },
        wechat: { ...initialConfigs.botConfig.wechat, ...siteData.bot_config.wechat },
      } : initialConfigs.botConfig

      setName(siteData.name)
      setSlug(siteData.domain || "")
      setDescription(siteData.description || "")
      setIsActive(siteData.status === "active")
      setThemeColor(siteData.theme_color || "blue")
      setLayoutMode(siteData.layout_mode || "sidebar")
      setQuickQuestions(siteData.quick_questions || [])
      setBotConfig(bConfig)

      initialDataRef.current = {
        name: siteData.name,
        slug: siteData.domain || "",
        description: siteData.description || "",
        isActive: siteData.status === "active",
        themeColor: siteData.theme_color || "blue",
        layoutMode: siteData.layout_mode || "sidebar",
        quickQuestions: siteData.quick_questions || [],
        botConfig: bConfig
      }
    }
  }, [siteData])

  const isDirty = initialDataRef.current && JSON.stringify({
    name,
    slug,
    description,
    isActive,
    themeColor,
    layoutMode,
    quickQuestions: quickQuestions.filter(q => q.text.trim()),
    botConfig
  }) !== JSON.stringify(initialDataRef.current)

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("请输入站点名称")
      return
    }
    if (!slug.trim()) {
      toast.error("请输入站点唯一标识")
      return
    }

    const cleanedQuestions = quickQuestions.filter(q => q.text.trim())

    updateSiteMutation.mutate({
      siteId,
      data: {
        name: name.trim(),
        domain: slug.trim() || undefined,
        description: description.trim() || undefined,
        status: isActive ? "active" : "disabled",
        theme_color: themeColor,
        layout_mode: layoutMode,
        quick_questions: cleanedQuestions.length > 0 ? cleanedQuestions : null,
        bot_config: botConfig
      }
    }, {
      onSuccess: () => {
        initialDataRef.current = {
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim(),
          isActive,
          themeColor,
          layoutMode,
          quickQuestions: cleanedQuestions,
          botConfig
        }
        toast.success("站点配置已保存")
      }
    })
  }

  const handleBotConfigChange = (section: string, field: string, value: any) => {
    setBotConfig((prev: any) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }))
  }

  if (!mounted || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-500 flex items-center gap-2">
          <div className="h-4 w-4 bg-slate-200 animate-pulse rounded-full" />
          加载站点配置...
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Actions Bar - Replaces the Page Header */}
      <div className="flex items-center justify-between px-1 pb-4 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{name} 设置</h2>
          <p className="text-xs text-slate-500">管理该站点的基础信息、界面风格及 AI 机器人配置。</p>
        </div>

        {isDirty && (
          <Button
            onClick={handleSave}
            disabled={updateSiteMutation.isPending}
            size="sm"
            className="flex items-center gap-2 h-9 px-4 rounded-xl shadow-lg shadow-primary/20 animate-in fade-in zoom-in duration-300"
          >
            <Save className="h-4 w-4" />
            {updateSiteMutation.isPending ? "保存中..." : "保存修改"}
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
                基础配置
              </TabsTrigger>
              <TabsTrigger
                value="questions"
                className="w-full justify-start rounded-lg px-3 py-2.5 h-auto data-[state=active]:bg-primary/5 data-[state=active]:text-primary text-slate-600 hover:bg-slate-100/80 transition-all font-medium group"
              >
                <MessageSquare className="h-4 w-4 mr-2.5 opacity-70 group-data-[state=active]:opacity-100" />
                快速问题
              </TabsTrigger>
              <TabsTrigger
                value="users"
                className="w-full justify-start rounded-lg px-3 py-2.5 h-auto data-[state=active]:bg-primary/5 data-[state=active]:text-primary text-slate-600 hover:bg-slate-100/80 transition-all font-medium group"
              >
                <Users className="h-4 w-4 mr-2.5 opacity-70 group-data-[state=active]:opacity-100" />
                用户权限
              </TabsTrigger>
              <TabsTrigger
                value="bot"
                className="w-full justify-start rounded-lg px-3 py-2.5 h-auto data-[state=active]:bg-primary/5 data-[state=active]:text-primary text-slate-600 hover:bg-slate-100/80 transition-all font-medium group"
              >
                <Bot className="h-4 w-4 mr-2.5 opacity-70 group-data-[state=active]:opacity-100" />
                AI 机器人
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="w-full justify-start rounded-lg px-3 py-2.5 h-auto data-[state=active]:bg-primary/5 data-[state=active]:text-primary text-slate-600 hover:bg-slate-100/80 transition-all font-medium group"
              >
                <History className="h-4 w-4 mr-2.5 opacity-70 group-data-[state=active]:opacity-100" />
                历史会话
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 右侧内容 - Scrollable Area */}
          <div className="flex-1 overflow-y-auto pr-2 pb-10">
            <TabsContent value="basic" className="space-y-6 mt-0 animate-in fade-in-50 duration-300 data-[state=inactive]:hidden">
              <Card className="border-slate-200/60 shadow-none rounded-xl overflow-hidden">
                <CardHeader className="border-b border-slate-50 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600 border border-blue-100">
                      <Settings className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold">基本配置</CardTitle>
                      <CardDescription className="text-xs">
                        设置站点的名称、唯一标识等核心信息。
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">站点名称</label>
                      <input
                        className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
                        placeholder="例如：catWiki"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">站点唯一标识</label>
                      <div className="flex items-center">
                        <span
                          className="inline-flex items-center px-3 h-9 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 text-slate-500 text-[10px] font-mono flex-1 min-w-0 overflow-hidden"
                          title={env.NEXT_PUBLIC_CLIENT_URL}
                        >
                          <span className="truncate">{env.NEXT_PUBLIC_CLIENT_URL}</span>/
                        </span>
                        <input
                          className="flex h-9 w-[35%] min-w-[80px] rounded-r-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
                          placeholder="cat"
                          value={slug}
                          onChange={(e) => setSlug(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">站点描述</label>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 resize-none"
                      placeholder="简要介绍这个 Wiki 站点的主要内容..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-slate-200/60 shadow-none rounded-xl overflow-hidden">
                  <CardHeader className="border-b border-slate-50 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-50 rounded-lg text-purple-600 border border-purple-100">
                        <Palette className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold">界面与风格</CardTitle>
                        <CardDescription className="text-xs">自定义站点的视觉外观。</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">主题色</label>
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
                      <label className="text-sm font-semibold text-slate-700">布局模式</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div
                          className={`border rounded-xl p-3 text-center text-xs font-bold cursor-pointer transition-all ${layoutMode === 'sidebar'
                            ? 'border-primary bg-primary/5 text-primary shadow-sm'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                            }`}
                          onClick={() => setLayoutMode('sidebar')}
                        >
                          侧边栏目录
                        </div>
                        <div
                          className="border border-slate-200 rounded-xl p-3 text-center text-xs font-bold text-slate-400 bg-slate-50/50 cursor-not-allowed opacity-50"
                          title="暂不支持顶部导航"
                        >
                          顶部导航
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200/60 shadow-none rounded-xl overflow-hidden">
                  <CardHeader className="border-b border-slate-50 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold">访问控制</CardTitle>
                        <CardDescription className="text-xs">管理站点的开放状态。</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    <div className="flex items-center justify-between p-3 bg-slate-50/50 border border-slate-100 rounded-xl">
                      <div className="space-y-0.5">
                        <label className="text-sm font-semibold text-slate-900">启用站点</label>
                        <p className="text-xs text-slate-500">启用后站点将可以正常访问。</p>
                      </div>
                      <div
                        className={`w-11 h-6 ${isActive ? 'bg-primary' : 'bg-slate-200'} rounded-full relative cursor-pointer transition-colors`}
                        onClick={() => setIsActive(!isActive)}
                      >
                        <div className={`absolute ${isActive ? 'right-1' : 'left-1'} top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all`} />
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
              />
            </TabsContent>

            <TabsContent value="history" className="space-y-6 mt-0 animate-in fade-in-50 duration-300 data-[state=inactive]:hidden h-full">
              <SiteChatHistory siteId={siteId} siteName={name} />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  )
}
