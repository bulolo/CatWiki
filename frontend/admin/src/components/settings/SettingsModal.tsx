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

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useTranslations } from "next-intl"
import { SettingsProvider, useSettings } from "@/contexts/SettingsContext"
import { ModelSettingsCard, ModelDetailCard } from "@/components/settings/models"
import { GlobalUsers } from "@/components/settings/users"
import { GlobalSites, SiteSettings } from "@/components/settings/sites"
import { DocProcessorSettings } from "./doc-processor/DocProcessorSettings"
import { DataSourcesPage } from "@/components/features/data-sources/DataSourcesPage"
import { type SettingsTabId } from "@/types/settings"
import {
  Settings,
  Globe,
  Users,
  Save,
  X,
  ChevronLeft,
  FileText,
  Database
} from "lucide-react"
import { getUserInfo } from "@/lib/auth"
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui"
import { cn } from "@/lib/utils"

function SettingsContent() {
  const t = useTranslations("Settings")
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { isAiDirty, handleSave, revertToSavedConfig } = useSettings()

  // State
  const [activeTab, setActiveTab] = useState("general")
  const [selectedModel, setSelectedModel] = useState<SettingsTabId | null>(null)
  const isSiteSettings = searchParams.get("modal") === "site-settings"
  const siteId = searchParams.get("siteId")

  // Check user role
  const [isAdmin, setIsAdmin] = useState(false)
  const [isTenantAdmin, setIsTenantAdmin] = useState(false)
  const [isSiteAdmin, setIsSiteAdmin] = useState(false)

  useEffect(() => {
    const checkRole = async () => {
      const user = await getUserInfo()
      if (user) {
        setIsAdmin(user.role === "admin" as const)
        setIsTenantAdmin(user.role === "tenant_admin" as const)
        // Check if user is site admin for current site if in site settings mode
        if (siteId) {
          // This would typically involve checking site permissions
          // For now assuming if they can access site settings they have permission
          setIsSiteAdmin(true)
        }
      }
    }
    checkRole()
  }, [siteId])

  // Sync tab with URL
  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab) {
      if (tab === "sites" && !isSiteAdmin) {
        // Redirect non-admins away from sites if needed
      }
      setActiveTab(tab)
    } else {
      // Default to sites if no tab specified
      setActiveTab("sites")
    }
  }, [searchParams, isSiteAdmin])

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    // Optional: Update URL to persist tab selection without navigation
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", value)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleClose = () => {
    // Remove 'modal' param to close
    const params = new URLSearchParams(searchParams.toString())
    params.delete("modal")
    params.delete("tab") // Clean up tab param too
    router.replace(`${pathname}?${params.toString()}`)
  }

  const handleSelectModel = (model: SettingsTabId) => {
    if (model === "chat" || model === "embedding" || model === "rerank") {
      setSelectedModel(model)
    }
  }

  const handleBackToModels = useCallback(() => {
    if (selectedModel === "chat" || selectedModel === "embedding" || selectedModel === "rerank") {
      revertToSavedConfig(selectedModel)
    }
    setSelectedModel(null)
  }, [selectedModel, revertToSavedConfig])

  // Auto-revert models when switching to other tabs
  useEffect(() => {
    if (activeTab !== "models" && selectedModel) {
      handleBackToModels()
    }
  }, [activeTab, selectedModel, handleBackToModels])

  const handleBackToGlobal = () => {
    // If coming from global settings, go back to global list
    const params = new URLSearchParams(searchParams.toString())
    params.delete("siteId")
    params.set("modal", "settings")
    params.set("tab", "sites")
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl shadow-xl w-[1240px] h-[820px] max-w-[95vw] max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Window Header */}
        <div className="h-14 px-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-4">
            {isSiteSettings && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackToGlobal}
                className="h-8 w-8 rounded-full hover:bg-slate-100 -ml-2 transition-colors"
                title={t("backToList")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Settings className="h-4 w-4 text-slate-600" />
              </div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                {isSiteSettings ? t("siteSettings") : t("systemSettings")}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* 仅在非模型配置 Tab 显示保存按钮 (因为模型配置现在有独立的保存逻辑) */}
            {isAiDirty && activeTab !== "models" && (
              <Button
                size="sm"
                onClick={() => handleSave()}
                className="flex items-center gap-2 h-9 px-4 animate-in fade-in zoom-in duration-300"
              >
                <Save className="h-4 w-4" />
                {t("saveConfig")}
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
          <div className="flex-1 overflow-hidden p-6 bg-slate-50/50 animate-in fade-in slide-in-from-right-4 duration-300">
            <SiteSettings siteId={Number(siteId)} />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={handleTabChange} orientation="vertical" className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <TabsList className="w-64 h-full bg-slate-50/50 border-r border-slate-100 flex-col items-stretch justify-start p-4 space-y-1">
              <TabsTrigger
                value="sites"
                className={cn(
                  "w-full justify-start px-3 py-2.5 h-auto text-sm font-medium rounded-lg transition-all",
                  "data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-slate-200",
                  "hover:bg-white/60 hover:text-slate-900 text-slate-500"
                )}
              >
                <Globe className="h-4 w-4 mr-3 opacity-70" />
                {t("sites")}
              </TabsTrigger>

              {(isAdmin || isTenantAdmin) && (
                <TabsTrigger
                  value="users"
                  className={cn(
                    "w-full justify-start px-3 py-2.5 h-auto text-sm font-medium rounded-lg transition-all",
                    "data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-slate-200",
                    "hover:bg-white/60 hover:text-slate-900 text-slate-500"
                  )}
                >
                  <Users className="h-4 w-4 mr-3 opacity-70" />
                  {t("users")}
                </TabsTrigger>
              )}

              {(isAdmin || isTenantAdmin) && (
                <TabsTrigger
                  value="models"
                  className={cn(
                    "w-full justify-start px-3 py-2.5 h-auto text-sm font-medium rounded-lg transition-all",
                    "data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-slate-200",
                    "hover:bg-white/60 hover:text-slate-900 text-slate-500"
                  )}
                >
                  <Settings className="h-4 w-4 mr-3 opacity-70" />
                  {t("models")}
                </TabsTrigger>
              )}

              {(isAdmin || isTenantAdmin) && (
                <TabsTrigger
                  value="doc-processor"
                  className={cn(
                    "w-full justify-start px-3 py-2.5 h-auto text-sm font-medium rounded-lg transition-all",
                    "data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-slate-200",
                    "hover:bg-white/60 hover:text-slate-900 text-slate-500"
                  )}
                >
                  <FileText className="h-4 w-4 mr-3 opacity-70" />
                  {t("docProcessor")}
                </TabsTrigger>
              )}

              {(isAdmin || isTenantAdmin) && (
                <TabsTrigger
                  value="data-sources"
                  className={cn(
                    "w-full justify-start px-3 py-2.5 h-auto text-sm font-medium rounded-lg transition-all",
                    "data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-slate-200",
                    "hover:bg-white/60 hover:text-slate-900 text-slate-500"
                  )}
                >
                  <Database className="h-4 w-4 mr-3 opacity-70" />
                  {t("dataSources")}
                </TabsTrigger>
              )}
            </TabsList>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-white relative">
              <div className="w-full h-full p-8">
                <TabsContent value="sites" className="mt-0 h-full space-y-6 outline-none">
                  <GlobalSites />
                </TabsContent>

                <TabsContent value="users" className="mt-0 h-full space-y-6 outline-none">
                  <GlobalUsers />
                </TabsContent>

                <TabsContent value="models" className="mt-0 h-full space-y-6 outline-none">
                  {selectedModel && (selectedModel === "chat" || selectedModel === "embedding" || selectedModel === "rerank") ? (
                    <div key="detail" className="animate-in fade-in slide-in-from-right-4 duration-300">
                      <ModelDetailCard
                        modelType={selectedModel}
                        onBack={handleBackToModels}
                      />
                    </div>
                  ) : (
                    <div key="list" className="animate-in fade-in slide-in-from-left-4 duration-300">
                      <ModelSettingsCard
                        onSelectModel={handleSelectModel}
                        activeTab="models"
                      />
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="doc-processor" className="mt-0 h-full space-y-6 outline-none">
                  <DocProcessorSettings />
                </TabsContent>

                <TabsContent value="data-sources" className="mt-0 h-full space-y-6 outline-none">
                  <DataSourcesPage />
                </TabsContent>
              </div>
            </div>
          </Tabs>
        )}
      </div>
    </div>
  )
}

export function SettingsModal() {
  return (
    <SettingsProvider>
      <SettingsContent />
    </SettingsProvider>
  )
}
