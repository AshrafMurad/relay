import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getMessages } from "@/lib/i18n/messages"

export default function Home() {
  const t = getMessages().homepage

  return (
    <main className="flex flex-1">
      <section
        aria-labelledby="hero-title"
        className="relay-home-hero relative isolate flex min-h-[calc(100dvh-5rem)] w-full flex-col justify-center overflow-hidden bg-signal-panel text-signal-panel-text"
      >
        <div className="relay-home-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relay-home-route pointer-events-none absolute inset-0 hidden lg:block" aria-hidden="true">
          <span className="relay-home-route-amber" />
          <span className="relay-home-route-cyan" />
        </div>

        <div className="relay-home-content relative z-10 grid w-full items-center gap-12 px-6 py-16 sm:px-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.8fr)] lg:gap-7 lg:px-12 xl:px-14">
          <div className="relay-home-copy max-w-[27rem]">
            <p className="relay-home-kicker">Real-time team chat</p>
            <h1
              id="hero-title"
              className="relay-home-title font-semibold tracking-[-0.035em]"
            >
              <span className="block whitespace-nowrap">{t.titleLine1}</span>
              <span className="block whitespace-nowrap text-signal-amber">{t.titleLine2}</span>
            </h1>
            <p className="relay-home-intro mt-5 max-w-[31ch] text-signal-panel-muted">
              {t.intro}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-4">
              <Button className="relay-home-primary h-11 justify-between gap-4 rounded-full px-5 font-semibold" nativeButton={false} render={<Link href="/signup" />}>
                {t.createWorkspace}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Button>
              <Link className="text-sm font-medium text-signal-panel-muted underline-offset-4 transition-colors hover:text-signal-panel-text hover:underline" href="/login">
                {t.loginRelay}
              </Link>
            </div>
          </div>

          <figure className="relay-home-preview relative min-w-0 overflow-hidden rounded-xl bg-signal-carbon">
            <Image
              alt={t.mockupAria}
              className="block h-auto w-full"
              height={1024}
              priority
              sizes="(max-width: 1023px) 100vw, 64vw"
              src="/relay-homepage-mockup.webp"
              width={1536}
            />
            <figcaption className="sr-only">{t.mockupLabel}</figcaption>
          </figure>
        </div>
      </section>
    </main>
  )
}
