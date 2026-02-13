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

/**
 * 站点机器人设置组件
 * 配置网页挂件、API 接口和微信公众号
 */

"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Bot, Code, MessageCircle, ShieldCheck, Save, Eye, EyeOff, RefreshCw, Copy, ChevronDown, ChevronUp, MessageSquare } from "lucide-react"
import { useState, useEffect } from "react"
import { ChatWidgetPreview } from "@/components/features/ChatWidgetPreview"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useUpdateSite } from "@/hooks"
import api from "@/lib/api-client"
import { initialConfigs } from "@/types/settings"
import { env } from "@/lib/env"
import { useDemoMode } from '@/hooks/useHealth'

interface SiteBotSettingsProps {
  siteId: number
  config: {
    webWidget: {
      enabled: boolean
      title: string
      welcomeMessage: string
      primaryColor: string
      position: string
    }
    apiBot: {
      enabled: boolean
      apiEndpoint: string
      apiKey: string
      timeout: number
    }
    wecomSmartRobot: {
      enabled: boolean
      callbackUrl: string
      token: string
      encodingAesKey: string
    }
  }
  onChange: (section: string, field: string, value: any) => void
}


export function SiteBotSettings({ siteId, config, onChange }: SiteBotSettingsProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [showWecomToken, setShowWecomToken] = useState(false)
  const [showWecomAESKey, setShowWecomAESKey] = useState(false)
  const isDemoMode = useDemoMode()

  const { webWidget, apiBot, wecomSmartRobot } = config || { webWidget: {}, apiBot: {}, wecomSmartRobot: {} } as any
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    webWidget: webWidget.enabled,
    apiBot: apiBot.enabled,
    wecomSmartRobot: wecomSmartRobot.enabled
  })

  const toggleExpand = (card: string) => {
    setExpandedCards(prev => ({ ...prev, [card]: !prev[card] }))
  }

  // 自动同步 API 端点到 state
  useEffect(() => {
    if (config?.apiBot?.enabled && !config.apiBot.apiEndpoint) {
      const endpoint = `${env.NEXT_PUBLIC_API_URL}/v1/chat/site-completions?site_id=${siteId}`
      onChange("apiBot", "apiEndpoint", endpoint)
    }
    // 自动同步 WeCom Smart Robot 回调地址
    if (config?.wecomSmartRobot?.enabled && !config.wecomSmartRobot.callbackUrl) {
      const endpoint = `${env.NEXT_PUBLIC_API_URL}/v1/bot/wecom-smart-robot?site_id=${siteId}`
      onChange("wecomSmartRobot", "callbackUrl", endpoint)
    }
  }, [config?.apiBot?.enabled, config?.apiBot?.apiEndpoint, config?.wecomSmartRobot?.enabled, config?.wecomSmartRobot?.callbackUrl, onChange])

  if (!config) return null

  return (
    <div className="space-y-6">
      {isDemoMode && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">演示模式已开启：为了保护基础设施安全，部分配置项（如 API Key）已进行脱敏处理。</p>
        </div>
      )}
      {/* 网页挂件机器人 */}
      <Card className="border-slate-200/60 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-50 pb-4">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-3 cursor-pointer flex-1"
              onClick={() => toggleExpand("webWidget")}
            >
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600 border border-blue-100">
                <Bot className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl font-bold">网页挂件机器人</CardTitle>
                  {expandedCards.webWidget ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
                <CardDescription>
                  在您的网站上嵌入智能客服聊天窗口
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {webWidget.enabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowPreview(!showPreview)
                  }}
                  className={cn(
                    "h-8 gap-2 rounded-lg border-slate-200 transition-all font-semibold text-xs",
                    showPreview ? "bg-blue-50 text-blue-600 border-blue-200 shadow-inner" : "hover:bg-slate-100"
                  )}
                >
                  {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showPreview ? "关闭预览" : "预览效果"}
                </Button>
              )}
              <label
                className={`flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-colors ${isDemoMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={webWidget.enabled}
                  onChange={(e) => {
                    if (isDemoMode) return
                    onChange("webWidget", "enabled", e.target.checked)
                    if (!e.target.checked) setShowPreview(false)
                    if (e.target.checked) setExpandedCards(prev => ({ ...prev, webWidget: true }))
                  }}
                  disabled={isDemoMode}
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-semibold text-slate-700">启用</span>
              </label>
            </div>
          </div>
        </CardHeader>
        {expandedCards.webWidget && (
          <CardContent className="space-y-6 pt-6 animate-in fade-in duration-300">
            <div className="flex gap-4">
              <label className="text-sm font-semibold text-slate-700 min-w-[120px] pt-2.5">挂件标题</label>
              <div className="flex-1">
                <Input
                  value={webWidget.title}
                  onChange={(e) => onChange("webWidget", "title", e.target.value)}
                  placeholder="AI 客服助手"
                  disabled={!webWidget.enabled}
                  className="bg-white rounded-xl h-11"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <label className="text-sm font-semibold text-slate-700 min-w-[120px] pt-2.5">欢迎语</label>
              <div className="flex-1">
                <Input
                  value={webWidget.welcomeMessage}
                  onChange={(e) => onChange("webWidget", "welcomeMessage", e.target.value)}
                  placeholder="您好！我是 AI 助手，有什么可以帮您？"
                  disabled={!webWidget.enabled}
                  className="bg-white rounded-xl h-11"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <label className="text-sm font-semibold text-slate-700 min-w-[120px] pt-2.5">主题色</label>
              <div className="flex-1 flex gap-2">
                <Input
                  type="color"
                  value={webWidget.primaryColor}
                  onChange={(e) => onChange("webWidget", "primaryColor", e.target.value)}
                  disabled={!webWidget.enabled}
                  className="w-20 h-11 bg-white cursor-pointer rounded-xl p-1"
                />
                <Input
                  value={webWidget.primaryColor}
                  onChange={(e) => onChange("webWidget", "primaryColor", e.target.value)}
                  disabled={!webWidget.enabled}
                  placeholder="#3b82f6"
                  className="flex-1 bg-white font-mono rounded-xl h-11"
                />
              </div>
            </div>
            {webWidget.enabled && (
              <div className="flex gap-4 mt-2">
                <div className="min-w-[120px]" />
                <div className="flex-1 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                  <p className="text-xs font-semibold text-blue-900 mb-2">嵌入代码：</p>
                  <div className="relative group/code">
                    <code className="block text-[10px] text-blue-700 font-mono bg-white p-3 rounded-lg overflow-x-auto border border-blue-100 pr-12">
                      {`<script 
  src="${env.NEXT_PUBLIC_CLIENT_URL}/widget.js"
  data-site-id="${siteId}"
></script>`}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-7 w-7 p-0 text-blue-400 hover:text-blue-600 rounded-md"
                      onClick={() => {
                        const code = `<script \n  src="${env.NEXT_PUBLIC_CLIENT_URL}/widget.js"\n  data-site-id="${siteId}"\n></script>`
                        navigator.clipboard.writeText(code)
                        toast.success("代码已复制")
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* 问答机器人 API */}
      <Card className="border-slate-200/60 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-50 pb-4">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-3 cursor-pointer flex-1"
              onClick={() => toggleExpand("apiBot")}
            >
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100">
                <Code className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl font-bold">问答机器人 API</CardTitle>
                  {expandedCards.apiBot ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
                <CardDescription>
                  通过 RESTful API 对接第三方系统
                </CardDescription>
              </div>
            </div>
            <label
              className={`flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-colors ${isDemoMode ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={apiBot.enabled}
                onChange={(e) => {
                  if (isDemoMode) return
                  onChange("apiBot", "enabled", e.target.checked)
                  if (e.target.checked) setExpandedCards(prev => ({ ...prev, apiBot: true }))
                }}
                disabled={isDemoMode}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span className="text-sm font-semibold text-slate-700">启用</span>
            </label>
          </div>
        </CardHeader>
        {expandedCards.apiBot && (
          <CardContent className="space-y-6 pt-6 animate-in fade-in duration-300">
            <div className="flex gap-4">
              <div className="min-w-[120px] pt-3 flex flex-col items-start justify-start">
                <label className="text-sm font-semibold text-slate-700">API 端点地址</label>
                <Badge variant="outline" className="text-[9px] mt-1 bg-slate-50 text-slate-500 border-slate-200 font-bold px-1.5 h-4">
                  系统预设
                </Badge>
              </div>
              <div className="flex-1 space-y-2">
                <div className="relative group">
                  <Input
                    value={apiBot.apiEndpoint || `${env.NEXT_PUBLIC_API_URL}/v1/chat/site-completions?site_id=${siteId}`}
                    readOnly
                    className="bg-slate-50 font-mono text-xs pr-20 border-slate-200 rounded-xl h-11"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1.5 h-8 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg px-2"
                    onClick={() => {
                      const endpoint = apiBot.apiEndpoint || `${env.NEXT_PUBLIC_API_URL}/v1/chat/site-completions?site_id=${siteId}`
                      navigator.clipboard.writeText(endpoint)
                      toast.success("端点地址已复制")
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-slate-400">这是该站点的公开对话接口，支持 OpenAI 兼容格式。</p>
              </div>
            </div>

            <div className="flex gap-4">
              <label className="text-sm font-semibold text-slate-700 min-w-[120px] pt-3">API Key</label>
              <div className="flex-1 space-y-2">
                <div className="relative group">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={apiBot.apiKey}
                    onChange={(e) => onChange("apiBot", "apiKey", e.target.value)}
                    placeholder="在此设置访问该接口的密钥"
                    disabled={!apiBot.enabled}
                    readOnly={isDemoMode && apiBot.apiKey === "********"}
                    className="bg-white font-mono rounded-xl pr-28 h-11"
                  />
                  <div className="absolute right-1 top-1.5 flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 rounded-lg"
                      onClick={() => setShowKey(!showKey)}
                      disabled={!apiBot.enabled}
                      type="button"
                    >
                      {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-[10px] hover:bg-slate-200 rounded-lg font-semibold px-2 text-slate-500"
                      onClick={() => {
                        navigator.clipboard.writeText(apiBot.apiKey)
                        toast.success("API Key 已复制")
                      }}
                      disabled={!apiBot.enabled || (isDemoMode && apiBot.apiKey === "********")}
                      type="button"
                    >
                      复制
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-primary hover:text-primary/80 px-1 gap-1 font-bold"
                    onClick={(e) => {
                      e.preventDefault();
                      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                      let result = 'sk-';
                      for (let i = 0; i < 32; i++) {
                        result += chars.charAt(Math.floor(Math.random() * chars.length));
                      }
                      onChange("apiBot", "apiKey", result);
                      toast.success("已生成新 API Key");
                    }}
                    disabled={!apiBot.enabled || isDemoMode}
                  >
                    <RefreshCw className="h-3 w-3" />
                    重置/生成 API Key
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <label className="text-sm font-semibold text-slate-700 min-w-[120px] pt-3">超时时间 (秒)</label>
              <div className="flex-1">
                <Input
                  type="number"
                  value={apiBot.timeout}
                  onChange={(e) => onChange("apiBot", "timeout", parseInt(e.target.value))}
                  disabled={!apiBot.enabled}
                  className="bg-white rounded-xl h-11 max-w-[200px]"
                  min={1}
                  max={300}
                />
              </div>
            </div>

            {apiBot.enabled && (
              <div className="flex gap-4 mt-2">
                <div className="min-w-[120px]" />
                <div className="flex-1 p-4 bg-emerald-50 border border-emerald-100 rounded-xl relative group/code">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-emerald-900">curl 调用示例：</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 px-2 gap-1 font-semibold"
                      onClick={() => {
                        const code = `curl -X POST "${apiBot.apiEndpoint || `${env.NEXT_PUBLIC_API_URL}/v1/chat/site-completions?site_id=${siteId}`}" \\
  -H "Authorization: Bearer ${apiBot.apiKey || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "你好",
    "thread_id": "unique-conversation-id",
    "stream": true
  }'`
                        navigator.clipboard.writeText(code)
                        toast.success("代码已复制")
                      }}
                    >
                      <Copy className="h-3 w-3" />
                      复制
                    </Button>
                  </div>
                  <code className="block text-[10px] text-emerald-700 font-mono bg-white p-3 rounded-lg overflow-x-auto whitespace-pre border border-emerald-100">
                    {`curl -X POST "${apiBot.apiEndpoint || `${env.NEXT_PUBLIC_API_URL}/v1/chat/site-completions?site_id=${siteId}`}" \\
  -H "Authorization: Bearer ${apiBot.apiKey || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "你好",
    "thread_id": "unique-conversation-id",
    "stream": true
  }'`}
                  </code>
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>



      {/* 企业微信智能机器人 */}
      <Card className="border-slate-200/60 shadow-sm rounded-2xl overflow-hidden mt-6">
        <CardHeader className="border-b border-slate-50 pb-4">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-3 cursor-pointer flex-1"
              onClick={() => toggleExpand("wecomSmartRobot")}
            >
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600 border border-blue-100">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl font-bold">企业微信智能机器人</CardTitle>
                  {expandedCards.wecomSmartRobot ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
                <CardDescription>
                  直接在企业微信中与您的知识库对话
                </CardDescription>
              </div>
            </div>
            <label
              className={`flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-colors ${isDemoMode ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={wecomSmartRobot?.enabled}
                onChange={(e) => {
                  if (isDemoMode) return
                  onChange("wecomSmartRobot", "enabled", e.target.checked)
                  if (e.target.checked) setExpandedCards(prev => ({ ...prev, wecomSmartRobot: true }))
                }}
                disabled={isDemoMode}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span className="text-sm font-semibold text-slate-700">启用</span>
            </label>
          </div>
        </CardHeader>
        {expandedCards.wecomSmartRobot && (
          <CardContent className="space-y-6 pt-6 animate-in fade-in duration-300">
            <div className="space-y-4">
              <div className="flex flex-col gap-4">
                <div className="flex gap-4">
                  <div className="min-w-[120px] pt-3 flex flex-col items-start justify-start">
                    <label className="text-sm font-semibold text-slate-700">回调地址</label>
                    <Badge variant="outline" className="text-[9px] mt-1 bg-slate-50 text-slate-500 border-slate-200 font-bold px-1.5 h-4">
                      系统预设
                    </Badge>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="relative group">
                      <Input
                        value={wecomSmartRobot?.callbackUrl || `${env.NEXT_PUBLIC_API_URL}/v1/bot/wecom-smart-robot?site_id=${siteId}`}
                        readOnly
                        className="bg-slate-50 font-mono text-xs pr-20 border-slate-200 rounded-xl h-11"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1.5 h-8 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg px-2"
                        onClick={() => {
                          const endpoint = wecomSmartRobot?.callbackUrl || `${env.NEXT_PUBLIC_API_URL}/v1/bot/wecom-smart-robot?site_id=${siteId}`
                          navigator.clipboard.writeText(endpoint)
                          toast.success("回调地址已复制")
                        }}
                      >
                        复制
                      </Button>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      请在企业微信管理后台“智能机器人”配置中填写此地址
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="text-sm font-semibold text-slate-700 min-w-[120px]">
                    Token <span className="text-red-500">*</span>
                  </label>
                  <div className="flex-1 relative group">
                    <Input
                      type={showWecomToken ? "text" : "password"}
                      placeholder="WeCom Robot Token"
                      value={wecomSmartRobot?.token || ""}
                      onChange={(e) => onChange("wecomSmartRobot", "token", e.target.value)}
                      readOnly={isDemoMode && wecomSmartRobot?.token === "********"}
                      className="rounded-xl border-slate-200 h-11 pr-28 font-mono"
                    />
                    <div className="absolute right-1 top-1.5 flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 rounded-lg"
                        onClick={() => setShowWecomToken(!showWecomToken)}
                        disabled={!wecomSmartRobot?.enabled}
                        type="button"
                      >
                        {showWecomToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[10px] hover:bg-slate-200 rounded-lg font-semibold px-2 text-slate-500"
                        onClick={() => {
                          const val = wecomSmartRobot?.token || ""
                          navigator.clipboard.writeText(val)
                          toast.success("Token 已复制")
                        }}
                        disabled={!wecomSmartRobot?.enabled || (isDemoMode && wecomSmartRobot?.token === "********")}
                        type="button"
                      >
                        复制
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="text-sm font-semibold text-slate-700 min-w-[120px]">
                    AES Key <span className="text-red-500">*</span>
                  </label>
                  <div className="flex-1 relative group">
                    <Input
                      type={showWecomAESKey ? "text" : "password"}
                      placeholder="EncodingAESKey"
                      value={wecomSmartRobot?.encodingAesKey || ""}
                      onChange={(e) => onChange("wecomSmartRobot", "encodingAesKey", e.target.value)}
                      readOnly={isDemoMode && wecomSmartRobot?.encodingAesKey === "********"}
                      className="rounded-xl border-slate-200 h-11 pr-28 font-mono"
                    />
                    <div className="absolute right-1 top-1.5 flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 rounded-lg"
                        onClick={() => setShowWecomAESKey(!showWecomAESKey)}
                        disabled={!wecomSmartRobot?.enabled}
                        type="button"
                      >
                        {showWecomAESKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[10px] hover:bg-slate-200 rounded-lg font-semibold px-2 text-slate-500"
                        onClick={() => {
                          const val = wecomSmartRobot?.encodingAesKey || ""
                          navigator.clipboard.writeText(val)
                          toast.success("AES Key 已复制")
                        }}
                        disabled={!wecomSmartRobot?.enabled || (isDemoMode && wecomSmartRobot?.encodingAesKey === "********")}
                        type="button"
                      >
                        复制
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 预览挂件 */}
      {showPreview && webWidget.enabled && (
        <ChatWidgetPreview
          title={webWidget.title}
          welcomeMessage={webWidget.welcomeMessage}
          primaryColor={webWidget.primaryColor}
          position={webWidget.position as "left" | "right"}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}
