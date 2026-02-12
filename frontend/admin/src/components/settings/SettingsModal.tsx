// Copyright 2024 CatWiki Authors
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
import { SettingsProvider, useSettings } from "@/contexts/SettingsContext"
import { ModelSettingsCard } from "@/components/settings/models/ModelSettingsCard"
import { ModelDetailCard } from "@/components/settings/models/ModelDetailCard"
import { GlobalUsers } from "@/components/settings/users/GlobalUsers"
import { GlobalSites } from "@/components/settings/sites/GlobalSites"
import { type ModelType } from "@/types/settings"
import {
  Settings,
  Globe,
  Users,
  Save,
  Loader2,
  X,
  ChevronLeft,
  FileText
} from "lucide-react"
import { getUserInfo } from "@/lib/auth"
import { UserRole } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { SiteSettings } from "./sites/SiteSettings"
import { DocProcessorSettings } from "./doc-processor/DocProcessorSettings"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

function SettingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { isAiDirty, handleSave, revertToSavedConfig } = useSettings()

  // State
  const [activeTab, setActiveTab] = useState("general")
  const [selectedModel, setSelectedModel] = useState<ModelType | null>(null)
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
        setIsAdmin(user.role === UserRole.ADMIN)
        setIsTenantAdmin(user.role === UserRole.TENANT_ADMIN)
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

  const handleSelectModel = (model: ModelType) => {
    if (model === "chat" || model === "embedding" || model === "rerank" || model === "vl") {
      setSelectedModel(model)
    }
  }

  const handleBackToModels = useCallback(() => {
    if (selectedModel === "chat" || selectedModel === "embedding" || selectedModel === "rerank" || selectedModel === "vl") {
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
            <div className="flex items-center gap-2">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Settings className="h-4 w-4 text-slate-600" />
              </div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">
                {isSiteSettings ? "站点设置" : "系统设置"}
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
          <div className="flex-1 overflow-hidden p-6 bg-slate-50/50 animate-in fade-in slide-in-from-right-4 duration-300">
            <SiteSettings siteId={Number(siteId)} />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={handleTabChange} orientation="vertical" className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <TabsList className="w-64 h-full bg-slate-50/50 border-r border-slate-100 flex-col items-stretch justify-start p-4 space-y-1">
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
                  用户权限
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
                  文档解析
                </TabsTrigger>
              )}
            </TabsList>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-white relative">
              <div className="w-full h-full p-8">
                <TabsContent value="models" className="mt-0 h-full space-y-6 outline-none">
                  {selectedModel && (selectedModel === "chat" || selectedModel === "embedding" || selectedModel === "rerank" || selectedModel === "vl") ? (
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

                <TabsContent value="sites" className="mt-0 h-full space-y-6 outline-none">
                  <GlobalSites />
                </TabsContent>

                <TabsContent value="users" className="mt-0 h-full space-y-6 outline-none">
                  <GlobalUsers />
                </TabsContent>

                <TabsContent value="doc-processor" className="mt-0 h-full space-y-6 outline-none">
                  <DocProcessorSettings />
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
