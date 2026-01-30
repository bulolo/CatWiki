/**
 * 站点机器人设置组件
 * 配置网页挂件、API 接口和微信公众号
 */

"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Bot, Code, MessageCircle, ShieldCheck, Save, Eye, EyeOff, RefreshCw } from "lucide-react"
import { useState, useEffect } from "react"
import { ChatWidgetPreview } from "@/components/features/ChatWidgetPreview"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useUpdateSite } from "@/hooks"
import { initialConfigs } from "@/types/settings"
import { env } from "@/lib/env"

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
    wechat: {
      enabled: boolean
    }
  }
  onChange: (section: string, field: string, value: any) => void
}


export function SiteBotSettings({ siteId, config, onChange }: SiteBotSettingsProps) {
  const [showPreview, setShowPreview] = useState(false)

  if (!config) return null

  const { webWidget, apiBot, wechat } = config

  // 自动同步 API 端点到 state
  useEffect(() => {
    if (apiBot.enabled && !apiBot.apiEndpoint) {
      const endpoint = `${env.NEXT_PUBLIC_API_URL}/v1/chat/completions`
      onChange("apiBot", "apiEndpoint", endpoint)
    }
  }, [apiBot.enabled, apiBot.apiEndpoint, onChange])

  return (
    <div className="space-y-6">
      {/* 网页挂件机器人 */}
      <Card className="border-slate-200/60 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-50 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg text-blue-600 border border-blue-100">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">网页挂件机器人</CardTitle>
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
                  onClick={() => setShowPreview(!showPreview)}
                  className={cn(
                    "h-8 gap-2 rounded-lg border-slate-200 transition-all font-semibold text-xs",
                    showPreview ? "bg-blue-50 text-blue-600 border-blue-200 shadow-inner" : "hover:bg-slate-100"
                  )}
                >
                  {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showPreview ? "关闭预览" : "预览效果"}
                </Button>
              )}
              <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
                <input
                  type="checkbox"
                  checked={webWidget.enabled}
                  onChange={(e) => {
                    onChange("webWidget", "enabled", e.target.checked)
                    if (!e.target.checked) setShowPreview(false)
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-semibold text-slate-700">启用</span>
              </label>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">挂件标题</label>
            <Input
              value={webWidget.title}
              onChange={(e) => onChange("webWidget", "title", e.target.value)}
              placeholder="AI 客服助手"
              disabled={!webWidget.enabled}
              className="bg-white rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">欢迎语</label>
            <Input
              value={webWidget.welcomeMessage}
              onChange={(e) => onChange("webWidget", "welcomeMessage", e.target.value)}
              placeholder="您好！我是 AI 助手，有什么可以帮您？"
              disabled={!webWidget.enabled}
              className="bg-white rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">主题色</label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={webWidget.primaryColor}
                onChange={(e) => onChange("webWidget", "primaryColor", e.target.value)}
                disabled={!webWidget.enabled}
                className="w-20 h-10 bg-white cursor-pointer rounded-xl"
              />
              <Input
                value={webWidget.primaryColor}
                onChange={(e) => onChange("webWidget", "primaryColor", e.target.value)}
                disabled={!webWidget.enabled}
                placeholder="#3b82f6"
                className="flex-1 bg-white font-mono rounded-xl"
              />
            </div>
          </div>
          {webWidget.enabled && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-xs font-semibold text-blue-900 mb-2">嵌入代码：</p>
              <code className="block text-[10px] text-blue-700 font-mono bg-white p-3 rounded-lg overflow-x-auto border border-blue-100">
                {`<script 
  src="${env.NEXT_PUBLIC_CLIENT_URL}/widget.js"
  data-site-id="${siteId}"
></script>`}
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 问答机器人 API */}
      <Card className="border-slate-200/60 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-slate-50 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100">
                <Code className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">问答机器人 API</CardTitle>
                <CardDescription>
                  通过 RESTful API 对接第三方系统
                </CardDescription>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
              <input
                type="checkbox"
                checked={apiBot.enabled}
                onChange={(e) => onChange("apiBot", "enabled", e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span className="text-sm font-semibold text-slate-700">启用</span>
            </label>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-700">API 端点地址</label>
              <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-500 border-slate-200 font-bold">
                系统预设
              </Badge>
            </div>
            <div className="relative group">
              <Input
                value={apiBot.apiEndpoint || `${env.NEXT_PUBLIC_API_URL}/v1/chat/completions`}
                readOnly
                className="bg-slate-50 font-mono text-xs pr-20 border-slate-200 rounded-xl"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-8 text-[10px] hover:bg-slate-200 rounded-lg font-semibold"
                onClick={() => {
                  const endpoint = apiBot.apiEndpoint || `${env.NEXT_PUBLIC_API_URL}/v1/chat/completions`
                  navigator.clipboard.writeText(endpoint)
                  toast.success("端点地址已复制")
                }}
              >
                复制地址
              </Button>
            </div>
            <p className="text-[10px] text-slate-400">这是该站点的公开对话接口，支持 OpenAI 兼容格式。</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">API Key</label>
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
                  disabled={!apiBot.enabled}
                >
                  <RefreshCw className="h-3 w-3" />
                  自动生成
                </Button>
              </div>
              <Input
                type="password"
                value={apiBot.apiKey}
                onChange={(e) => onChange("apiBot", "apiKey", e.target.value)}
                placeholder="在此设置访问该接口的密钥"
                disabled={!apiBot.enabled}
                className="bg-white font-mono rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">超时时间 (秒)</label>
              <Input
                type="number"
                value={apiBot.timeout}
                onChange={(e) => onChange("apiBot", "timeout", parseInt(e.target.value))}
                disabled={!apiBot.enabled}
                className="bg-white rounded-xl"
                min={1}
                max={300}
              />
            </div>
          </div>
          {apiBot.enabled && (
            <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
              <p className="text-xs font-semibold text-emerald-900 mb-2">curl 调用示例：</p>
              <code className="block text-[10px] text-emerald-700 font-mono bg-white p-3 rounded-lg overflow-x-auto whitespace-pre border border-emerald-100">
                {`curl -X POST "${apiBot.apiEndpoint || `${env.NEXT_PUBLIC_API_URL}/v1/chat/completions`}" \\
  -H "Authorization: Bearer ${apiBot.apiKey || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "你好"
      }
    ],
    "filter": {
      "site_id": ${siteId}
    },
    "stream": true
  }'`}
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 微信公众号 */}
      {/* 暂时复用逻辑，这里省略公众号部分，或者按需添加 */}

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
