"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { SettingsProvider, useSettings } from "@/contexts/SettingsContext"
import { ModelSettingsCard } from "@/components/settings/ModelSettingsCard"
import { ModelDetailCard } from "@/components/settings/ModelDetailCard"
import { GlobalUsers } from "@/components/settings/GlobalUsers"
import { GlobalSites } from "@/components/settings/GlobalSites"
import { type ModelType } from "@/types/settings"
import {
  Settings,
  Globe,
  Users,
  Save,
  Loader2,
  X,
  ChevronLeft
} from "lucide-react"
import { getUserInfo } from "@/lib/auth"
import { UserRole } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { SiteSettings } from "./SiteSettings"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function SettingsModal() {
  return (
    <SettingsProvider>
      <SettingsContent />
    </SettingsProvider>
  )
}

function SettingsContent() {
  const { isAiDirty, handleSave } = useSettings()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("models")
  const [selectedModel, setSelectedModel] = useState<"chat" | "embedding" | "rerank" | "vl" | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const userInfo = mounted ? getUserInfo() : null
  const isAdmin = userInfo?.role === UserRole.ADMIN
  const isSiteAdmin = userInfo?.role === UserRole.SITE_ADMIN
  const canAccessSettings = isAdmin || isSiteAdmin

  // Determine Context
  const context = searchParams.get("context")
  const siteId = searchParams.get("siteId")
  const isSiteSettings = context === "site" && siteId

  // Handle Tab State (Internal or optional query param)
  useEffect(() => {
    // Optional: allow deep linking to specific settings tab via separate param, e.g. ?settingsTab=
    const tab = searchParams.get("settingsTab")
    if (tab) {
      setActiveTab(tab)
    } else if (isSiteAdmin) {
      // For Site Admins, default to sites tab
      setActiveTab("sites")
    }
  }, [searchParams, isSiteAdmin])

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    // Optional: Update URL to persist tab selection without navigation
    const params = new URLSearchParams(searchParams.toString())
    params.set("settingsTab", value)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleClose = () => {
    // Remove 'modal' param to close
    const params = new URLSearchParams(searchParams.toString())
    params.delete("modal")
    params.delete("settingsTab") // Clean up tab param too
    router.replace(`${pathname}?${params.toString()}`)
  }

  const handleSelectModel = (model: ModelType) => {
    if (model === "chat" || model === "embedding" || model === "rerank" || model === "vl") {
      setSelectedModel(model)
    }
  }

  const handleBackToModels = () => {
    setSelectedModel(null)
  }

  const handleBackToGlobal = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("context")
    params.delete("siteId")
    // Return to sites tab
    params.set("settingsTab", "sites")
    router.replace(`${pathname}?${params.toString()}`)
  }

  if (!mounted) return null
  if (!canAccessSettings) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-300">
      {/* Central Window Container */}
      <div className="w-full max-w-6xl h-[85vh] min-h-[600px] bg-white rounded-2xl shadow-2xl shadow-black/20 border border-slate-200/60 overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 zoom-in-95 duration-500">

        {/* Window Header (Inside Card) */}
        <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6 shrink-0 bg-white">
          <div className="flex items-center gap-3">
            {isSiteSettings ? (
              <Button variant="ghost" size="icon" onClick={handleBackToGlobal} className="h-8 w-8 rounded-lg -ml-2 text-slate-500 hover:text-slate-900">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            ) : (
              <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                <Settings className="h-5 w-5" />
              </div>
            )}
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                {isSiteSettings ? "站点设置" : "平台设置"}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* 仅在非模型配置 Tab 显示保存按钮 (因为模型配置现在有独立的保存逻辑) */}
            {isAiDirty && activeTab !== "models" && (
              <Button
                onClick={() => handleSave()}
                className="flex items-center gap-2 h-8 px-4 text-xs rounded-full shadow-sm animate-in fade-in zoom-in duration-300"
              >
                <Save className="h-3 w-3" />
                保存配置
              </Button>
            )}

            <div className="h-4 w-px bg-slate-200 mx-1" />

            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-colors"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Window Body: Context Switch */}
        {isSiteSettings ? (
          <div className="flex-1 overflow-hidden p-6 bg-slate-50/50">
            <SiteSettings siteId={Number(siteId)} />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={handleTabChange} orientation="vertical" className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <TabsList className="w-64 h-full bg-slate-50/50 border-r border-slate-100 flex-col items-stretch justify-start p-4 space-y-1">
              {isAdmin && (
                <TabsTrigger
                  value="models"
                  className={cn(
                    "w-full justify-start px-3 py-2.5 h-auto text-sm font-medium rounded-lg transition-all",
                    "data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-slate-200",
                    "hover:bg-white/60 hover:text-slate-900 text-slate-500"
                  )}
                >
                  <Settings className="h-4 w-4 mr-3 opacity-70" />
                  模型配置
                </TabsTrigger>
              )}

              <TabsTrigger
                value="sites"
                className={cn(
                  "w-full justify-start px-3 py-2.5 h-auto text-sm font-medium rounded-lg transition-all",
                  "data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-slate-200",
                  "hover:bg-white/60 hover:text-slate-900 text-slate-500"
                )}
              >
                <Globe className="h-4 w-4 mr-3 opacity-70" />
                站点管理
              </TabsTrigger>

              {isAdmin && (
                <TabsTrigger
                  value="users"
                  className={cn(
                    "w-full justify-start px-3 py-2.5 h-auto text-sm font-medium rounded-lg transition-all",
                    "data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-slate-200",
                    "hover:bg-white/60 hover:text-slate-900 text-slate-500"
                  )}
                >
                  <Users className="h-4 w-4 mr-3 opacity-70" />
                  用户权限
                </TabsTrigger>
              )}
            </TabsList>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-white relative">
              <div className="max-w-4xl mx-auto p-8 h-full">
                <TabsContent value="models" className="mt-0 h-full space-y-6 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {selectedModel ? (
                    <ModelDetailCard
                      modelType={selectedModel}
                      onBack={handleBackToModels}
                    />
                  ) : (
                    <ModelSettingsCard
                      onSelectModel={handleSelectModel}
                      activeTab="models"
                    />
                  )}
                </TabsContent>

                <TabsContent value="sites" className="mt-0 h-full space-y-6 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <GlobalSites />
                </TabsContent>

                <TabsContent value="users" className="mt-0 h-full space-y-6 outline-none animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <GlobalUsers />
                </TabsContent>
              </div>
            </div>
          </Tabs>
        )}
      </div>
    </div>
  )
}
