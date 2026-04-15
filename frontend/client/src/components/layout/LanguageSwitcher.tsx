'use client';

import { useLocale } from 'next-intl';
import { Languages } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui";
import { cn } from '@/lib/utils';
import { locales, localeLabels, type Locale } from '@/i18n/config';

export function LanguageSwitcher({ isCompact = false }: { isCompact?: boolean }) {
  const locale = useLocale();

  const switchLanguage = (newLocale: Locale) => {
    if (newLocale === locale) return;
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;
    window.location.reload();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className={cn(
          "hover:bg-slate-100 rounded-xl transition-colors text-slate-600 flex items-center gap-1.5 focus:outline-none",
          isCompact ? "p-1 hover:bg-slate-200/50" : "p-2 hover:bg-slate-100"
        )}>
          {!isCompact && <Languages className="h-4 w-4" />}
          <span className={cn(
            "font-bold uppercase tracking-wider",
            isCompact ? "text-[10px]" : "text-xs"
          )}>{locale}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[120px] p-1">
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
  );
}
