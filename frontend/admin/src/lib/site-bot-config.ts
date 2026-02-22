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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

const mergeSection = <K extends keyof BotConfig>(baseSection: BotConfig[K], rawValue: unknown): BotConfig[K] => {
  if (!isRecord(rawValue)) {
    return baseSection
  }
  // 使用简单的键值覆盖，减少类型断言
  const result = { ...baseSection } as Record<string, unknown>
  for (const key in rawValue) {
    if (key in baseSection) {
      const val = rawValue[key]
      if (val !== undefined && val !== null) {
        result[key] = val
      }
    }
  }
  return result as BotConfig[K]
}

export function mergeSiteBotConfig(raw: unknown): BotConfig {
  const base = initialConfigs.botConfig
  if (!isRecord(raw)) return base

  return {
    webWidget: mergeSection<"webWidget">(base.webWidget, raw.webWidget),
    apiBot: mergeSection<"apiBot">(base.apiBot, raw.apiBot),
    wecomSmartRobot: mergeSection<"wecomSmartRobot">(base.wecomSmartRobot, raw.wecomSmartRobot),
    feishuBot: mergeSection<"feishuBot">(base.feishuBot, raw.feishuBot),
    dingtalkBot: mergeSection<"dingtalkBot">(base.dingtalkBot, raw.dingtalkBot),
  }
}
