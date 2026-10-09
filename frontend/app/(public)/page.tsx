import Link from "next/link"
import { ArrowUpRight, Check, CornerDownRight, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { getMessages } from "@/lib/i18n/messages"

export default function Home() {
  const t = getMessages().homepage

  return (
    <main className="flex flex-1">
      <section className="relative isolate min-h-[calc(100dvh-6.5rem)] w-full overflow-hidden rounded-2xl border border-sidebar-border bg-signal-panel text-signal-panel-text" aria-labelledby="hero-title">
        <div className="pointer-events-none absolute inset-x-0 top-[42%] hidden h-px bg-sidebar-border lg:block" />
        <div className="pointer-events-none absolute bottom-0 left-[44%] top-0 hidden w-px bg-sidebar-border lg:block" />

        <div className="relative z-10 px-5 pb-12 pt-12 sm:px-8 sm:pt-16 lg:grid lg:min-h-[calc(100dvh-6.5rem)] lg:grid-cols-12 lg:px-12 lg:py-12 xl:px-16">
          <div className="lg:col-span-6 lg:flex lg:flex-col lg:justify-center lg:pr-10">
            <h1 id="hero-title" className="max-w-[8.6ch] text-[clamp(3.25rem,7vw,6rem)] font-semibold leading-[0.88] tracking-[-0.04em] text-balance">
              {t.titleLine1}
              <span className="block text-signal-amber">{t.titleLine2}</span>
            </h1>
            <p className="mt-6 max-w-[35rem] text-[0.95rem] leading-7 text-signal-panel-muted sm:mt-8 sm:text-lg">
              {t.intro}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row">
              <Button className="h-11 justify-between px-4 sm:min-w-48" nativeButton={false} render={<Link href="/signup" />}>
                {t.createWorkspace}
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Button>
              <Button className="h-11 border-sidebar-border bg-transparent px-4 text-signal-panel-text hover:bg-sidebar-accent hover:text-signal-panel-text" nativeButton={false} render={<Link href="/login" />} variant="outline">
                {t.loginRelay}
              </Button>
            </div>
          </div>

          <div className="relative mt-14 min-h-[520px] text-signal-panel-text sm:mt-20 lg:col-span-6 lg:mt-0">
            <div className="flex items-center justify-between border-b border-sidebar-border pb-4 text-xs">
              <div>
                <p className="font-semibold">{t.demoChannel}</p>
                <p className="mt-1 text-signal-panel-muted">{t.illustrativeConversation}</p>
              </div>
              <div className="text-right">
                <p className="inline-flex items-center gap-2 font-semibold text-signal-cyan"><span className="size-1.5 rounded-full bg-signal-cyan" />{t.recoveryDemo}</p>
                <p className="text-metadata mt-1 text-signal-panel-muted">{t.durableOrdered}</p>
              </div>
            </div>

            <div className="hero-route absolute left-[-18%] top-[43%] h-px w-[92%] bg-signal-amber" aria-hidden="true" />

            <article className="relative mt-10 max-w-[30rem] lg:ml-6">
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-signal-panel-raised text-xs font-semibold">MC</span>
                <p className="text-sm font-semibold">Mina Chen <span className="text-metadata ml-1 font-normal text-signal-panel-muted">09:41</span></p>
              </div>
              <p className="mt-3 pl-12 text-sm leading-6 text-signal-panel-muted">{t.demoMessage1}</p>
            </article>

            <article className="relative z-10 mt-9 ml-auto max-w-[28rem] border border-signal-amber/40 bg-signal-panel-raised p-4 sm:p-5">
              <div className="absolute -left-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full bg-signal-amber text-signal-carbon" aria-hidden="true">
                <CornerDownRight className="size-3.5" />
              </div>
              <p className="text-sm font-semibold">{t.demoUserYou} <span className="text-metadata ml-1 font-normal text-signal-panel-muted">09:42</span></p>
              <p className="mt-2 text-sm leading-6">{t.demoMessage2}</p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-signal-cyan"><Check className="size-3.5" aria-hidden="true" />{t.deliveredStored}</p>
            </article>

            <div className="hero-recovery my-8 flex items-center gap-3">
              <span className="h-px flex-1 bg-sidebar-border" />
              <span className="inline-flex items-center gap-2 text-xs font-medium text-signal-cyan"><RotateCcw className="size-3.5" aria-hidden="true" />{t.messageRecovered}</span>
              <span className="h-px flex-1 bg-sidebar-border" />
            </div>

            <article className="max-w-[30rem] lg:ml-10">
              <div className="flex items-center gap-3">
                <span className="relative grid size-9 shrink-0 place-items-center rounded-md bg-signal-panel-raised text-xs font-semibold">OP<span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-signal-panel bg-signal-cyan" /></span>
                <p className="text-sm font-semibold">Owen Park <span className="text-metadata ml-1 font-normal text-signal-panel-muted">09:44</span></p>
              </div>
              <p className="mt-3 pl-12 text-sm leading-6 text-signal-panel-muted">{t.demoMessage3}</p>
            </article>
          </div>

          <div className="mt-12 grid grid-cols-3 border-t border-sidebar-border pt-5 text-xs text-signal-panel-muted lg:col-span-12 lg:mt-8">
            <p><span className="block font-semibold text-signal-panel-text">{t.durable}</span>{t.messages}</p>
            <p className="text-center"><span className="block font-semibold text-signal-panel-text">{t.deduplicated}</span>{t.retries}</p>
            <p className="text-right"><span className="block font-semibold text-signal-panel-text">{t.scoped}</span>{t.access}</p>
          </div>
        </div>
      </section>
    </main>
  )
}
