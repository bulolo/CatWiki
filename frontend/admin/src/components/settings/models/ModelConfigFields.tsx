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

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from "next-intl"
import { Eye } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useState } from "react"

interface ModelConfigFieldsProps {
  type: "chat" | "embedding" | "rerank" | "vl"
  config: {
    model: string
    api_key: string
    base_url: string
    dimension?: number | null
    is_vision?: boolean
    extra_body?: Record<string, any> | null
  }
  onUpdate: (type: "chat" | "embedding" | "rerank" | "vl", field: string, value: any) => void
}

export function ModelConfigFields({ type, config, onUpdate }: ModelConfigFieldsProps) {
  const t = useTranslations("Models")
  const isVisionEnabled = config.is_vision ?? false;

  const toJsonText = (v: Record<string, any> | null | undefined) =>
    v && Object.keys(v).length > 0 ? JSON.stringify(v, null, 2) : ""

  const [extraBodyText, setExtraBodyText] = useState(() => toJsonText(config.extra_body))
  const [jsonError, setJsonError] = useState("")

  const handleExtraBodyChange = (text: string) => {
    setExtraBodyText(text)
    if (text.trim() === "") {
      setJsonError("")
      onUpdate(type, "extra_body", null)
      return
    }
    try {
      const parsed = JSON.parse(text)
      setJsonError("")
      onUpdate(type, "extra_body", parsed)
    } catch {
      setJsonError(t("extraBodyJsonError"))
    }
  }

  const handleVisionChange = (checked: boolean) => {
    onUpdate(type, "is_vision", checked);
  };

  return (
    <>
      {type === "embedding" && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 flex gap-3 text-amber-900 text-sm">
          <div className="shrink-0 mt-0.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-amber-600"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-amber-800">{t("caution")}</p>
            <p>{t("vectorModelWarning")}</p>
            <p>{t("revectorizeTip")}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">{t("protocolType")}</label>
          <div className="flex items-center h-10 px-3 rounded-md border border-slate-200 bg-slate-50 text-slate-500 text-sm">
            {t("openAICompatible")}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">{t("modelName")}</label>
          <Input
            value={config.model}
            onChange={(e) => onUpdate(type, "model", e.target.value)}
            placeholder={t("modelPlaceholder")}
            className="bg-white"
            autoComplete="new-password"
            name="custom_model_disable_autofill"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">API Key</label>
        <Input
          type="password"
          value={config.api_key}
          onChange={(e) => onUpdate(type, "api_key", e.target.value)}
          placeholder="sk-..."
          className="bg-white font-mono"
          autoComplete="new-password"
          name="custom_api_key_disable_autofill"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">API Base URL</label>
        <Input
          value={config.base_url}
          onChange={(e) => onUpdate(type, "base_url", e.target.value)}
          placeholder="https://api.openai.com/v1"
          className="bg-white font-mono"
        />
      </div>

      {type === "embedding" && (
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">{t("dimension")}</label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={config.dimension || ""}
              disabled={true}
              placeholder={t("detecting")}
              className="bg-slate-50 font-mono text-slate-500"
            />
          </div>
          <p className="text-xs text-slate-500">
            {t("dimensionTip")}
          </p>
        </div>
      )}
      {type === "chat" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-700">{t("extraBody")}</label>
              <button
                type="button"
                onClick={() => {
                  try {
                    const formatted = JSON.stringify(JSON.parse(extraBodyText), null, 2)
                    setExtraBodyText(formatted)
                    setJsonError("")
                  } catch {
                    setJsonError(t("extraBodyJsonError"))
                  }
                }}
                disabled={!extraBodyText.trim()}
                className="text-xs text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                {t("extraBodyFormat")}
              </button>
            </div>
            <Textarea
              value={extraBodyText}
              onChange={(e) => handleExtraBodyChange(e.target.value)}
              placeholder={'{\n  "chat_template_kwargs": {\n    "enable_thinking": false\n  }\n}'}
              className="bg-white font-mono text-xs min-h-[100px] resize-y"
              spellCheck={false}
            />
            {jsonError && <p className="text-xs text-red-500">{jsonError}</p>}
            <div className="text-xs text-slate-400 space-y-1.5">
              <p>{t("extraBodyTip")}</p>
              <div className="space-y-1">
                <p className="text-slate-500">{t("extraBodyTipVllm")}</p>
                <pre
                  className="bg-slate-100 hover:bg-slate-200 rounded px-2 py-1 text-[11px] text-slate-600 font-mono leading-relaxed cursor-pointer transition-colors"
                  title={t("extraBodyClickToFill")}
                  onClick={() => handleExtraBodyChange(JSON.stringify({"chat_template_kwargs": {"enable_thinking": false}}, null, 2))}
                >{`{"chat_template_kwargs": {"enable_thinking": false}}`}</pre>
                <p className="text-slate-500">{t("extraBodyTipHosted")}</p>
                <pre
                  className="bg-slate-100 hover:bg-slate-200 rounded px-2 py-1 text-[11px] text-slate-600 font-mono leading-relaxed cursor-pointer transition-colors"
                  title={t("extraBodyClickToFill")}
                  onClick={() => handleExtraBodyChange(JSON.stringify({"thinking": {"type": "disabled"}}, null, 2))}
                >{`{"thinking": {"type": "disabled"}}`}</pre>
                <p className="text-slate-500">{t("extraBodyTipHunyuan")}</p>
                <pre
                  className="bg-slate-100 hover:bg-slate-200 rounded px-2 py-1 text-[11px] text-slate-600 font-mono leading-relaxed cursor-pointer transition-colors"
                  title={t("extraBodyClickToFill")}
                  onClick={() => handleExtraBodyChange(JSON.stringify({"enable_thinking": false}, null, 2))}
                >{`{"enable_thinking": false}`}</pre>
              </div>
            </div>
          </div>

          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-center justify-between transition-all hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                <Eye className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <Label htmlFor="vision-support" className="text-sm font-bold text-slate-800 cursor-pointer">
                  {t("visionSupport")}
                </Label>
                <p className="text-[11px] text-slate-500">{t("visionSupportDesc")}</p>
              </div>
            </div>
            <Switch
              id="vision-support"
              checked={isVisionEnabled}
              onCheckedChange={handleVisionChange}
              className="data-[state=checked]:bg-blue-600"
            />
          </div>
        </div>
      )}
    </>
  )
}
