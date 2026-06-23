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

interface WecomAppCardProps {
  wecom_app: BotConfig["wecom_app"]
  onChange: BotChange
  siteId: number
  isExpanded: boolean
  onToggleExpand: () => void
  setExpandedCards: Dispatch<SetStateAction<Record<string, boolean>>>
  visibleSecrets: Record<string, boolean>
  toggleSecret: (key: string) => void
}

export function WecomAppCard({
  wecom_app,
  onChange,
  siteId,
  isExpanded,
  onToggleExpand,
  setExpandedCards,
  visibleSecrets,
  toggleSecret,
}: WecomAppCardProps) {
  const t = useTranslations("SiteBot")
  return (
    <BotCard
      title={t("wecom.title")}
      description={t("wecom.description")}
      typeBadge={t("wecom.type")}
      icon={<Image src="/icons/wecom.svg" alt="wecom" width={24} height={24} className="rounded" />}
      isEnabled={wecom_app?.enabled ?? false}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
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
          isPasswordVisible={!!visibleSecrets.wecomAppSecret}
          onTogglePasswordVisibility={() => toggleSecret("wecomAppSecret")}
        />
      </SettingItem>

      <SettingItem label={t("wecom.token")} required>
        <CopyableInput
          value={wecom_app?.token || ""}
          onChange={(val) => onChange("wecom_app", "token", val)}
          placeholder={t("wecom.token")}
          disabled={!wecom_app?.enabled}
          showPasswordToggle
          isPasswordVisible={!!visibleSecrets.wecomAppToken}
          onTogglePasswordVisibility={() => toggleSecret("wecomAppToken")}
        />
      </SettingItem>

      <SettingItem label={t("wecom.aesKey")} required>
        <CopyableInput
          value={wecom_app?.encoding_aes_key || ""}
          onChange={(val) => onChange("wecom_app", "encoding_aes_key", val)}
          placeholder={t("wecom.aesKey")}
          disabled={!wecom_app?.enabled}
          showPasswordToggle
          isPasswordVisible={!!visibleSecrets.wecomAppAESKey}
          onTogglePasswordVisibility={() => toggleSecret("wecomAppAESKey")}
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
  )
}
