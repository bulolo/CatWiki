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

interface WecomSmartCardProps {
  wecom_smart: BotConfig["wecom_smart"]
  onChange: BotChange
  isExpanded: boolean
  onToggleExpand: () => void
  setExpandedCards: Dispatch<SetStateAction<Record<string, boolean>>>
  visibleSecrets: Record<string, boolean>
  toggleSecret: (key: string) => void
}

export function WecomSmartCard({
  wecom_smart,
  onChange,
  isExpanded,
  onToggleExpand,
  setExpandedCards,
  visibleSecrets,
  toggleSecret,
}: WecomSmartCardProps) {
  const t = useTranslations("SiteBot")
  return (
    <BotCard
      title={t("wecomSmart.title")}
      description={t("wecomSmart.description")}
      typeBadge={t("wecomSmart.type")}
      icon={<Image src="/icons/wecom.svg" alt="wecom" width={24} height={24} className="rounded" />}
      isEnabled={wecom_smart?.enabled ?? false}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
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
          isPasswordVisible={!!visibleSecrets.wecomSmartSecret}
          onTogglePasswordVisibility={() => toggleSecret("wecomSmartSecret")}
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
  )
}
