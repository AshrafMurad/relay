import en from "@/messages/en"

import { DEFAULT_LOCALE, type SupportedLocale } from "./locale"

const messages = {
  en,
} as const

export function getMessages(locale: SupportedLocale = DEFAULT_LOCALE) {
  return messages[locale]
}

export type AppMessages = typeof en
