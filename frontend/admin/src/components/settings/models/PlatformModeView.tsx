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

import { useTranslations } from "next-intl"
import { PlugZap } from "lucide-react"
import { useSettings } from "@/contexts/SettingsContext"
import { ModelType } from "@/types/settings"

interface PlatformModeViewProps {
  type: ModelType
}

export function PlatformModeView({ type }: PlatformModeViewProps) {
  const t = useTranslations("Models")
  const { platformDefaults } = useSettings()

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 text-center space-y-3 animate-in fade-in duration-300">
      <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
        <PlugZap className="w-6 h-6" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-blue-900">{t("hostedOnPlatform")}</h3>
        <p className="text-xs text-blue-700 mt-1 max-w-xs mx-auto">
          {t("usingSharedResource")}
        </p>
      </div>

      {platformDefaults?.[type]?.model && (
        <div className="inline-block bg-white/60 px-3 py-1 rounded text-xs text-blue-800 border border-blue-100">
          {t("currentModel")} <span className="font-mono font-semibold">{platformDefaults[type].model}</span>
        </div>
      )}
    </div>
  )
}
