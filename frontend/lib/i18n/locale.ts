export const DEFAULT_LOCALE = "en" as const
export const SUPPORTED_LOCALES = [DEFAULT_LOCALE] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
