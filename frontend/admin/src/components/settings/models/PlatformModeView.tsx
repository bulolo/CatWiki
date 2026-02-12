import { PlugZap } from "lucide-react"
import { useSettings } from "@/contexts/SettingsContext"
import { ModelType } from "@/types/settings"

interface PlatformModeViewProps {
  type: ModelType
}

export function PlatformModeView({ type }: PlatformModeViewProps) {
  const { platformDefaults } = useSettings()

  return (
    <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 text-center space-y-3 animate-in fade-in duration-300">
      <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
        <PlugZap className="w-6 h-6" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-blue-900">已托管至平台</h3>
        <p className="text-xs text-blue-700 mt-1 max-w-xs mx-auto">
          当前正在使用平台提供的共享 AI 资源。无需配置 Key 即可直接使用。
        </p>
      </div>

      {/* @ts-ignore */}
      {platformDefaults?.[type]?.model && (
        <div className="inline-block bg-white/60 px-3 py-1 rounded text-xs text-blue-800 border border-blue-100">
          {/* @ts-ignore */}
          当前模型: <span className="font-mono font-semibold">{platformDefaults[type].model}</span>
        </div>
      )}
    </div>
  )
}
