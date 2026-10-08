import Link from "next/link"
import { ArrowUpRight, Check, CornerDownRight, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="flex flex-1">
      <section className="relative isolate grid min-h-[calc(100dvh-6.5rem)] w-full overflow-hidden rounded-2xl border border-sidebar-border bg-signal-panel text-signal-panel-text lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]" aria-labelledby="hero-title">
        <div className="pointer-events-none absolute inset-x-0 top-[5.25rem] h-px bg-sidebar-border" />
        <div className="pointer-events-none absolute inset-y-0 left-[58%] hidden w-px bg-sidebar-border lg:block" />

        <div className="relative z-10 flex flex-col px-5 pb-10 pt-6 sm:px-8 lg:min-h-[680px] lg:px-12 lg:pb-12 lg:pt-8 xl:px-16">
          <div className="flex flex-1 flex-col justify-center py-10 sm:py-16 lg:py-24">
            <h1 id="hero-title" className="max-w-[8.6ch] text-[clamp(3.25rem,7vw,6rem)] font-semibold leading-[0.88] tracking-[-0.04em] text-balance">
              Move fast.
              <span className="block text-signal-amber">Lose nothing.</span>
            </h1>
            <p className="mt-6 max-w-[36rem] text-[0.95rem] leading-7 text-signal-panel-muted sm:mt-8 sm:text-lg">
              Relay gives small remote teams instant conversation backed by durable messages, clean reconnect recovery, and permissions that hold on every route.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row">
              <Button className="h-11 justify-between px-4 sm:min-w-48" nativeButton={false} render={<Link href="/signup" />}>
                Create your workspace
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </Button>
              <Button className="h-11 border-sidebar-border bg-transparent px-4 text-signal-panel-text hover:bg-sidebar-accent hover:text-signal-panel-text" nativeButton={false} render={<Link href="/login" />} variant="outline">
                Log in to Relay
              </Button>
            </div>
          </div>

          <div className="hidden gap-4 border-t border-sidebar-border pt-5 text-xs leading-5 text-signal-panel-muted lg:grid lg:grid-cols-2">
            <p><span className="block font-semibold text-signal-panel-text">Canonical by design</span>Server IDs and timestamps keep every conversation in order.</p>
            <p><span className="block font-semibold text-signal-panel-text">Ready after reconnect</span>Missed durable events return without duplicate messages.</p>
          </div>
        </div>

        <div className="relative flex min-h-[590px] flex-col border-t border-sidebar-border bg-signal-surface text-signal-ink lg:min-h-0 lg:border-l lg:border-t-0">
          <header className="flex h-[5.25rem] shrink-0 items-center justify-between gap-4 border-b border-signal-line px-5 sm:px-7">
            <div>
              <p className="text-sm font-semibold"># launch-room</p>
              <p className="mt-1 text-xs text-signal-muted">Illustrative conversation</p>
            </div>
            <div className="text-right">
              <p className="inline-flex items-center gap-2 text-xs font-semibold text-signal-cyan-ink"><span className="size-1.5 rounded-full bg-signal-cyan" />Recovery demo</p>
              <p className="text-metadata mt-1 text-signal-muted">DURABLE + ORDERED</p>
            </div>
          </header>

          <div className="relative flex flex-1 flex-col justify-center overflow-hidden px-5 py-10 sm:px-7 lg:px-8">
            <div className="hero-route absolute left-0 top-[38%] h-px w-[76%] bg-signal-amber" aria-hidden="true" />
            <div className="relative z-10 space-y-8">
              <article className="max-w-[31rem]">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-signal-surface-raised text-xs font-semibold">MC</span>
                  <div>
                    <p className="text-sm font-semibold">Mina Chen <span className="text-metadata ml-1 font-normal text-signal-muted">09:41</span></p>
                    <p className="text-xs text-signal-muted">Product</p>
                  </div>
                </div>
                <p className="mt-3 pl-12 text-sm leading-6">The release call is made. Can we lock the channel and send the handoff?</p>
              </article>

              <article className="relative ml-auto max-w-[29rem] border border-signal-amber/40 bg-signal-amber/10 p-4">
                <div className="absolute -left-6 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full bg-signal-amber text-signal-carbon" aria-hidden="true">
                  <CornerDownRight className="size-3.5" />
                </div>
                <p className="text-sm font-semibold">You <span className="text-metadata ml-1 font-normal text-signal-muted">09:42</span></p>
                <p className="mt-2 text-sm leading-6">Locked. The final notes and ownership map are in the thread.</p>
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-signal-cyan-ink"><Check className="size-3.5" aria-hidden="true" />Delivered and stored</p>
              </article>

              <div className="hero-recovery flex items-center gap-3">
                <span className="h-px flex-1 bg-signal-line" />
                <span className="inline-flex items-center gap-2 text-xs font-medium text-signal-cyan-ink"><RotateCcw className="size-3.5" aria-hidden="true" />Connection restored · 1 message recovered</span>
                <span className="h-px flex-1 bg-signal-line" />
              </div>

              <article className="max-w-[31rem]">
                <div className="flex items-center gap-3">
                  <span className="relative grid size-9 shrink-0 place-items-center rounded-md bg-signal-surface-raised text-xs font-semibold">OP<span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-signal-surface bg-signal-cyan" /></span>
                  <div>
                    <p className="text-sm font-semibold">Owen Park <span className="text-metadata ml-1 font-normal text-signal-muted">09:44</span></p>
                    <p className="text-xs text-signal-muted">Engineering</p>
                  </div>
                </div>
                <p className="mt-3 pl-12 text-sm leading-6">Got it. I dropped briefly, but the handoff arrived in order.</p>
              </article>
            </div>
          </div>

          <div className="grid grid-cols-3 border-t border-signal-line text-center text-xs text-signal-muted">
            <p className="border-r border-signal-line px-2 py-4"><span className="block font-semibold text-signal-ink">Durable</span>messages</p>
            <p className="border-r border-signal-line px-2 py-4"><span className="block font-semibold text-signal-ink">Deduplicated</span>retries</p>
            <p className="px-2 py-4"><span className="block font-semibold text-signal-ink">Scoped</span>access</p>
          </div>
        </div>
      </section>
    </main>
  )
}
