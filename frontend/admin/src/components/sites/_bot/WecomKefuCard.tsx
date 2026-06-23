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
import { Input } from "@/components/ui"
import { env } from "@/lib/env"
import type { BotConfig } from "@/types/settings"
import { BotCard, CopyableInput, InstructionBox, SettingItem } from "./BotPrimitives"
import type { BotChange } from "./BotPrimitives"

interface WecomKefuCardProps {
  wecom_kefu: BotConfig["wecom_kefu"]
  onChange: BotChange
  siteId: number
  isExpanded: boolean
  onToggleExpand: () => void
  setExpandedCards: Dispatch<SetStateAction<Record<string, boolean>>>
  visibleSecrets: Record<string, boolean>
  toggleSecret: (key: string) => void
}

export function WecomKefuCard({
  wecom_kefu,
  onChange,
  siteId,
  isExpanded,
  onToggleExpand,
  setExpandedCards,
  visibleSecrets,
  toggleSecret,
}: WecomKefuCardProps) {
  const t = useTranslations("SiteBot")
  return (
    <BotCard
      title={t("wecomKefu.title")}
      description={t("wecomKefu.description")}
      typeBadge={t("wecomKefu.type")}
      icon={<Image src="/icons/wecom.svg" alt="wecom" width={24} height={24} className="rounded" />}
      isEnabled={wecom_kefu?.enabled ?? false}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
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
          isPasswordVisible={!!visibleSecrets.wecomKefuSecret}
          onTogglePasswordVisibility={() => toggleSecret("wecomKefuSecret")}
        />
      </SettingItem>

      <SettingItem label={t("wecomKefu.token")} required>
        <CopyableInput
          value={wecom_kefu?.token || ""}
          onChange={(val) => onChange("wecom_kefu", "token", val)}
          placeholder={t("wecomKefu.token")}
          disabled={!wecom_kefu?.enabled}
          showPasswordToggle
          isPasswordVisible={!!visibleSecrets.wecomKefuToken}
          onTogglePasswordVisibility={() => toggleSecret("wecomKefuToken")}
        />
      </SettingItem>

      <SettingItem label={t("wecomKefu.aesKey")} required>
        <CopyableInput
          value={wecom_kefu?.encoding_aes_key || ""}
          onChange={(val) => onChange("wecom_kefu", "encoding_aes_key", val)}
          placeholder={t("wecomKefu.aesKey")}
          disabled={!wecom_kefu?.enabled}
          showPasswordToggle
          isPasswordVisible={!!visibleSecrets.wecomKefuAESKey}
          onTogglePasswordVisibility={() => toggleSecret("wecomKefuAESKey")}
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
  )
}
