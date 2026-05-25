"use client"

import { useLocale } from "next-intl"
import { Languages } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui"
import { cn } from "@/lib/utils"
import { locales, localeLabels, type Locale } from "@/i18n/config"

export function LanguageSwitcher() {
  const locale = useLocale()

  const switchLanguage = (newLocale: Locale) => {
    if (newLocale === locale) return
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`
    window.location.reload()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-primary transition-colors flex items-center gap-1.5 focus:outline-none group">
          {<Languages className="h-5 w-5" />}
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-primary">{locale}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[120px] rounded-xl p-1 shadow-xl border-slate-100">
        {locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => switchLanguage(l)}
            className={cn(
              "rounded-lg text-xs font-bold py-2 cursor-pointer",
              locale === l ? "bg-primary/5 text-primary" : "text-slate-600"
            )}
          >
            {localeLabels[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
