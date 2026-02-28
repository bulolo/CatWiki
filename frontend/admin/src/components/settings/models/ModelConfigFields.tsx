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
import { ShieldCheck, BrainCircuit } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

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
  const isThinkingEnabled = config.extra_body?.chat_template_kwargs?.enable_thinking ?? false;
  const isVisionEnabled = config.is_vision ?? false;

  const handleThinkingChange = (checked: boolean) => {
    const currentExtraBody = config.extra_body || {};
    const currentKwargs = currentExtraBody.chat_template_kwargs || {};
    onUpdate(type, "extra_body", {
      ...currentExtraBody,
      chat_template_kwargs: {
        ...currentKwargs,
        enable_thinking: checked
      }
    });
  };

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
            <p className="font-medium text-amber-800">更改需谨慎</p>
            <p>修改向量模型配置可能导致现有的向量知识库无法检索！</p>
            <p>一旦修改，建议在&quot;文档管理&quot;中对所有文档执行&quot;重新向量化&quot;操作，否则旧数据的向量将与新模型不兼容。</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">协议类型</label>
          <div className="flex items-center h-10 px-3 rounded-md border border-slate-200 bg-slate-50 text-slate-500 text-sm">
            OpenAI API 兼容协议
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">模型名称</label>
          <Input
            value={config.model}
            onChange={(e) => onUpdate(type, "model", e.target.value)}
            placeholder="例如: gpt-4, claude-3-opus..."
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
          <label className="text-sm font-semibold text-slate-700">向量维度 (自动获取)</label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={config.dimension || ""}
              disabled={true}
              placeholder="等待自动探测..."
              className="bg-slate-50 font-mono text-slate-500"
            />
          </div>
          <p className="text-xs text-slate-500">
            该值将在保存配置时自动从模型提供商探测。
          </p>
        </div>
      )}
      {type === "chat" && (
        <div className="space-y-4">
          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-center justify-between transition-all hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600 shadow-sm">
                <BrainCircuit className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <Label htmlFor="thinking-mode" className="text-sm font-bold text-slate-800 cursor-pointer">
                  是否开启思考
                </Label>
                <p className="text-[11px] text-slate-500">
                  调用模型时是否请求思考过程 (extra_body: {`{"chat_template_kwargs": {"enable_thinking": ${isThinkingEnabled}}}`})
                </p>
              </div>
            </div>
            <Switch
              id="thinking-mode"
              checked={isThinkingEnabled}
              onCheckedChange={handleThinkingChange}
              className="data-[state=checked]:bg-violet-600"
            />
          </div>

          <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex items-center justify-between transition-all hover:bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-eye"
                >
                  <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <div className="space-y-0.5">
                <Label htmlFor="vision-support" className="text-sm font-bold text-slate-800 cursor-pointer">
                  视觉支持
                </Label>
                <p className="text-[11px] text-slate-500">该配置对应的模型是否支持多模态的图像理解</p>
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
