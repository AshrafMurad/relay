import { getRequestConfig } from "next-intl/server"

import { DEFAULT_LOCALE } from "@/lib/i18n/locale"
import { getMessages } from "@/lib/i18n/messages"

export default getRequestConfig(async () => ({
  locale: DEFAULT_LOCALE,
  messages: getMessages(),
}))
