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

import { useTranslations } from "next-intl"
import Image from "next/image"
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, Input, ScrollArea } from "@/components/ui"
import { Bot, Code, Copy, Eye, EyeOff, RefreshCw, Crown, MessageSquare, Send } from "lucide-react"
import { useState } from "react"
import { ChatWidgetPreview } from "@/components/features/ChatWidgetPreview"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { BotConfig } from "@/types/settings"
import { env } from "@/lib/env"
import { useHealth } from "@/hooks/useHealth"
import { BotCard, CopyableInput, InstructionBox, SettingItem } from "./_bot/BotPrimitives"

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


export function SiteBotSettings({ siteId, config, onChange, chatModel }: SiteBotSettingsProps) {
  const t = useTranslations("SiteBot")
  const [showPreview, setShowPreview] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [showWecomSmartSecret, setShowWecomSmartSecret] = useState(false)
  const [showFeishuAppSecret, setShowFeishuAppSecret] = useState(false)
  const [showDingtalkClientSecret, setShowDingtalkClientSecret] = useState(false)
  const [showWecomKefuSecret, setShowWecomKefuSecret] = useState(false)
  const [showWecomKefuToken, setShowWecomKefuToken] = useState(false)
  const [showWecomKefuAESKey, setShowWecomKefuAESKey] = useState(false)
  const [showWecomAppSecret, setShowWecomAppSecret] = useState(false)
  const [showWecomAppToken, setShowWecomAppToken] = useState(false)
  const [showWecomAppAESKey, setShowWecomAppAESKey] = useState(false)
  const [showTelegramBotToken, setShowTelegramBotToken] = useState(false)
  const { data: healthData } = useHealth()
  const isCommunity = healthData?.edition === "community"

  const { web_widget, api_bot, wecom_smart, feishu_app, dingtalk_app, wecom_kefu, wecom_app, telegram_app } = config
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    web_widget: web_widget?.enabled || false,
    api_bot: api_bot?.enabled || false,
    wecom_smart: wecom_smart?.enabled || false,
    feishu_app: feishu_app?.enabled || false,
    dingtalk_app: dingtalk_app?.enabled || false,
    wecom_kefu: wecom_kefu?.enabled || false,
    wecom_app: wecom_app?.enabled || false,
    discord_app: false,
    telegram_app: telegram_app?.enabled || false
  })

  const toggleExpand = (card: string) => {
    setExpandedCards(prev => ({ ...prev, [card]: !prev[card] }))
  }


  return (
    <div className="space-y-4 pb-8">
      {/* 网页挂件机器人 */}
      <BotCard
        title={t("webWidget.title")}
        description={t("webWidget.description")}
        typeBadge={t("webWidget.type")}
        icon={<Bot className="h-4 w-4" />}
        isEnabled={web_widget?.enabled ?? false}
        isExpanded={expandedCards.web_widget}
        onToggleExpand={() => toggleExpand("web_widget")}
        onToggleEnable={(enabled) => {
          onChange("web_widget", "enabled", enabled)
          if (!enabled) setShowPreview(false)
          if (enabled) setExpandedCards(prev => ({ ...prev, web_widget: true }))
        }}
        headerAction={
          web_widget.enabled && (
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
              {showPreview ? t("webWidget.closePreview") : t("webWidget.preview")}
            </Button>
          )
        }
      >
        <SettingItem label={t("webWidget.widgetTitle")}>
          <Input
            value={web_widget.title}
            onChange={(e) => onChange("web_widget", "title", e.target.value)}
            placeholder={t("webWidget.titlePlaceholder")}
            disabled={!web_widget.enabled}
            autoComplete="off"
            className="bg-white rounded-lg h-9 text-[13px] placeholder:text-slate-400/80"
          />
        </SettingItem>

        <SettingItem label={t("webWidget.welcomeMessage")}>
          <Input
            value={web_widget.welcome_message}
            onChange={(e) => onChange("web_widget", "welcome_message", e.target.value)}
            placeholder={t("webWidget.welcomePlaceholder")}
            disabled={!web_widget.enabled}
            autoComplete="off"
            className="bg-white rounded-lg h-9 text-[13px] placeholder:text-slate-400/80"
          />
        </SettingItem>

        <SettingItem label={t("webWidget.themeColor")}>
          <div className="flex gap-2">
            <Input
              type="color"
              value={web_widget.primary_color}
              onChange={(e) => onChange("web_widget", "primary_color", e.target.value)}
              disabled={!web_widget.enabled}
              className="w-16 h-9 bg-white cursor-pointer rounded-lg p-1"
            />
            <Input
              value={web_widget.primary_color}
              onChange={(e) => onChange("web_widget", "primary_color", e.target.value)}
              disabled={!web_widget.enabled}
              placeholder={t("webWidget.colorPlaceholder")}
              autoComplete="off"
              className="flex-1 bg-white font-mono rounded-lg h-9 text-[13px] placeholder:text-slate-400/80"
            />
          </div>
        </SettingItem>

        {web_widget.enabled && (
          <InstructionBox
            title={t("webWidget.embedCode")}
            items={[
              t("webWidget.embedInstruction"),
              t("webWidget.asyncNote")
            ]}
            footer={
              <p className="text-[11px] text-blue-800/80">
                {t("webWidget.embedInstruction")}: <a href={`${env.NEXT_PUBLIC_DOCS_URL}/development/bots/widget-integration`} target="_blank" className="underline decoration-blue-300 underline-offset-2 hover:text-blue-900 transition-colors">{t("webWidget.docLink")}</a>
              </p>
            }
          />
        )}

        {web_widget.enabled && (
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
                    toast.success(t("copied"))
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </BotCard>

      {/* 问答机器人 */}
      <BotCard
        title={t("apiBot.title")}
        description={t("apiBot.description")}
        typeBadge={t("apiBot.type")}
        icon={<Code className="h-4 w-4" />}
        iconBgColor={isCommunity ? "bg-slate-50" : "bg-emerald-50"}
        iconTextColor={isCommunity ? "text-slate-400" : "text-emerald-600"}
        isEnabled={isCommunity ? false : (api_bot?.enabled ?? false)}
        isExpanded={expandedCards.api_bot}
        onToggleExpand={() => toggleExpand("api_bot")}
        onToggleEnable={(enabled) => {
          if (isCommunity) return
          onChange("api_bot", "enabled", enabled)
          if (enabled) setExpandedCards(prev => ({ ...prev, api_bot: true }))
        }}
        disabled={isCommunity}
        tooltip={isCommunity ? t("apiBot.enterpriseOnly") : undefined}
        badge={isCommunity && (
          <Badge className="bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0 text-[10px] font-bold px-1.5 py-0 gap-1 shadow-sm h-4">
            <Crown className="h-2.5 w-2.5" />
            {t("apiBot.enterpriseBadge")}
          </Badge>
        )}
      >
        {isCommunity && (
          <div className="flex items-center gap-3 px-3 py-2 bg-violet-50 text-violet-700 rounded-lg border border-violet-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
            <Crown className="h-5 w-5 shrink-0" />
            <p className="text-[13px] font-medium">{t("apiBot.enterpriseOnly")}</p>
          </div>
        )}

        <SettingItem label={t("apiBot.endpoint")} badge={t("apiBot.preset")}>
          <CopyableInput
            value={`${env.NEXT_PUBLIC_API_URL}/v1/bot/chat/completions`}
            readOnly
            hint={t("apiBot.endpointNote")}
          />
        </SettingItem>

        <SettingItem label={t("apiBot.apiKey")} required>
          <CopyableInput
            value={api_bot.api_key}
            onChange={(val) => onChange("api_bot", "api_key", val)}
            placeholder={t("apiBot.keyPlaceholder")}
            disabled={!api_bot.enabled}
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
                    e.preventDefault()
                    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
                    let result = "sk-"
                    for (let i = 0; i < 32; i++) {
                      result += chars.charAt(Math.floor(Math.random() * chars.length))
                    }
                    onChange("api_bot", "api_key", result)
                    toast.success(t("apiBot.resetSuccess"))
                  }}
                  disabled={!api_bot.enabled || isCommunity}
                >
                  <RefreshCw className="h-3 w-3" />
                  {t("apiBot.resetKey")}
                </Button>
              </div>
            }
          />
        </SettingItem>

        <SettingItem label={t("apiBot.timeout")}>
          <Input
            type="number"
            value={api_bot.timeout}
            onChange={(e) => onChange("api_bot", "timeout", parseInt(e.target.value))}
            disabled={!api_bot.enabled || isCommunity}
            autoComplete="off"
            className="bg-white rounded-lg h-9 max-w-[200px] text-[13px] placeholder:text-slate-400/80"
            min={1}
            max={300}
          />
        </SettingItem>

        {api_bot.enabled && (
          <InstructionBox
            title={t("apiBot.curlExample")}
            bgColor="bg-emerald-50"
            borderColor="border-emerald-100"
            textColor="text-emerald-700"
            items={[t("apiBot.curlNote")]}
            footer={
              <p className="text-[11px] text-emerald-800/80">
                {t("apiBot.curlNote")}: <a href={`${env.NEXT_PUBLIC_DOCS_URL}/development/bots/chat-api`} target="_blank" className="underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900 transition-colors">{t("apiBot.docLink")}</a>
              </p>
            }
          />
        )}

        {api_bot.enabled && (
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
  -H "Authorization: Bearer ${api_bot.api_key || "YOUR_API_KEY"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${chatModel || ""}",
    "messages": [
      {"role": "user", "content": "Hello"}
    ],
    "stream": true
  }'`
                    navigator.clipboard.writeText(code)
                    toast.success(t("copied"))
                  }}
                >
                  <Copy className="h-3 w-3" />
                  {t("copy")}
                </Button>
              </div>
              <code className="block text-[10px] text-emerald-700 font-mono bg-white p-3 rounded-lg overflow-x-auto whitespace-pre border border-emerald-100">
                {`curl -X POST "${env.NEXT_PUBLIC_API_URL}/v1/bot/chat/completions" \\
  -H "Authorization: Bearer ${api_bot.api_key || "YOUR_API_KEY"}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${chatModel || ""}",
    "messages": [
      {"role": "user", "content": "Hello"}
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
        title={t("feishu.title")}
        description={t("feishu.description")}
        typeBadge={t("feishu.type")}
        icon={<Image src="/icons/feishu.svg" alt="feishu" width={24} height={24} className="rounded" />}
        isEnabled={feishu_app?.enabled ?? false}
        isExpanded={expandedCards.feishu_app}
        onToggleExpand={() => toggleExpand("feishu_app")}
        onToggleEnable={(enabled) => {
          onChange("feishu_app", "enabled", enabled)
          if (enabled) setExpandedCards(prev => ({ ...prev, feishu_app: true }))
        }}
        iconBgColor="bg-slate-50"
        iconTextColor="text-slate-600"
      >
        <SettingItem label={t("feishu.appId")} required>
          <CopyableInput
            value={feishu_app?.app_id || ""}
            onChange={(val) => onChange("feishu_app", "app_id", val)}
            placeholder={t("feishu.appIdPlaceholder")}
            disabled={!feishu_app?.enabled}
          />
        </SettingItem>

        <SettingItem label={t("feishu.appSecret")} required>
          <CopyableInput
            value={feishu_app?.app_secret || ""}
            onChange={(val) => onChange("feishu_app", "app_secret", val)}
            placeholder={t("feishu.appSecretPlaceholder")}
            disabled={!feishu_app?.enabled}
            showPasswordToggle
            isPasswordVisible={showFeishuAppSecret}
            onTogglePasswordVisibility={() => setShowFeishuAppSecret(!showFeishuAppSecret)}
          />
        </SettingItem>

        {feishu_app?.enabled && (
          <InstructionBox
            title={t("feishu.instruction")}
            bgColor="bg-indigo-50"
            borderColor="border-indigo-100"
            textColor="text-indigo-700"
            items={[
              t.raw("feishu.step1"),
              t.raw("feishu.step2"),
              t.raw("feishu.step3"),
              t.raw("feishu.step4"),
              t.raw("feishu.step5"),
              t.raw("feishu.step6")
            ]}
            footer={
              <p className="text-[11px] text-indigo-800/80">
                {t("feishu.instruction")}: <a href={`${env.NEXT_PUBLIC_DOCS_URL}/development/bots/feishu-app`} target="_blank" className="underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900 transition-colors">{t("feishu.docLink")}</a>
              </p>
            }
          />
        )}
      </BotCard>

      {/* 钉钉机器人 */}
      <BotCard
        title={t("dingtalk.title")}
        description={t("dingtalk.description")}
        typeBadge={t("dingtalk.type")}
        icon={<Image src="/icons/dingtalk.svg" alt="dingtalk" width={24} height={24} className="rounded" />}
        isEnabled={dingtalk_app?.enabled ?? false}
        isExpanded={expandedCards.dingtalk_app}
        onToggleExpand={() => toggleExpand("dingtalk_app")}
        onToggleEnable={(enabled) => {
          onChange("dingtalk_app", "enabled", enabled)
          if (enabled) setExpandedCards(prev => ({ ...prev, dingtalk_app: true }))
        }}
        iconBgColor="bg-slate-50"
        iconTextColor="text-slate-600"
      >
        <SettingItem label={t("dingtalk.clientId")} required>
          <CopyableInput
            value={dingtalk_app?.client_id || ""}
            onChange={(val) => onChange("dingtalk_app", "client_id", val)}
            placeholder={t("dingtalk.clientIdPlaceholder")}
            disabled={!dingtalk_app?.enabled}
          />
        </SettingItem>

        <SettingItem label={t("dingtalk.clientSecret")} required>
          <CopyableInput
            value={dingtalk_app?.client_secret || ""}
            onChange={(val) => onChange("dingtalk_app", "client_secret", val)}
            placeholder={t("dingtalk.clientSecretPlaceholder")}
            disabled={!dingtalk_app?.enabled}
            showPasswordToggle
            isPasswordVisible={showDingtalkClientSecret}
            onTogglePasswordVisibility={() => setShowDingtalkClientSecret(!showDingtalkClientSecret)}
          />
        </SettingItem>

        <SettingItem label={t("dingtalk.templateId")} required>
          <CopyableInput
            value={dingtalk_app?.template_id || ""}
            onChange={(val) => onChange("dingtalk_app", "template_id", val)}
            placeholder={t("dingtalk.templateIdPlaceholder")}
            disabled={!dingtalk_app?.enabled}
          />
        </SettingItem>

        {dingtalk_app?.enabled && (
          <InstructionBox
            title={t("dingtalk.instruction")}
            bgColor="bg-orange-50"
            borderColor="border-orange-100"
            textColor="text-orange-700"
            items={[
              t.raw("dingtalk.step1"),
              t.raw("dingtalk.step2"),
              t.raw("dingtalk.step3"),
              t.raw("dingtalk.step4"),
              t.raw("dingtalk.step5")
            ]}
            footer={
              <p className="text-[11px] text-orange-800/80">
                {t("dingtalk.instruction")}: <a href={`${env.NEXT_PUBLIC_DOCS_URL}/development/bots/dingtalk-app`} target="_blank" className="underline decoration-orange-300 underline-offset-2 hover:text-orange-900 transition-colors">{t("dingtalk.docLink")}</a>
              </p>
            }
          />
        )}
      </BotCard>

      {/* 企业微信机器人(应用) */}
      <BotCard
        title={t("wecom.title")}
        description={t("wecom.description")}
        typeBadge={t("wecom.type")}
        icon={<Image src="/icons/wecom.svg" alt="wecom" width={24} height={24} className="rounded" />}
        isEnabled={wecom_app?.enabled ?? false}
        isExpanded={expandedCards.wecom_app}
        onToggleExpand={() => toggleExpand("wecom_app")}
        onToggleEnable={(enabled) => {
          onChange("wecom_app", "enabled", enabled)
          if (enabled) setExpandedCards(prev => ({ ...prev, wecom_app: true }))
        }}
        iconBgColor="bg-slate-50"
        iconTextColor="text-slate-600"
      >
        <SettingItem label={t("wecom.callback")} badge={t("apiBot.preset")}>
          <CopyableInput
            value={`${env.NEXT_PUBLIC_API_URL}/v1/bot/wecom-app?site_id=${siteId}`}
            readOnly
            hint={t("wecom.hint") || ""}
          />
        </SettingItem>

        <SettingItem label={t("wecom.corpId")} required>
          <CopyableInput
            value={wecom_app?.corp_id || ""}
            onChange={(val) => onChange("wecom_app", "corp_id", val)}
            placeholder={t("wecom.corpId")}
            disabled={!wecom_app?.enabled}
          />
        </SettingItem>

        <SettingItem label={t("wecom.agentId")} required>
          <CopyableInput
            value={wecom_app?.agent_id || ""}
            onChange={(val) => onChange("wecom_app", "agent_id", val)}
            placeholder={t("wecom.agentId")}
            disabled={!wecom_app?.enabled}
          />
        </SettingItem>

        <SettingItem label={t("wecom.secret")} required>
          <CopyableInput
            value={wecom_app?.secret || ""}
            onChange={(val) => onChange("wecom_app", "secret", val)}
            placeholder={t("wecom.secret")}
            disabled={!wecom_app?.enabled}
            showPasswordToggle
            isPasswordVisible={showWecomAppSecret}
            onTogglePasswordVisibility={() => setShowWecomAppSecret(!showWecomAppSecret)}
          />
        </SettingItem>

        <SettingItem label={t("wecom.token")} required>
          <CopyableInput
            value={wecom_app?.token || ""}
            onChange={(val) => onChange("wecom_app", "token", val)}
            placeholder={t("wecom.token")}
            disabled={!wecom_app?.enabled}
            showPasswordToggle
            isPasswordVisible={showWecomAppToken}
            onTogglePasswordVisibility={() => setShowWecomAppToken(!showWecomAppToken)}
          />
        </SettingItem>

        <SettingItem label={t("wecom.aesKey")} required>
          <CopyableInput
            value={wecom_app?.encoding_aes_key || ""}
            onChange={(val) => onChange("wecom_app", "encoding_aes_key", val)}
            placeholder={t("wecom.aesKey")}
            disabled={!wecom_app?.enabled}
            showPasswordToggle
            isPasswordVisible={showWecomAppAESKey}
            onTogglePasswordVisibility={() => setShowWecomAppAESKey(!showWecomAppAESKey)}
          />
        </SettingItem>

        {wecom_app?.enabled && (
          <InstructionBox
            title={t("wecom.instruction") || ""}
            bgColor="bg-green-50"
            borderColor="border-green-100"
            textColor="text-green-700"
            items={[
              t.raw("wecom.step1"),
              t.raw("wecom.step2"),
              t.raw("wecom.step3"),
              t.raw("wecom.step4")
            ]}
            footer={
              <p className="text-[11px] text-green-800/80">
                {t("wecom.instruction")}: <a href={`${env.NEXT_PUBLIC_DOCS_URL}/development/bots/wecom-app`} target="_blank" className="underline decoration-green-300 underline-offset-2 hover:text-green-900 transition-colors">{t("wecom.docLink")}</a>
              </p>
            }
          />
        )}
      </BotCard>

      {/* 企业微信客服 */}
      <BotCard
        title={t("wecomKefu.title")}
        description={t("wecomKefu.description")}
        typeBadge={t("wecomKefu.type")}
        icon={<Image src="/icons/wecom.svg" alt="wecom" width={24} height={24} className="rounded" />}
        isEnabled={wecom_kefu?.enabled ?? false}
        isExpanded={expandedCards.wecom_kefu}
        onToggleExpand={() => toggleExpand("wecom_kefu")}
        onToggleEnable={(enabled) => {
          onChange("wecom_kefu", "enabled", enabled)
          if (enabled) setExpandedCards(prev => ({ ...prev, wecom_kefu: true }))
        }}
        iconBgColor="bg-slate-50"
        iconTextColor="text-slate-600"
      >
        <SettingItem label={t("wecomKefu.callback")} badge={t("apiBot.preset")}>
          <CopyableInput
            value={`${env.NEXT_PUBLIC_API_URL}/v1/bot/wecom-kefu?site_id=${siteId}`}
            readOnly
            hint={t("wecomKefu.hint") || ""}
          />
        </SettingItem>

        <SettingItem label={t("wecomKefu.corpId")} required>
          <CopyableInput
            value={wecom_kefu?.corp_id || ""}
            onChange={(val) => onChange("wecom_kefu", "corp_id", val)}
            placeholder={t("wecomKefu.corpId")}
            disabled={!wecom_kefu?.enabled}
          />
        </SettingItem>

        <SettingItem label={t("wecomKefu.welcomeMessage")}>
          <Input
            value={wecom_kefu?.welcome_message || ""}
            onChange={(e) => onChange("wecom_kefu", "welcome_message", e.target.value)}
            placeholder={t("wecomKefu.welcomePlaceholder")}
            disabled={!wecom_kefu?.enabled}
            autoComplete="off"
            className="bg-white rounded-lg h-9 text-[13px] placeholder:text-slate-400/80"
          />
        </SettingItem>

        <SettingItem label={t("wecomKefu.secret")} required>
          <CopyableInput
            value={wecom_kefu?.secret || ""}
            onChange={(val) => onChange("wecom_kefu", "secret", val)}
            placeholder={t("wecomKefu.secret")}
            disabled={!wecom_kefu?.enabled}
            showPasswordToggle
            isPasswordVisible={showWecomKefuSecret}
            onTogglePasswordVisibility={() => setShowWecomKefuSecret(!showWecomKefuSecret)}
          />
        </SettingItem>

        <SettingItem label={t("wecomKefu.token")} required>
          <CopyableInput
            value={wecom_kefu?.token || ""}
            onChange={(val) => onChange("wecom_kefu", "token", val)}
            placeholder={t("wecomKefu.token")}
            disabled={!wecom_kefu?.enabled}
            showPasswordToggle
            isPasswordVisible={showWecomKefuToken}
            onTogglePasswordVisibility={() => setShowWecomKefuToken(!showWecomKefuToken)}
          />
        </SettingItem>

        <SettingItem label={t("wecomKefu.aesKey")} required>
          <CopyableInput
            value={wecom_kefu?.encoding_aes_key || ""}
            onChange={(val) => onChange("wecom_kefu", "encoding_aes_key", val)}
            placeholder={t("wecomKefu.aesKey")}
            disabled={!wecom_kefu?.enabled}
            showPasswordToggle
            isPasswordVisible={showWecomKefuAESKey}
            onTogglePasswordVisibility={() => setShowWecomKefuAESKey(!showWecomKefuAESKey)}
          />
        </SettingItem>

        {wecom_kefu?.enabled && (
          <InstructionBox
            title={t("wecomKefu.instruction") || ""}
            bgColor="bg-teal-50"
            borderColor="border-teal-100"
            textColor="text-teal-700"
            items={[
              t.raw("wecomKefu.step1"),
              t.raw("wecomKefu.step2"),
              t.raw("wecomKefu.step3"),
              t.raw("wecomKefu.step4"),
              t.raw("wecomKefu.step5")
            ]}
            footer={
              <p className="text-[11px] text-teal-800/80">
                {t("wecomKefu.instruction")}: <a href={`${env.NEXT_PUBLIC_DOCS_URL}/development/bots/wecom-kefu`} target="_blank" className="underline decoration-teal-300 underline-offset-2 hover:text-teal-900 transition-colors">{t("wecomKefu.docLink")}</a>
              </p>
            }
          />
        )}
      </BotCard>

      {/* 企业微信智能机器人 */}
      <BotCard
        title={t("wecomSmart.title")}
        description={t("wecomSmart.description")}
        typeBadge={t("wecomSmart.type")}
        icon={<Image src="/icons/wecom.svg" alt="wecom" width={24} height={24} className="rounded" />}
        isEnabled={wecom_smart?.enabled ?? false}
        isExpanded={expandedCards.wecom_smart}
        onToggleExpand={() => toggleExpand("wecom_smart")}
        onToggleEnable={(enabled) => {
          onChange("wecom_smart", "enabled", enabled)
          if (enabled) setExpandedCards(prev => ({ ...prev, wecom_smart: true }))
        }}
        iconBgColor="bg-slate-50"
        iconTextColor="text-slate-600"
      >
        <SettingItem label={t("wecomSmart.botId")} required>
          <CopyableInput
            value={wecom_smart?.bot_id || ""}
            onChange={(val) => onChange("wecom_smart", "bot_id", val)}
            placeholder={t("wecomSmart.botIdPlaceholder")}
            disabled={!wecom_smart?.enabled}
          />
        </SettingItem>

        <SettingItem label={t("wecomSmart.secret")} required>
          <CopyableInput
            value={wecom_smart?.secret || ""}
            onChange={(val) => onChange("wecom_smart", "secret", val)}
            placeholder={t("wecomSmart.secretPlaceholder")}
            disabled={!wecom_smart?.enabled}
            showPasswordToggle
            isPasswordVisible={showWecomSmartSecret}
            onTogglePasswordVisibility={() => setShowWecomSmartSecret(!showWecomSmartSecret)}
          />
        </SettingItem>

        {wecom_smart?.enabled && (
          <InstructionBox
            title={t("wecomSmart.instruction") || ""}
            bgColor="bg-sky-50"
            borderColor="border-sky-100"
            textColor="text-sky-700"
            items={[
              t.raw("wecomSmart.step1"),
              t.raw("wecomSmart.step2"),
              t.raw("wecomSmart.step3")
            ]}
            footer={
              <p className="text-[11px] text-sky-800/80">
                {t("wecomSmart.instruction")}: <a href={`${env.NEXT_PUBLIC_DOCS_URL}/development/bots/wecom-smart`} target="_blank" className="underline decoration-sky-300 underline-offset-2 hover:text-sky-900 transition-colors">{t("wecomSmart.docLink")}</a>
              </p>
            }
          />
        )}
      </BotCard>

      {/* Discord 机器人 */}
      <BotCard
        title={t("discord.title")}
        description={t("discord.description")}
        typeBadge={t("discord.type")}
        icon={<MessageSquare className="h-4 w-4" />}
        isEnabled={false}
        isExpanded={expandedCards.discordApp}
        onToggleExpand={() => toggleExpand("discordApp")}
        onToggleEnable={() => { }}
        disabled={true}
        badge={<Badge variant="outline" className="text-[9px] font-bold px-1.5 h-4 bg-slate-50 text-slate-400">{t("discord.badge")}</Badge>}
      >
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <div className="text-slate-400 text-sm italic">
            {t("discord.comingSoon")}
          </div>
          <p className="text-[10px] text-slate-400/80">
            {t("apiBot.curlNote")}: <a href={`${env.NEXT_PUBLIC_DOCS_URL}/development/bots/discord-app`} target="_blank" className="underline underline-offset-2 hover:text-slate-600 transition-colors">{t("discord.docLink")}</a>
          </p>
        </div>
      </BotCard>

      {/* Telegram 机器人 */}
      <BotCard
        title={t("telegram.title")}
        description={t("telegram.description")}
        typeBadge={t("telegram.type")}
        icon={<Send className="h-4 w-4" />}
        isEnabled={telegram_app?.enabled ?? false}
        isExpanded={expandedCards.telegram_app}
        onToggleExpand={() => toggleExpand("telegram_app")}
        onToggleEnable={(enabled) => {
          onChange("telegram_app", "enabled", enabled)
          if (enabled) setExpandedCards(prev => ({ ...prev, telegram_app: true }))
        }}
        iconBgColor="bg-sky-50"
        iconTextColor="text-sky-600"
      >
        <SettingItem label={t("telegram.botToken")} required>
          <CopyableInput
            value={telegram_app?.bot_token || ""}
            onChange={(val) => onChange("telegram_app", "bot_token", val)}
            placeholder={t("telegram.botTokenPlaceholder")}
            disabled={!telegram_app?.enabled}
            showPasswordToggle
            isPasswordVisible={showTelegramBotToken}
            onTogglePasswordVisibility={() => setShowTelegramBotToken(!showTelegramBotToken)}
          />
        </SettingItem>

        <SettingItem label={t("telegram.apiBaseUrl")}>
          <CopyableInput
            value={telegram_app?.api_base_url || ""}
            onChange={(val) => onChange("telegram_app", "api_base_url", val)}
            placeholder={t("telegram.apiBaseUrlPlaceholder")}
            disabled={!telegram_app?.enabled}
            hint={t("telegram.apiBaseUrlHint")}
          />
        </SettingItem>

        <SettingItem label={t("telegram.allowedUserIds")}>
          <CopyableInput
            value={telegram_app?.allowed_user_ids || ""}
            onChange={(val) => onChange("telegram_app", "allowed_user_ids", val)}
            placeholder={t("telegram.allowedUserIdsPlaceholder")}
            disabled={!telegram_app?.enabled}
            hint={t("telegram.allowedUserIdsHint")}
          />
        </SettingItem>

        {telegram_app?.enabled && (
          <InstructionBox
            title={t("telegram.instruction")}
            bgColor="bg-sky-50"
            borderColor="border-sky-100"
            textColor="text-sky-700"
            items={[
              t.raw("telegram.step1"),
              t.raw("telegram.step2"),
              t.raw("telegram.step3"),
              t.raw("telegram.step4"),
              t.raw("telegram.step5")
            ]}
            footer={
              <p className="text-[11px] text-sky-800/80">
                {t("telegram.instruction")}: <a href={`${env.NEXT_PUBLIC_DOCS_URL}/development/bots/telegram-app`} target="_blank" className="underline decoration-sky-300 underline-offset-2 hover:text-sky-900 transition-colors">{t("telegram.docLink")}</a>
              </p>
            }
          />
        )}
      </BotCard>

      {/* 预览挂件 */}
      {showPreview && web_widget.enabled && (
        <ChatWidgetPreview
          title={web_widget.title}
          welcomeMessage={web_widget.welcome_message}
          primaryColor={web_widget.primary_color}
          position={web_widget.position as "left" | "right"}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}
