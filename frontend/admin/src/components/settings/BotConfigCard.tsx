/**
 * 机器人配置卡片组件 - 网页挂件、API、微信公众号配置
 */

"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LucideIcon } from "lucide-react"
import { env } from "@/lib/env"

interface BotConfigCardProps {
  title: string
  description: string
  icon: LucideIcon
  iconBgColor: string
  iconColor: string
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  children: React.ReactNode
}

export function BotConfigCard({
  title,
  description,
  icon: Icon,
  iconBgColor,
  iconColor,
  enabled,
  onEnabledChange,
  children,
}: BotConfigCardProps) {
  return (
    <Card className="border-slate-200 bg-slate-50/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 ${iconBgColor} rounded-lg`}>
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription className="text-xs mt-1">
                {description}
              </CardDescription>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onEnabledChange(e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
            />
            <span className="text-sm font-semibold text-slate-700">启用</span>
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
      </CardContent>
    </Card>
  )
}

// Web Widget 配置字段
interface WebWidgetFieldsProps {
  title: string
  welcomeMessage: string
  primaryColor: string
  position: "left" | "right"
  enabled: boolean
  onUpdate: (field: string, value: string) => void
}

export function WebWidgetFields({ title, welcomeMessage, primaryColor, position, enabled, onUpdate }: WebWidgetFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">挂件标题</label>
          <Input
            value={title}
            onChange={(e) => onUpdate("webWidget.title", e.target.value)}
            placeholder="AI 客服助手"
            disabled={!enabled}
            className="bg-white"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">显示位置</label>
          <Select
            value={position}
            onValueChange={(val) => onUpdate("webWidget.position", val)}
            disabled={!enabled}
          >
            <SelectTrigger className="bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left">左下角</SelectItem>
              <SelectItem value="right">右下角</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">欢迎语</label>
        <Input
          value={welcomeMessage}
          onChange={(e) => onUpdate("webWidget.welcomeMessage", e.target.value)}
          placeholder="您好！我是 AI 助手，有什么可以帮您？"
          disabled={!enabled}
          className="bg-white"
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-700">主题色</label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={primaryColor}
            onChange={(e) => onUpdate("webWidget.primaryColor", e.target.value)}
            disabled={!enabled}
            className="w-20 h-10 bg-white cursor-pointer"
          />
          <Input
            value={primaryColor}
            onChange={(e) => onUpdate("webWidget.primaryColor", e.target.value)}
            disabled={!enabled}
            placeholder="#3b82f6"
            className="flex-1 bg-white font-mono"
          />
        </div>
      </div>
      {enabled && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl">
          <p className="text-xs font-semibold text-blue-900 mb-2">嵌入代码：</p>
          <code className="block text-[10px] text-blue-700 font-mono bg-white p-3 rounded-lg overflow-x-auto">
            {`<script src="${env.NEXT_PUBLIC_CLIENT_URL}/widget.js"></script>
<script>
  ChatWidget.init({
    title: "${title}",
    position: "${position}",
    color: "${primaryColor}",
    welcomeMessage: "${welcomeMessage}"
  });
</script>`}
          </code>
        </div>
      )}
    </>
  )
}
// Force update

