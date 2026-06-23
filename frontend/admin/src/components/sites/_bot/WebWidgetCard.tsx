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
import { Button, Input } from "@/components/ui"
import { Bot, Copy, Eye, EyeOff } from "lucide-react"
import { cn, copyToClipboard } from "@/lib/utils"
import { toast } from "sonner"
import { env } from "@/lib/env"
import type { BotConfig } from "@/types/settings"
import { BotCard, InstructionBox, SettingItem } from "./BotPrimitives"
import type { BotChange } from "./BotPrimitives"

interface WebWidgetCardProps {
  web_widget: BotConfig["web_widget"]
  onChange: BotChange
  siteId: number
  isExpanded: boolean
  onToggleExpand: () => void
  setExpandedCards: Dispatch<SetStateAction<Record<string, boolean>>>
  showPreview: boolean
  setShowPreview: Dispatch<SetStateAction<boolean>>
}

export function WebWidgetCard({
  web_widget,
  onChange,
  siteId,
  isExpanded,
  onToggleExpand,
  setExpandedCards,
  showPreview,
  setShowPreview,
}: WebWidgetCardProps) {
  const t = useTranslations("SiteBot")
  return (
    <BotCard
      title={t("webWidget.title")}
      description={t("webWidget.description")}
      typeBadge={t("webWidget.type")}
      icon={<Bot className="h-4 w-4" />}
      isEnabled={web_widget?.enabled ?? false}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
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
                onClick={async () => {
                  const code = `<script \n  src="${env.NEXT_PUBLIC_CLIENT_URL}/widget.js"\n  data-site-id="${siteId}"\n></script>`
                  if (await copyToClipboard(code)) toast.success(t("copied"))
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </BotCard>
  )
}
