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

/**
 * 站点机器人设置组件
 * 配置网页挂件、API 接口和企业微信智能机器人
 */

"use client"

import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Bot, Code, Eye, EyeOff, RefreshCw, Copy, ChevronDown, ChevronUp, Crown, MessageSquare, Send } from "lucide-react"
import { useState } from "react"
import { ChatWidgetPreview } from "@/components/features/ChatWidgetPreview"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { BotConfig } from "@/types/settings"
import { env } from "@/lib/env"
import { useHealth } from '@/hooks/useHealth'

interface SiteBotSettingsProps {
  siteId: number
  config: BotConfig
  onChange: <S extends keyof BotConfig>(
    section: S,
    field: keyof BotConfig[S],
    value: BotConfig[S][keyof BotConfig[S]]
  ) => void
  chatModel?: string
}

// --- Sub-components for Refactoring ---

interface BotCardProps {
  title: string
  description: string
  icon: React.ReactNode
  iconBgColor?: string
  iconTextColor?: string
  isEnabled: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  onToggleEnable: (enabled: boolean) => void
  children: React.ReactNode
  badge?: React.ReactNode
  headerAction?: React.ReactNode
  className?: string
  disabled?: boolean
  tooltip?: string
}

function BotCard({
  title,
  description,
  icon,
  iconBgColor = "bg-blue-50",
  iconTextColor = "text-blue-600",
  isEnabled,
  isExpanded,
  onToggleExpand,
  onToggleEnable,
  children,
  badge,
  headerAction,
  className,
  disabled,
  tooltip
}: BotCardProps) {
  return (
    <Card className={cn("border-slate-200/60 shadow-sm rounded-xl overflow-hidden", disabled && "opacity-75", className)}>
      <CardHeader className="border-b border-slate-50/50 py-3 px-5">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer flex-1"
            onClick={onToggleExpand}
          >
            <div className={cn("p-1.5 rounded-lg border", iconBgColor, iconTextColor, "border-opacity-50")}>
              {icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold">{title}</CardTitle>
                {badge}
                {isExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                )}
              </div>
              <CardDescription className="text-xs">{description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {headerAction}
            <label
              className={cn(
                "flex items-center gap-2 cursor-pointer bg-slate-50 px-3 h-8 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-colors",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={(e) => e.stopPropagation()}
              title={tooltip}
            >
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => onToggleEnable(e.target.checked)}
                disabled={disabled}
                className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span className="text-[13px] font-semibold text-slate-700">启用</span>
            </label>
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-4 p-5 animate-in fade-in duration-300">
          {children}
        </CardContent>
      )}
    </Card>
  )
}

interface SettingItemProps {
  label: string
  badge?: string
  required?: boolean
  children: React.ReactNode
  className?: string
  labelClassName?: string
}

