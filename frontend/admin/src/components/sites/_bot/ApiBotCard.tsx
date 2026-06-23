// Copyright 2026 CatWiki Authors
//
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://github.com/CatWiki/CatWiki/blob/main/LICENSE

"use client"

import type { Dispatch, SetStateAction } from "react"
import { useTranslations } from "next-intl"
import { Badge, Button, Input } from "@/components/ui"
import { Code, Copy, RefreshCw, Crown } from "lucide-react"
import { copyToClipboard } from "@/lib/utils"
import { toast } from "sonner"
import { env } from "@/lib/env"
import type { BotConfig } from "@/types/settings"
import { BotCard, CopyableInput, InstructionBox, SettingItem } from "./BotPrimitives"
import type { BotChange } from "./BotPrimitives"

interface ApiBotCardProps {
  api_bot: BotConfig["api_bot"]
  onChange: BotChange
  isCommunity: boolean
  chatModel?: string
  isExpanded: boolean
  onToggleExpand: () => void
  setExpandedCards: Dispatch<SetStateAction<Record<string, boolean>>>
  visibleSecrets: Record<string, boolean>
  toggleSecret: (key: string) => void
}

export function ApiBotCard({
  api_bot,
  onChange,
  isCommunity,
  chatModel,
  isExpanded,
  onToggleExpand,
  setExpandedCards,
  visibleSecrets,
  toggleSecret,
}: ApiBotCardProps) {
  const t = useTranslations("SiteBot")
  return (
    <BotCard
      title={t("apiBot.title")}
      description={t("apiBot.description")}
      typeBadge={t("apiBot.type")}
      icon={<Code className="h-4 w-4" />}
      iconBgColor={isCommunity ? "bg-slate-50" : "bg-emerald-50"}
      iconTextColor={isCommunity ? "text-slate-400" : "text-emerald-600"}
      isEnabled={isCommunity ? false : (api_bot?.enabled ?? false)}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
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
          isPasswordVisible={!!visibleSecrets.key}
          onTogglePasswordVisibility={() => toggleSecret("key")}
          generateAction={
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] text-primary hover:text-primary/80 px-1 gap-1 font-bold"
                onClick={(e) => {
                  e.preventDefault()
                  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
                  // 用 CSPRNG 生成 API Key（取代 Math.random）
                  const bytes = new Uint8Array(32)
                  crypto.getRandomValues(bytes)
                  let result = "sk-"
                  for (let i = 0; i < 32; i++) {
                    result += chars.charAt(bytes[i] % chars.length)
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
                onClick={async () => {
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
                  if (await copyToClipboard(code)) toast.success(t("copied"))
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
  )
}
