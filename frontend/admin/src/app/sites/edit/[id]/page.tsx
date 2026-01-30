"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  ChevronLeft,
  Save,
  Settings,
  Palette,
  ShieldCheck,
  MessageSquare,
  Bot,
  Users
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

export default function EditSitePage() {
  const router = useRouter()
  const params = useParams()
  const siteId = parseInt(params.id as string)

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

  const handleBack = () => {
    router.back()
  }

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
      <div className="flex items-center justify-center h-96">
        <div className="text-slate-500">加载中...</div>
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
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">编辑站点</h1>
            <p className="text-slate-500 text-sm">管理该站点的基础信息、界面风格及 AI 机器人配置。</p>
          </div>
        </div>
        {isDirty && (
          <Button
            onClick={handleSave}
            disabled={updateSiteMutation.isPending}
            className="flex items-center gap-2 h-11 px-8 rounded-xl shadow-lg animate-in fade-in zoom-in duration-300"
          >
            <Save className="h-4 w-4" />
            {updateSiteMutation.isPending ? "保存中..." : "保存当前修改"}
          </Button>
        )}
      </div>

      <Tabs defaultValue="basic" className="space-y-0">
        <div className="grid grid-cols-12 gap-8 items-start">
          {/* 左侧导航 */}
          <div className="col-span-3">
            <Card className="border-slate-200/60 shadow-sm bg-muted/30 rounded-2xl overflow-hidden p-2">
              <TabsList className="grid grid-cols-1 h-auto bg-transparent gap-1 p-0">
                <TabsTrigger
                  value="basic"
                  className="w-full justify-start rounded-xl px-4 py-3 h-auto data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary text-slate-600 hover:bg-card/50 hover:text-foreground transition-all font-bold group"
                >
                  <div className="p-1.5 rounded-lg bg-muted text-muted-foreground group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary mr-3 transition-colors">
                    <Settings className="h-4 w-4" />
                  </div>
                  基础配置
                </TabsTrigger>
                <TabsTrigger
                  value="questions"
                  className="w-full justify-start rounded-xl px-4 py-3 h-auto data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary text-slate-600 hover:bg-card/50 hover:text-foreground transition-all font-bold data-[state=active]:ring-1 data-[state=active]:ring-border group"
                >
                  <div className="p-1.5 rounded-lg bg-muted text-muted-foreground group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary mr-3 transition-colors">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  快速问题
                </TabsTrigger>
                <TabsTrigger
                  value="users"
                  className="w-full justify-start rounded-xl px-4 py-3 h-auto data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary text-slate-600 hover:bg-card/50 hover:text-foreground transition-all font-bold data-[state=active]:ring-1 data-[state=active]:ring-border group"
                >
                  <div className="p-1.5 rounded-lg bg-muted text-muted-foreground group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary mr-3 transition-colors">
                    <Users className="h-4 w-4" />
                  </div>
                  用户权限
                </TabsTrigger>
                <TabsTrigger
                  value="bot"
                  className="w-full justify-start rounded-xl px-4 py-3 h-auto data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-primary text-slate-600 hover:bg-card/50 hover:text-foreground transition-all font-bold data-[state=active]:ring-1 data-[state=active]:ring-border group"
                >
                  <div className="p-1.5 rounded-lg bg-muted text-muted-foreground group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary mr-3 transition-colors">
                    <Bot className="h-4 w-4" />
                  </div>
                  AI 机器人
                </TabsTrigger>
              </TabsList>
            </Card>
          </div>

          {/* 右侧内容 */}
          <div className="col-span-9 min-w-0">
            <TabsContent value="basic" className="space-y-6 mt-0 animate-in fade-in-50 duration-300">
              <Card className="border-slate-200/60 shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="border-b border-slate-50 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600 border border-blue-100">
                      <Settings className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-xl font-bold">基本配置</CardTitle>
                      <CardDescription>
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
                        className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
                        placeholder="例如：catWiki"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">站点唯一标识</label>
                      <div className="flex items-center">
                        <span className="inline-flex items-center px-3 h-10 rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 text-slate-500 text-sm font-mono">
                          {env.NEXT_PUBLIC_CLIENT_URL}/
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
                    <label className="text-sm font-semibold text-slate-700">站点描述</label>
                    <textarea
                      className="flex min-h-[100px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
                      placeholder="简要介绍这个 Wiki 站点的主要内容..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-slate-200/60 shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="border-b border-slate-50 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-50 rounded-lg text-purple-600 border border-purple-100">
                        <Palette className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold">界面与风格</CardTitle>
                        <CardDescription>自定义站点的视觉外观。</CardDescription>
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

                <Card className="border-slate-200/60 shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="border-b border-slate-50 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-bold">访问控制</CardTitle>
                        <CardDescription>管理站点的开放状态。</CardDescription>
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