function SettingItem({ label, badge, required, children, className, labelClassName }: SettingItemProps) {
  return (
    <div className={cn("flex gap-4", className)}>
      <div className={cn("min-w-[100px] pt-1.5 flex flex-col items-start justify-start", labelClassName)}>
        <label className="text-[13px] font-semibold text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {badge && (
          <Badge variant="outline" className="text-[9px] mt-0.5 bg-slate-50 text-slate-500 border-slate-200 font-bold px-1.5 h-3.5">
            {badge}
          </Badge>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

interface CopyableInputProps {
  value: string
  onCopy?: () => void
  readOnly?: boolean
  type?: string
  onChange?: (val: string) => void
  placeholder?: string
  disabled?: boolean
  showPasswordToggle?: boolean
  isPasswordVisible?: boolean
  onTogglePasswordVisibility?: () => void
  hint?: string
  className?: string
  generateAction?: React.ReactNode
}

function CopyableInput({
  value,
  onCopy,
  readOnly,
  type = "text",
  onChange,
  placeholder,
  disabled,
  showPasswordToggle,
  isPasswordVisible,
  onTogglePasswordVisibility,
  hint,
  className,
  generateAction
}: CopyableInputProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    if (onCopy) onCopy()
    else toast.success("内容已复制")
  }

  return (
    <div className="space-y-2">
      <div className="relative group">
        <Input
          type={showPasswordToggle ? (isPasswordVisible ? "text" : "password") : type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "rounded-lg h-9 text-[13px] pr-16 placeholder:text-slate-400/80",
            readOnly ? "bg-slate-50 font-mono text-[11px]" : "bg-white",
            showPasswordToggle && "pr-28 font-mono",
            className
          )}
        />
        <div className="absolute right-1 top-1 flex gap-1">
          {showPasswordToggle && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 rounded-lg"
              onClick={onTogglePasswordVisibility}
              disabled={disabled}
              type="button"
            >
              {isPasswordVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 text-[11px] hover:bg-slate-200 rounded-lg font-semibold px-2 text-slate-500",
              !showPasswordToggle && "text-slate-400"
            )}
            onClick={handleCopy}
            disabled={disabled || !value}
            type="button"
          >
            {showPasswordToggle ? "复制" : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
      {generateAction}
    </div>
  )
}

interface InstructionBoxProps {
  title: string
  items: string[]
  footer?: React.ReactNode
  bgColor?: string
  borderColor?: string
  textColor?: string
}

function InstructionBox({
  title,
  items,
  footer,
  bgColor = "bg-blue-50",
  borderColor = "border-blue-100",
  textColor = "text-blue-700"
}: InstructionBoxProps) {
  const titleColor = textColor.replace("700", "900")
  return (
    <div className="flex gap-4 mt-1">
      <div className="min-w-[100px]" />
      <div className={cn("flex-1 p-3 rounded-lg border", bgColor, borderColor)}>
        <p className={cn("text-xs font-semibold mb-2", titleColor)}>{title}：</p>
        <ol className={cn("text-[11px] space-y-1.5 list-decimal list-inside", textColor)}>
          {items.map((item, index) => (
            <li key={index} dangerouslySetInnerHTML={{ __html: item }} />
          ))}
        </ol>
        {footer && (
          <div className="mt-3 pt-2 border-t border-black/5 flex items-center gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// --- End Sub-components ---

export function SiteBotSettings({ siteId, config, onChange, chatModel }: SiteBotSettingsProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [showWecomToken, setShowWecomToken] = useState(false)
  const [showWecomAESKey, setShowWecomAESKey] = useState(false)
  const [showFeishuAppSecret, setShowFeishuAppSecret] = useState(false)
  const [showDingtalkClientSecret, setShowDingtalkClientSecret] = useState(false)
  const [showWecomKefuSecret, setShowWecomKefuSecret] = useState(false)
  const [showWecomKefuToken, setShowWecomKefuToken] = useState(false)
  const [showWecomKefuAESKey, setShowWecomKefuAESKey] = useState(false)
  const { data: healthData } = useHealth()
  const isCommunity = healthData?.edition === 'community'

  const { webWidget, apiBot, wecomSmartRobot, feishuBot, dingtalkBot, wecomKefu } = config
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    webWidget: webWidget?.enabled || false,
    apiBot: apiBot?.enabled || false,
    wecomSmartRobot: wecomSmartRobot?.enabled || false,
    feishuBot: feishuBot?.enabled || false,
    dingtalkBot: dingtalkBot?.enabled || false,
    wecomKefu: wecomKefu?.enabled || false,
    discord: false,
    telegram: false
  })

  const toggleExpand = (card: string) => {
    setExpandedCards(prev => ({ ...prev, [card]: !prev[card] }))
  }


  return (
    <div className="space-y-4 pb-8">
      {/* 网页挂件机器人 */}
      <BotCard
        title="网页挂件机器人"
        description="在您的网站上嵌入智能客服聊天窗口"
        icon={<Bot className="h-4 w-4" />}
        isEnabled={webWidget?.enabled ?? false}
        isExpanded={expandedCards.webWidget}
        onToggleExpand={() => toggleExpand("webWidget")}
        onToggleEnable={(enabled) => {
          onChange("webWidget", "enabled", enabled)
          if (!enabled) setShowPreview(false)
          if (enabled) setExpandedCards(prev => ({ ...prev, webWidget: true }))
        }}
        headerAction={
          webWidget.enabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setShowPreview(!showPreview)
              }}
              className={cn(
                "h-8 gap-2 rounded-lg border-slate-200 transition-all font-semibold text-[13px]",
                showPreview ? "bg-blue-50 text-blue-600 border-blue-200 shadow-inner" : "hover:bg-slate-100"
              )}
            >
              {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showPreview ? "关闭预览" : "预览效果"}
            </Button>
          )
        }
      >
        <SettingItem label="挂件标题">
          <Input
            value={webWidget.title}
            onChange={(e) => onChange("webWidget", "title", e.target.value)}
            placeholder="AI 客服助手"
            disabled={!webWidget.enabled}
            className="bg-white rounded-lg h-9 text-[13px] placeholder:text-slate-400/80"
          />
        </SettingItem>

        <SettingItem label="欢迎语">
          <Input
            value={webWidget.welcomeMessage}
            onChange={(e) => onChange("webWidget", "welcomeMessage", e.target.value)}
            placeholder="您好！我是 AI 助手，有什么可以帮您？"
            disabled={!webWidget.enabled}
            className="bg-white rounded-lg h-9 text-[13px] placeholder:text-slate-400/80"
          />
        </SettingItem>

        <SettingItem label="主题色">
          <div className="flex gap-2">
            <Input
              type="color"
              value={webWidget.primaryColor}
              onChange={(e) => onChange("webWidget", "primaryColor", e.target.value)}
              disabled={!webWidget.enabled}
              className="w-16 h-9 bg-white cursor-pointer rounded-lg p-1"
            />
            <Input
              value={webWidget.primaryColor}
              onChange={(e) => onChange("webWidget", "primaryColor", e.target.value)}
              disabled={!webWidget.enabled}
              placeholder="#3b82f6"
              className="flex-1 bg-white font-mono rounded-lg h-9 text-[13px] placeholder:text-slate-400/80"
            />
          </div>
        </SettingItem>

        {webWidget.enabled && (
          <InstructionBox
            title="嵌入代码"
            items={[
              "将以下代码添加到您的网页中即可启用智能挂件",
              "代码已深度优化，支持异步加载，不会影响页面性能"
            ]}
            footer={
              <p className="text-[11px] text-blue-800/80">
                详细图文指引请参考：<a href={`${env.NEXT_PUBLIC_DOCS_URL}/development/tech/widget-integration`} target="_blank" className="underline decoration-blue-300 underline-offset-2 hover:text-blue-900 transition-colors">网页挂件配置文档</a>
              </p>
            }
          />
        )}

        {webWidget.enabled && (
          <div className="flex gap-4 -mt-3">
            <div className="min-w-[100px]" />
            <div className="flex-1 p-3 bg-blue-50 border border-blue-100 rounded-lg">
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
                  className="absolute right-1 top-1 h-7 text-blue-400 hover:text-blue-600 rounded-lg px-2"
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
      </BotCard>

      {/* 问答机器人 (OpenAI 兼容) */}
      <BotCard
        title="问答机器人 (OpenAI 兼容)"
        description="支持 OpenAI 兼容接口，对接各类 AI 客户端"
        icon={<Code className="h-4 w-4" />}
        iconBgColor={isCommunity ? "bg-slate-50" : "bg-emerald-50"}
        iconTextColor={isCommunity ? "text-slate-400" : "text-emerald-600"}
        isEnabled={isCommunity ? false : (apiBot?.enabled ?? false)}
        isExpanded={expandedCards.apiBot}
        onToggleExpand={() => toggleExpand("apiBot")}
        onToggleEnable={(enabled) => {
          if (isCommunity) return
          onChange("apiBot", "enabled", enabled)
          if (enabled) setExpandedCards(prev => ({ ...prev, apiBot: true }))
        }}
        disabled={isCommunity}
        tooltip={isCommunity ? '该功能仅企业版可用' : undefined}
        badge={isCommunity && (
          <Badge className="bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0 text-[9px] font-bold px-1.5 py-0 gap-1 shadow-sm h-4">
            <Crown className="h-2.5 w-2.5" />
            企业版
          </Badge>
        )}
      >
        {isCommunity && (
          <div className="flex items-center gap-3 px-3 py-2 bg-violet-50 text-violet-700 rounded-lg border border-violet-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
            <Crown className="h-5 w-5 shrink-0" />
            <p className="text-[13px] font-medium">此功能为企业版专属，升级到企业版以启用 问答机器人 (OpenAI 兼容) 对接第三方系统。</p>
          </div>
        )}

        <SettingItem label="API 端点地址" badge="系统预设">
          <CopyableInput
            value={`${env.NEXT_PUBLIC_API_URL}/v1/bot/chat/completions`}
            readOnly
            hint="该接口深度兼容 OpenAI 协议，支持全量消息数组（messages）回传，客户端可无感维护多轮对话记忆。"
          />
        </SettingItem>

        <SettingItem label="API Key" required>
          <CopyableInput
            value={apiBot.apiKey}
            onChange={(val) => onChange("apiBot", "apiKey", val)}
            placeholder="在此设置访问该接口的密钥"
            disabled={!apiBot.enabled}
            showPasswordToggle
            isPasswordVisible={showKey}
            onTogglePasswordVisibility={() => setShowKey(!showKey)}
            generateAction={
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] text-primary hover:text-primary/80 px-1 gap-1 font-bold"
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
                  disabled={!apiBot.enabled || isCommunity}
                >
                  <RefreshCw className="h-3 w-3" />
                  重置/生成 API Key
                </Button>
              </div>
            }
          />
        </SettingItem>

        <SettingItem label="超时时间 (秒)">
          <Input
            type="number"
            value={apiBot.timeout}
            onChange={(e) => onChange("apiBot", "timeout", parseInt(e.target.value))}
            disabled={!apiBot.enabled || isCommunity}
            className="bg-white rounded-lg h-9 max-w-[200px] text-[13px] placeholder:text-slate-400/80"
            min={1}
            max={300}
          />
        </SettingItem>

        {apiBot.enabled && (
          <InstructionBox
            title="curl 调用示例"
            bgColor="bg-emerald-50"
            borderColor="border-emerald-100"
            textColor="text-emerald-700"
            items={[`使用以下命令测试您的 API 接口：`]}
            footer={
              <p className="text-[11px] text-emerald-800/80">
                详细图文指引请参考：<a href={`${env.NEXT_PUBLIC_DOCS_URL}/development/tech/chat-api`} target="_blank" className="underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900 transition-colors">问答机器人配置文档</a>
              </p>
            }
          />
        )}

        {apiBot.enabled && (
          <div className="flex gap-4 -mt-3">
            <div className="min-w-[100px]" />
            <div className="flex-1 p-3 bg-emerald-50 border border-emerald-100 rounded-lg relative group/code">
              <div className="flex items-center justify-between mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px] text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 px-2 gap-1 font-semibold ml-auto"
                  onClick={() => {
                    const code = `curl -X POST "${env.NEXT_PUBLIC_API_URL}/v1/bot/chat/completions" \\
  -H "Authorization: Bearer ${apiBot.apiKey || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${chatModel || ""}",
    "messages": [
      {"role": "user", "content": "你好"}
    ],
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
                {`curl -X POST "${env.NEXT_PUBLIC_API_URL}/v1/bot/chat/completions" \\
  -H "Authorization: Bearer ${apiBot.apiKey || 'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${chatModel || ""}",
    "messages": [
      {"role": "user", "content": "你好"}
    ],
    "stream": true
  }'`}
              </code>
            </div>
          </div>
        )}
      </BotCard>

      {/* 飞书机器人 */}
      <BotCard
        title="飞书机器人"
        description="在飞书中与您的知识库对话"
        icon={<Image src="/icons/feishu.svg" alt="飞书" width={24} height={24} className="rounded" />}
        isEnabled={feishuBot?.enabled ?? false}
        isExpanded={expandedCards.feishuBot}
        onToggleExpand={() => toggleExpand("feishuBot")}
        onToggleEnable={(enabled) => {
          onChange("feishuBot", "enabled", enabled)
          if (enabled) setExpandedCards(prev => ({ ...prev, feishuBot: true }))
        }}
        iconBgColor="bg-slate-50"
        iconTextColor="text-slate-600"
      >
        <SettingItem label="App ID" required>
          <CopyableInput
            value={feishuBot?.appId || ""}
            onChange={(val) => onChange("feishuBot", "appId", val)}
            placeholder="cli_xxxxxxxxxxxxxxxxxx"
            disabled={!feishuBot?.enabled}
          />
        </SettingItem>

        <SettingItem label="App Secret" required>
          <CopyableInput
            value={feishuBot?.appSecret || ""}
            onChange={(val) => onChange("feishuBot", "appSecret", val)}
            placeholder="飞书应用 App Secret"
            disabled={!feishuBot?.enabled}
            showPasswordToggle
            isPasswordVisible={showFeishuAppSecret}
            onTogglePasswordVisibility={() => setShowFeishuAppSecret(!showFeishuAppSecret)}
          />
        </SettingItem>

        {feishuBot?.enabled && (
          <InstructionBox
            title="配置说明"
            bgColor="bg-indigo-50"
            borderColor="border-indigo-100"
            textColor="text-indigo-700"
            items={[
              "在飞书开放平台 「创建自定义应用」",
              "在应用详情页 「应用能力」-「机器人」 中开启机器人能力",
              "在 「开发配置」-「权限管理」 中搜索并开启所需的 4 项关键权限",
              "在 「事件与回调」 中开启 「长连接」 模式并添加 「接收消息 v2.0」 事件",
              "在 「凭证与基础信息」 获取 App ID / Secret 并填入本卡片",
              "在 「版本管理与发布」 创建版本并申请线上发布，审核通过后即可生效"
            ]}
            footer={
              <p className="text-[11px] text-indigo-800/80">
                详细图文指引请参考：<a href={`${env.NEXT_PUBLIC_DOCS_URL}/development/tech/feishu-robot`} target="_blank" className="underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900 transition-colors">飞书机器人配置文档</a>
              </p>
            }
          />
        )}
      </BotCard>

      {/* 钉钉机器人 */}
      <BotCard
        title="钉钉机器人"
        description="在钉钉中与您的知识库对话"
        icon={<Image src="/icons/dingtalk.svg" alt="钉钉" width={24} height={24} className="rounded" />}
        isEnabled={dingtalkBot?.enabled ?? false}
        isExpanded={expandedCards.dingtalkBot}
        onToggleExpand={() => toggleExpand("dingtalkBot")}
        onToggleEnable={(enabled) => {
          onChange("dingtalkBot", "enabled", enabled)
          if (enabled) setExpandedCards(prev => ({ ...prev, dingtalkBot: true }))
        }}
        iconBgColor="bg-slate-50"
        iconTextColor="text-slate-600"
      >
        <SettingItem label="Client ID" required>
          <CopyableInput
            value={dingtalkBot?.clientId || ""}
            onChange={(val) => onChange("dingtalkBot", "clientId", val)}
            placeholder="dingxxxxxxxxxx"
            disabled={!dingtalkBot?.enabled}
          />
        </SettingItem>

        <SettingItem label="Client Secret" required>
          <CopyableInput
            value={dingtalkBot?.clientSecret || ""}
            onChange={(val) => onChange("dingtalkBot", "clientSecret", val)}
            placeholder="钉钉应用 Client Secret"
            disabled={!dingtalkBot?.enabled}
            showPasswordToggle
            isPasswordVisible={showDingtalkClientSecret}
            onTogglePasswordVisibility={() => setShowDingtalkClientSecret(!showDingtalkClientSecret)}
          />
        </SettingItem>

        <SettingItem label="Template ID" required>
          <CopyableInput
            value={dingtalkBot?.templateId || ""}
            onChange={(val) => onChange("dingtalkBot", "templateId", val)}
            placeholder="钉钉机器人模板 ID"
            disabled={!dingtalkBot?.enabled}
          />
        </SettingItem>

        {dingtalkBot?.enabled && (
          <InstructionBox
            title="配置说明"
            bgColor="bg-orange-50"
            borderColor="border-orange-100"
            textColor="text-orange-700"
            items={[
              "在钉钉开放平台创建「企业内部应用」，并在 <b>「应用能力」</b> 中开启 <b>「机器人」</b>",
              "在 <b>「凭证与基础信息」</b> 获取 <b>Client ID</b> 和 <b>Client Secret</b> 并填入对应字段",
              "在 <b>「权限管理」</b> 中搜索并添加：<b>互动卡片实例写权限</b> 和 <b>AI卡片流式更新权限</b>",
              "在卡片平台新建 <b>「AI 卡片」</b> 模板，开启 <b>「流式组件」</b> 并获取 <b>Template ID</b>",
              "在 <b>「事件与回调」</b> 中将消息接收模式设置为 <b>Stream</b> 模式"
            ]}
            footer={
              <p className="text-[11px] text-orange-800/80">
                详细图文指引请参考：<a href={`${env.NEXT_PUBLIC_DOCS_URL}/development/tech/dingtalk-robot`} target="_blank" className="underline decoration-orange-300 underline-offset-2 hover:text-orange-900 transition-colors">钉钉机器人配置文档</a>
              </p>
            }
          />
        )}
      </BotCard>

      {/* 企业微信客服 */}
      <BotCard
        title="企业微信客服"
        description="对接企业微信客服，使用知识库自动回复客户咨询"
        icon={<Image src="/icons/wecom.svg" alt="企业微信" width={24} height={24} className="rounded" />}
        isEnabled={wecomKefu?.enabled ?? false}
        isExpanded={expandedCards.wecomKefu}
        onToggleExpand={() => toggleExpand("wecomKefu")}
        onToggleEnable={(enabled) => {
          onChange("wecomKefu", "enabled", enabled)
          if (enabled) setExpandedCards(prev => ({ ...prev, wecomKefu: true }))
        }}
        iconBgColor="bg-slate-50"
        iconTextColor="text-slate-600"
      >
        <SettingItem label="回调地址" badge="系统预设">
          <CopyableInput
            value={`${env.NEXT_PUBLIC_API_URL}/v1/bot/wecom-kefu?site_id=${siteId}`}
            readOnly
            hint="请在微信客服管理后台“事件和消息接收”配置中填写此地址"
          />
        </SettingItem>

        <SettingItem label="企业 ID (CorpID)" required>
          <CopyableInput
            value={wecomKefu?.corpId || ""}
            onChange={(val) => onChange("wecomKefu", "corpId", val)}
            placeholder="企业微信 CorpID"
            disabled={!wecomKefu?.enabled}
          />
        </SettingItem>

        <SettingItem label="客服 Secret" required>
          <CopyableInput
            value={wecomKefu?.secret || ""}
            onChange={(val) => onChange("wecomKefu", "secret", val)}
            placeholder="微信客服 Secret"
            disabled={!wecomKefu?.enabled}
            showPasswordToggle
            isPasswordVisible={showWecomKefuSecret}
            onTogglePasswordVisibility={() => setShowWecomKefuSecret(!showWecomKefuSecret)}
          />
        </SettingItem>

        <SettingItem label="Token" required>
          <CopyableInput
            value={wecomKefu?.token || ""}
            onChange={(val) => onChange("wecomKefu", "token", val)}
            placeholder="WeCom Kefu Token"
            disabled={!wecomKefu?.enabled}
            showPasswordToggle
            isPasswordVisible={showWecomKefuToken}
            onTogglePasswordVisibility={() => setShowWecomKefuToken(!showWecomKefuToken)}
          />
        </SettingItem>

        <SettingItem label="AES Key" required>
          <CopyableInput
            value={wecomKefu?.encodingAesKey || ""}
            onChange={(val) => onChange("wecomKefu", "encodingAesKey", val)}
            placeholder="EncodingAESKey"
            disabled={!wecomKefu?.enabled}
            showPasswordToggle
            isPasswordVisible={showWecomKefuAESKey}
            onTogglePasswordVisibility={() => setShowWecomKefuAESKey(!showWecomKefuAESKey)}
          />
        </SettingItem>

        {wecomKefu?.enabled && (
          <InstructionBox
            title="配置说明"
            bgColor="bg-teal-50"
            borderColor="border-teal-100"
            textColor="text-teal-700"
            items={[
              "在企业微信管理后台进入 <b>「应用管理」-「微信客服」</b>",
              "从 <b>「开发配置」</b> 模块获取企业 ID 和 Secret",
              "在 <b>「事件和消息接收」</b> 中开启并填入本卡片提供的回调参数"
            ]}
            footer={
              <p className="text-[11px] text-teal-800/80">
                详细图文指引请参考：<a href={`${env.NEXT_PUBLIC_DOCS_URL}/development/tech/wecom-kefu`} target="_blank" className="underline decoration-teal-300 underline-offset-2 hover:text-teal-900 transition-colors">企业微信客服配置文档</a>
              </p>
            }
          />
        )}
      </BotCard>

      {/* 企业微信智能机器人 */}
      <BotCard
        title="企业微信智能机器人"
        description="在企业微信中与您的知识库对话"
        icon={<Image src="/icons/wecom.svg" alt="企业微信" width={24} height={24} className="rounded" />}
        isEnabled={wecomSmartRobot?.enabled ?? false}
        isExpanded={expandedCards.wecomSmartRobot}
        onToggleExpand={() => toggleExpand("wecomSmartRobot")}
        onToggleEnable={(enabled) => {
          onChange("wecomSmartRobot", "enabled", enabled)
          if (enabled) setExpandedCards(prev => ({ ...prev, wecomSmartRobot: true }))
        }}
        iconBgColor="bg-slate-50"
        iconTextColor="text-slate-600"
      >
        <SettingItem label="回调地址" badge="系统预设">
          <CopyableInput
            value={`${env.NEXT_PUBLIC_API_URL}/v1/bot/wecom-smart-robot?site_id=${siteId}`}
            readOnly
            hint="请在企业微信管理后台“智能机器人”配置中填写此地址"
          />
        </SettingItem>

        <SettingItem label="Token" required>
          <CopyableInput
            value={wecomSmartRobot?.token || ""}
            onChange={(val) => onChange("wecomSmartRobot", "token", val)}
            placeholder="WeCom Robot Token"
            disabled={!wecomSmartRobot?.enabled}
            showPasswordToggle
            isPasswordVisible={showWecomToken}
            onTogglePasswordVisibility={() => setShowWecomToken(!showWecomToken)}
          />
        </SettingItem>

        <SettingItem label="AES Key" required>
          <CopyableInput
            value={wecomSmartRobot?.encodingAesKey || ""}
            onChange={(val) => onChange("wecomSmartRobot", "encodingAesKey", val)}
            placeholder="EncodingAESKey"
            disabled={!wecomSmartRobot?.enabled}
            showPasswordToggle
            isPasswordVisible={showWecomAESKey}
            onTogglePasswordVisibility={() => setShowWecomAESKey(!showWecomAESKey)}
          />
        </SettingItem>

        {wecomSmartRobot?.enabled && (
          <InstructionBox
            title="配置说明"
            bgColor="bg-sky-50"
            borderColor="border-sky-100"
            textColor="text-sky-700"
            items={[
              "登录企业微信管理后台并进入 <b>「应用管理」-「机器人」</b> (或管理工具-智能机器人)",
              "点击 <b>「添加机器人」</b> 并选择 <b>「开启 API 模式」</b>",
              "将本卡片提供的回调参数填入企业微信后台，并保存"
            ]}
            footer={
              <p className="text-[11px] text-sky-800/80">
                详细图文指引请参考：<a href={`${env.NEXT_PUBLIC_DOCS_URL}/development/tech/wecom-robot`} target="_blank" className="underline decoration-sky-300 underline-offset-2 hover:text-sky-900 transition-colors">企业微信机器人配置文档</a>
              </p>
            }
          />
        )}
      </BotCard>

      {/* Discord 机器人 */}
      <BotCard
        title="Discord 机器人"
        description="在 Discord 中与您的知识库对话"
        icon={<MessageSquare className="h-4 w-4" />}
        isEnabled={false}
        isExpanded={expandedCards.discord}
        onToggleExpand={() => toggleExpand("discord")}
        onToggleEnable={() => { }}
        disabled={true}
        badge={<Badge variant="outline" className="text-[9px] font-bold px-1.5 h-4 bg-slate-50 text-slate-400">敬请期待</Badge>}
      >
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <div className="text-slate-400 text-sm italic">
            Discord 机器人功能开发中，敬请期待...
          </div>
          <p className="text-[10px] text-slate-400/80">
            详细图文指引请参考：<a href={`${env.NEXT_PUBLIC_DOCS_URL}/development/tech/discord-robot`} target="_blank" className="underline underline-offset-2 hover:text-slate-600 transition-colors">Discord 机器人配置文档</a>
          </p>
        </div>
      </BotCard>

      {/* Telegram 机器人 */}
      <BotCard
        title="Telegram 机器人"
        description="在 Telegram 中与您的知识库对话"
        icon={<Send className="h-4 w-4" />}
        isEnabled={false}
        isExpanded={expandedCards.telegram}
        onToggleExpand={() => toggleExpand("telegram")}
        onToggleEnable={() => { }}
        disabled={true}
        badge={<Badge variant="outline" className="text-[9px] font-bold px-1.5 h-4 bg-slate-50 text-slate-400">敬请期待</Badge>}
      >
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <div className="text-slate-400 text-sm italic">
            Telegram 机器人功能开发中，敬请期待...
          </div>
          <p className="text-[10px] text-slate-400/80">
            详细图文指引请参考：<a href={`${env.NEXT_PUBLIC_DOCS_URL}/development/tech/telegram-robot`} target="_blank" className="underline underline-offset-2 hover:text-slate-600 transition-colors">Telegram 机器人配置文档</a>
          </p>
        </div>
      </BotCard>

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
