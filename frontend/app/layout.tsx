import type { Metadata } from "next"
import { Archivo, Geist_Mono } from "next/font/google"
import { headers } from "next/headers"
import Script from "next/script"

import "./globals.css"
import { IntlProvider } from "@/components/relay/intl-provider"
import { Toaster } from "@/components/ui/sonner"
import { DEFAULT_LOCALE } from "@/lib/i18n/locale"
import { getMessages } from "@/lib/i18n/messages"


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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Reading the request-scoped nonce opts every page into dynamic rendering,
  // which the strict CSP nonce scheme requires.
  const nonce = (await headers()).get("x-nonce") ?? undefined
  return (
    <html
      lang={DEFAULT_LOCALE}
      suppressHydrationWarning
      className={`${archivo.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full">
        <IntlProvider>{children}</IntlProvider>
        <Toaster position="bottom-right" richColors={false} closeButton />
        <Script id="relay-theme" src="/theme-init.js" strategy="beforeInteractive" nonce={nonce} />
      </body>
    </html>
  )
}
