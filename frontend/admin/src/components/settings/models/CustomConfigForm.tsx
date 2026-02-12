import { Input } from "@/components/ui/input"
import { ShieldCheck } from "lucide-react"
import { ModelType } from "@/types/settings"

interface CustomConfigFormProps {
  type: ModelType
  config: {
    model: string
    apiKey: string
    baseUrl: string
    dimension?: number
  }
  isDemoMode: boolean
  onUpdate: (type: ModelType, field: string, value: any) => void
}

export function CustomConfigForm({ type, config, isDemoMode, onUpdate }: CustomConfigFormProps) {
  return (
    <>
      {isDemoMode && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
          <ShieldCheck className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">演示模式已开启：为了保护基础设施安全，部分配置项（如 API 地址和模型名称）已进行脱敏处理。</p>
        </div>
      )}
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
            readOnly={isDemoMode && config.model === "********"}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">API Key</label>
        <Input
          type="password"
          value={config.apiKey}
          onChange={(e) => onUpdate(type, "apiKey", e.target.value)}
          placeholder="sk-..."
          className="bg-white font-mono"
          readOnly={isDemoMode && config.apiKey === "********"}
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">API Base URL</label>
        <Input
          value={config.baseUrl}
          onChange={(e) => onUpdate(type, "baseUrl", e.target.value)}
          placeholder="https://api.openai.com/v1"
          className="bg-white font-mono"
          readOnly={isDemoMode && config.baseUrl === "********"}
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
    </>
  )
}
