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
import { Send } from "lucide-react"
import { env } from "@/lib/env"
import type { BotConfig } from "@/types/settings"
import { BotCard, CopyableInput, InstructionBox, SettingItem } from "./BotPrimitives"
import type { BotChange } from "./BotPrimitives"

interface TelegramAppCardProps {
  telegram_app: BotConfig["telegram_app"]
  onChange: BotChange
  isExpanded: boolean
  onToggleExpand: () => void
  setExpandedCards: Dispatch<SetStateAction<Record<string, boolean>>>
  visibleSecrets: Record<string, boolean>
  toggleSecret: (key: string) => void
}

export function TelegramAppCard({
  telegram_app,
  onChange,
  isExpanded,
  onToggleExpand,
  setExpandedCards,
  visibleSecrets,
  toggleSecret,
}: TelegramAppCardProps) {
  const t = useTranslations("SiteBot")
  return (
    <BotCard
      title={t("telegram.title")}
      description={t("telegram.description")}
      typeBadge={t("telegram.type")}
      icon={<Send className="h-4 w-4" />}
      isEnabled={telegram_app?.enabled ?? false}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
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
          isPasswordVisible={!!visibleSecrets.telegramBotToken}
          onTogglePasswordVisibility={() => toggleSecret("telegramBotToken")}
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
  )
}
