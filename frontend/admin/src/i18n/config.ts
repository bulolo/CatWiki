export const defaultLocale = "zh" as const
export const locales = ["zh", "en"] as const
export type Locale = (typeof locales)[number];
export const localeLabels: Record<Locale, string> = { zh: "简体中文", en: "English" }
