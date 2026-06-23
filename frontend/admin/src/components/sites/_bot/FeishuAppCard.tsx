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

interface FeishuAppCardProps {
  feishu_app: BotConfig["feishu_app"]
  onChange: BotChange
  isExpanded: boolean
  onToggleExpand: () => void
  setExpandedCards: Dispatch<SetStateAction<Record<string, boolean>>>
  visibleSecrets: Record<string, boolean>
  toggleSecret: (key: string) => void
}

export function FeishuAppCard({
  feishu_app,
  onChange,
  isExpanded,
  onToggleExpand,
  setExpandedCards,
  visibleSecrets,
  toggleSecret,
}: FeishuAppCardProps) {
  const t = useTranslations("SiteBot")
  return (
    <BotCard
      title={t("feishu.title")}
      description={t("feishu.description")}
      typeBadge={t("feishu.type")}
      icon={<Image src="/icons/feishu.svg" alt="feishu" width={24} height={24} className="rounded" />}
      isEnabled={feishu_app?.enabled ?? false}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
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
          isPasswordVisible={!!visibleSecrets.feishuAppSecret}
          onTogglePasswordVisibility={() => toggleSecret("feishuAppSecret")}
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
  )
}
