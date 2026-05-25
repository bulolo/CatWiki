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

import { initialConfigs, type BotConfig } from "@/types/settings"

import { isRecord } from "@/lib/utils"

const mergeSection = <K extends keyof BotConfig>(baseSection: BotConfig[K], rawValue: unknown): BotConfig[K] => {
  if (!isRecord(rawValue) || !baseSection) {
    return baseSection
  }
  // 使用简单的键值覆盖，减少类型断言
  const result = { ...baseSection } as Record<string, unknown>
  for (const key in rawValue) {
    if (key in (baseSection as object)) {
      const val = rawValue[key]
      if (val !== undefined && val !== null) {
        result[key] = val
      }
    }
  }
  return result as BotConfig[K]
}

export function mergeSiteBotConfig(raw: unknown): BotConfig {
  const base = initialConfigs.bot_config
  if (!isRecord(raw)) return base

  return {
    web_widget: mergeSection<"web_widget">(base.web_widget, raw.web_widget),
    api_bot: base.api_bot,  // api_bot 由 EE API 单独加载，不从主表 merge
    wecom_smart: mergeSection<"wecom_smart">(base.wecom_smart, raw.wecom_smart),
    feishu_app: mergeSection<"feishu_app">(base.feishu_app, raw.feishu_app),
    dingtalk_app: mergeSection<"dingtalk_app">(base.dingtalk_app, raw.dingtalk_app),
    wecom_kefu: mergeSection<"wecom_kefu">(base.wecom_kefu, raw.wecom_kefu),
    wecom_app: mergeSection<"wecom_app">(base.wecom_app, raw.wecom_app),
    telegram_app: mergeSection<"telegram_app">(base.telegram_app, raw.telegram_app),
  }
}
