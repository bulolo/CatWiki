// Copyright 2026 CatWiki Authors
//
// Licensed under the CatWiki Open Source License (Modified Apache 2.0);
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://github.com/CatWiki/CatWiki/blob/main/LICENSE

"use client"

import { useTranslations } from "next-intl"
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@/components/ui"
import { ChevronDown, ChevronUp, Copy, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { cn, copyToClipboard } from "@/lib/utils"
import type { BotConfig } from "@/types/settings"

export type BotChange = <S extends keyof BotConfig>(
  section: S,
  field: keyof BotConfig[S],
  value: BotConfig[S][keyof BotConfig[S]]
) => void

interface BotCardProps {
  title: string
  description: string
  icon: React.ReactNode
  iconBgColor?: string
  iconTextColor?: string
  isEnabled: boolean
  isExpanded: boolean
  onToggleExpand: () => void
  onToggleEnable: (enabled: boolean) => void
  children: React.ReactNode
  badge?: React.ReactNode
  typeBadge?: string
  headerAction?: React.ReactNode
  className?: string
  disabled?: boolean
  tooltip?: string
}

export function BotCard({
  title,
  description,
  icon,
  iconBgColor = "bg-blue-50",
  iconTextColor = "text-blue-600",
  isEnabled,
  isExpanded,
  onToggleExpand,
  onToggleEnable,
  children,
  badge,
  typeBadge,
  headerAction,
  className,
  disabled,
  tooltip,
}: BotCardProps) {
  const t = useTranslations("SiteBot")
  return (
    <Card className={cn("border-slate-200/60 shadow-sm rounded-xl overflow-hidden", disabled && "opacity-75", className)}>
      <CardHeader className="border-b border-border/40 py-3 px-5">
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer flex-1"
            onClick={onToggleExpand}
          >
            <div className={cn("p-1.5 rounded-lg border", iconBgColor, iconTextColor, "border-opacity-50")}>
              {icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold">{title}</CardTitle>
                {typeBadge && (
                  <Badge className="text-[9px] font-bold px-1.5 h-4 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-50">
                    {typeBadge}
                  </Badge>
                )}
                {badge}
                {isExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                )}
              </div>
              <CardDescription className="text-xs">{description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {headerAction}
            <label
              className={cn(
                "flex items-center gap-2 cursor-pointer bg-slate-50 px-3 h-8 rounded-lg border border-slate-200 shadow-sm hover:border-slate-300 transition-colors",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={(e) => e.stopPropagation()}
              title={tooltip}
            >
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => onToggleEnable(e.target.checked)}
                disabled={disabled}
                className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <span className="text-[13px] font-semibold text-slate-700">{t("enabled")}</span>
            </label>
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-4 p-5 animate-in fade-in duration-300">
          {children}
        </CardContent>
      )}
    </Card>
  )
}

interface SettingItemProps {
  label: string
  badge?: string
  required?: boolean
  children: React.ReactNode
  className?: string
  labelClassName?: string
}

export function SettingItem({ label, badge, required, children, className, labelClassName }: SettingItemProps) {
  return (
    <div className={cn("flex gap-4", className)}>
      <div className={cn("min-w-[100px] pt-1.5 flex flex-col items-start justify-start", labelClassName)}>
        <label className="text-[13px] font-semibold text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        {badge && (
          <Badge variant="outline" className="text-[9px] mt-0.5 bg-slate-50 text-slate-500 border-slate-200 font-bold px-1.5 h-3.5">
            {badge}
          </Badge>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

interface CopyableInputProps {
  value: string
  onCopy?: () => void
  readOnly?: boolean
  type?: string
  onChange?: (val: string) => void
  placeholder?: string
  disabled?: boolean
  showPasswordToggle?: boolean
  isPasswordVisible?: boolean
  onTogglePasswordVisibility?: () => void
  hint?: string
  className?: string
  generateAction?: React.ReactNode
}

export function CopyableInput({
  value,
  onCopy,
  readOnly,
  type = "text",
  onChange,
  placeholder,
  disabled,
  showPasswordToggle,
  isPasswordVisible,
  onTogglePasswordVisibility,
  hint,
  className,
  generateAction,
}: CopyableInputProps) {
  const t = useTranslations("SiteBot")
  const handleCopy = async () => {
    const ok = await copyToClipboard(value)
    if (onCopy) onCopy()
    else if (ok) toast.success(t("copied"))
  }

  return (
    <div className="space-y-2">
      <div className="relative group">
        <Input
          type={showPasswordToggle ? (isPasswordVisible ? "text" : "password") : type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="new-password"
          className={cn(
            "rounded-lg h-9 text-[13px] pr-16 placeholder:text-slate-400/80",
            readOnly ? "bg-slate-50 font-mono text-[11px]" : "bg-white",
            showPasswordToggle && "pr-28 font-mono",
            className
          )}
        />
        <div className="absolute right-1 top-1 flex gap-1">
          {showPasswordToggle && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 rounded-lg"
              onClick={onTogglePasswordVisibility}
              disabled={disabled}
              type="button"
            >
              {isPasswordVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 text-[11px] hover:bg-slate-200 rounded-lg font-semibold px-2 text-slate-500",
              !showPasswordToggle && "text-slate-400"
            )}
            onClick={handleCopy}
            disabled={disabled || !value}
            type="button"
          >
            {showPasswordToggle ? t("copy") : <Copy className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
      {generateAction}
    </div>
  )
}

interface InstructionBoxProps {
  title: string
  items: string[]
  footer?: React.ReactNode
  bgColor?: string
  borderColor?: string
  textColor?: string
}

export function InstructionBox({
  title,
  items,
  footer,
  bgColor = "bg-blue-50",
  borderColor = "border-blue-100",
  textColor = "text-blue-700",
}: InstructionBoxProps) {
  const titleColor = textColor.replace("700", "900")
  return (
    <div className="flex gap-4 mt-1">
      <div className="min-w-[100px]" />
      <div className={cn("flex-1 p-3 rounded-lg border", bgColor, borderColor)}>
        <p className={cn("text-xs font-semibold mb-2", titleColor)}>{title}：</p>
        <ol className={cn("text-[11px] space-y-1.5 list-decimal list-inside", textColor)}>
          {items.map((item, index) => (
            <li key={index} dangerouslySetInnerHTML={{ __html: item }} />
          ))}
        </ol>
        {footer && (
          <div className="mt-3 pt-2 border-t border-black/5 flex items-center gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
