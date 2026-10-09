import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"

import { DEFAULT_LOCALE } from "@/lib/i18n/locale"
import { getMessages } from "@/lib/i18n/messages"

export function IntlProvider({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale={DEFAULT_LOCALE} messages={getMessages()}>
      {children}
    </NextIntlClientProvider>
  )
}
