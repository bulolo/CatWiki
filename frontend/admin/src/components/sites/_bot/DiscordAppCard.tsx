// Copyright 2026 CatWiki Authors
//
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://github.com/CatWiki/CatWiki/blob/main/LICENSE

"use client"

import { useTranslations } from "next-intl"
import { Badge } from "@/components/ui"
import { MessageSquare } from "lucide-react"
import { env } from "@/lib/env"
import { BotCard } from "./BotPrimitives"

interface DiscordAppCardProps {
  isExpanded: boolean
  onToggleExpand: () => void
}

export function DiscordAppCard({ isExpanded, onToggleExpand }: DiscordAppCardProps) {
  const t = useTranslations("SiteBot")
  return (
    <BotCard
      title={t("discord.title")}
      description={t("discord.description")}
      typeBadge={t("discord.type")}
      icon={<MessageSquare className="h-4 w-4" />}
      isEnabled={false}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
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
  )
}
