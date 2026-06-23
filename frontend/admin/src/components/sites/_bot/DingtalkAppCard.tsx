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
import Image from "next/image"
import { env } from "@/lib/env"
import type { BotConfig } from "@/types/settings"
import { BotCard, CopyableInput, InstructionBox, SettingItem } from "./BotPrimitives"
import type { BotChange } from "./BotPrimitives"

interface DingtalkAppCardProps {
  dingtalk_app: BotConfig["dingtalk_app"]
  onChange: BotChange
  isExpanded: boolean
  onToggleExpand: () => void
  setExpandedCards: Dispatch<SetStateAction<Record<string, boolean>>>
  visibleSecrets: Record<string, boolean>
  toggleSecret: (key: string) => void
}

export function DingtalkAppCard({
  dingtalk_app,
  onChange,
  isExpanded,
  onToggleExpand,
  setExpandedCards,
  visibleSecrets,
  toggleSecret,
}: DingtalkAppCardProps) {
  const t = useTranslations("SiteBot")
  return (
    <BotCard
      title={t("dingtalk.title")}
      description={t("dingtalk.description")}
      typeBadge={t("dingtalk.type")}
      icon={<Image src="/icons/dingtalk.svg" alt="dingtalk" width={24} height={24} className="rounded" />}
      isEnabled={dingtalk_app?.enabled ?? false}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
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
          isPasswordVisible={!!visibleSecrets.dingtalkClientSecret}
          onTogglePasswordVisibility={() => toggleSecret("dingtalkClientSecret")}
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
  )
}
