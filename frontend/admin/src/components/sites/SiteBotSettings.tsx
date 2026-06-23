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

import { useState } from "react"
import { ChatWidgetPreview } from "@/components/features/ChatWidgetPreview"
import type { BotConfig } from "@/types/settings"
import { useHealth } from "@/hooks/useHealth"
import { WebWidgetCard } from "./_bot/WebWidgetCard"
import { ApiBotCard } from "./_bot/ApiBotCard"
import { FeishuAppCard } from "./_bot/FeishuAppCard"
import { DingtalkAppCard } from "./_bot/DingtalkAppCard"
import { WecomAppCard } from "./_bot/WecomAppCard"
import { WecomKefuCard } from "./_bot/WecomKefuCard"
import { WecomSmartCard } from "./_bot/WecomSmartCard"
import { DiscordAppCard } from "./_bot/DiscordAppCard"
import { TelegramAppCard } from "./_bot/TelegramAppCard"

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
  const [showPreview, setShowPreview] = useState(false)
  // 各密钥/敏感字段的明文可见性合并为一个 map，避免 11 个独立 useState 触发整树重渲染
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({})
  const toggleSecret = (key: string) => setVisibleSecrets(prev => ({ ...prev, [key]: !prev[key] }))
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
      <WebWidgetCard
        web_widget={web_widget}
        onChange={onChange}
        siteId={siteId}
        isExpanded={expandedCards.web_widget}
        onToggleExpand={() => toggleExpand("web_widget")}
        setExpandedCards={setExpandedCards}
        showPreview={showPreview}
        setShowPreview={setShowPreview}
      />

      {/* 问答机器人 */}
      <ApiBotCard
        api_bot={api_bot}
        onChange={onChange}
        isCommunity={isCommunity}
        chatModel={chatModel}
        isExpanded={expandedCards.api_bot}
        onToggleExpand={() => toggleExpand("api_bot")}
        setExpandedCards={setExpandedCards}
        visibleSecrets={visibleSecrets}
        toggleSecret={toggleSecret}
      />

      {/* 飞书机器人 */}
      <FeishuAppCard
        feishu_app={feishu_app}
        onChange={onChange}
        isExpanded={expandedCards.feishu_app}
        onToggleExpand={() => toggleExpand("feishu_app")}
        setExpandedCards={setExpandedCards}
        visibleSecrets={visibleSecrets}
        toggleSecret={toggleSecret}
      />

      {/* 钉钉机器人 */}
      <DingtalkAppCard
        dingtalk_app={dingtalk_app}
        onChange={onChange}
        isExpanded={expandedCards.dingtalk_app}
        onToggleExpand={() => toggleExpand("dingtalk_app")}
        setExpandedCards={setExpandedCards}
        visibleSecrets={visibleSecrets}
        toggleSecret={toggleSecret}
      />

      {/* 企业微信机器人(应用) */}
      <WecomAppCard
        wecom_app={wecom_app}
        onChange={onChange}
        siteId={siteId}
        isExpanded={expandedCards.wecom_app}
        onToggleExpand={() => toggleExpand("wecom_app")}
        setExpandedCards={setExpandedCards}
        visibleSecrets={visibleSecrets}
        toggleSecret={toggleSecret}
      />

      {/* 企业微信客服 */}
      <WecomKefuCard
        wecom_kefu={wecom_kefu}
        onChange={onChange}
        siteId={siteId}
        isExpanded={expandedCards.wecom_kefu}
        onToggleExpand={() => toggleExpand("wecom_kefu")}
        setExpandedCards={setExpandedCards}
        visibleSecrets={visibleSecrets}
        toggleSecret={toggleSecret}
      />

      {/* 企业微信智能机器人 */}
      <WecomSmartCard
        wecom_smart={wecom_smart}
        onChange={onChange}
        isExpanded={expandedCards.wecom_smart}
        onToggleExpand={() => toggleExpand("wecom_smart")}
        setExpandedCards={setExpandedCards}
        visibleSecrets={visibleSecrets}
        toggleSecret={toggleSecret}
      />

      {/* Discord 机器人 */}
      <DiscordAppCard
        isExpanded={expandedCards.discordApp}
        onToggleExpand={() => toggleExpand("discordApp")}
      />

      {/* Telegram 机器人 */}
      <TelegramAppCard
        telegram_app={telegram_app}
        onChange={onChange}
        isExpanded={expandedCards.telegram_app}
        onToggleExpand={() => toggleExpand("telegram_app")}
        setExpandedCards={setExpandedCards}
        visibleSecrets={visibleSecrets}
        toggleSecret={toggleSecret}
      />

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
