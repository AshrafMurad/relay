import type { Metadata } from "next"
import { Archivo, Geist_Mono } from "next/font/google"
import Script from "next/script"

import "./globals.css"
import { IntlProvider } from "@/components/relay/intl-provider"
import { Toaster } from "@/components/ui/sonner"
import { DEFAULT_LOCALE } from "@/lib/i18n/locale"
import { getMessages } from "@/lib/i18n/messages"
import { THEME_INIT_SCRIPT } from "@/lib/theme"

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const messages = getMessages()

export const metadata: Metadata = {
  title: messages.metadata.title,
  description: messages.metadata.description,
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang={DEFAULT_LOCALE}
      suppressHydrationWarning
      className={`${archivo.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full">
        <IntlProvider>{children}</IntlProvider>
        <Toaster position="bottom-right" richColors={false} closeButton />
        <Script id="relay-theme" strategy="beforeInteractive">{THEME_INIT_SCRIPT}</Script>
      </body>
    </html>
  )
}
