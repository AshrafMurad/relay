import Link from "next/link"
import { ArrowRight, CheckCircle2, Clock3, MessageSquare, RadioTower, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="grid flex-1 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)] lg:items-stretch">
          <section className="flex flex-col justify-between rounded-2xl border border-sidebar-border bg-signal-panel p-5 md:p-8">
            <div className="max-w-2xl py-6 md:py-10 lg:py-12">
              <div className="mb-7 flex w-fit items-center gap-2 rounded-full border border-sidebar-border bg-sidebar-accent/40 px-3 py-1.5 text-xs font-medium text-signal-cyan">
                <RadioTower className="size-3.5" aria-hidden="true" />
                Signal clear for small remote teams
              </div>
              <h1 className="text-display max-w-[12ch] text-signal-panel-text">
                Work chat with memory.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-signal-panel-muted md:text-lg">
                Relay keeps team communication fast without losing the durable truth: authenticated access, workspace roles, recoverable messages, and realtime state you can trust.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button className="h-10 px-4" nativeButton={false} render={<Link href="/signup" />}>Create your workspace <ArrowRight className="size-4" aria-hidden="true" /></Button>
                <Button className="h-10 px-4" nativeButton={false} render={<Link href="/login" />} variant="outline">Log in</Button>
              </div>
            </div>

            <div className="grid gap-3 border-t border-sidebar-border pt-5 text-sm text-signal-panel-muted sm:grid-cols-2">
              <p className="flex gap-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-signal-cyan" aria-hidden="true" /><span><span className="block font-semibold text-signal-panel-text">Permission-aware by default</span>Workspace operations are scoped to membership and role.</span></p>
              <p className="flex gap-3"><Clock3 className="mt-0.5 size-4 shrink-0 text-signal-cyan" aria-hidden="true" /><span><span className="block font-semibold text-signal-panel-text">Built for reconnects</span>Durable messages stay canonical when a browser returns.</span></p>
            </div>
          </section>

          <section className="rounded-2xl border border-signal-line bg-signal-paper p-3 text-signal-ink shadow-2xl md:p-5">
            <div className="grid min-h-[560px] overflow-hidden rounded-xl border border-signal-line bg-signal-surface lg:h-full lg:grid-cols-[190px_minmax(0,1fr)]">
              <aside className="hidden border-r border-signal-line bg-signal-panel p-3 text-signal-panel-text lg:block">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Northstar Lab</p>
                  <span className="text-metadata rounded-full bg-signal-amber px-1.5 py-0.5 font-bold text-signal-carbon">3</span>
                </div>
                <div className="mt-5 grid gap-1 text-sm">
                  <div className="rounded-md bg-signal-amber/10 px-3 py-2 font-semibold text-signal-amber"># launch-room</div>
                  <div className="px-3 py-2 text-signal-panel-muted"># design</div>
                  <div className="flex items-center justify-between px-3 py-2 text-signal-panel-muted"><span># backend</span><span className="size-1.5 rounded-full bg-signal-amber" /></div>
                  <div className="px-3 py-2 text-signal-panel-muted"># support</div>
                </div>
                <div className="mt-8 border-t border-sidebar-border pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-signal-panel-muted">Direct</p>
                  <div className="mt-3 grid gap-2 text-sm text-signal-panel-muted">
                    <p className="flex items-center gap-2"><span className="size-2 rounded-full bg-signal-cyan" />Mina Chen</p>
                    <p className="flex items-center gap-2"><span className="size-2 rounded-full bg-signal-cyan/35" />Owen Park</p>
                  </div>
                </div>
              </aside>

              <div className="grid min-w-0 grid-rows-[60px_1fr_auto]">
                <header className="flex items-center justify-between border-b border-signal-line px-4 py-3 md:px-5">
                  <div>
                    <p className="text-sm font-semibold"># launch-room</p>
                    <p className="text-xs text-signal-muted">Signal clear - synced just now</p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-signal-cyan/40 px-2.5 py-1 text-xs font-medium text-signal-cyan-ink"><span className="size-1.5 rounded-full bg-signal-cyan" />5 online</span>
                </header>

                <div className="flex min-h-0 flex-col justify-end gap-4 overflow-hidden p-4 md:p-6">
                  <div className="max-w-[82ch]">
                    <div className="flex items-center gap-2 text-sm font-semibold"><span className="grid size-8 place-items-center rounded-md bg-signal-surface-raised text-xs">MC</span>Mina Chen <span className="text-metadata font-normal text-signal-muted">09:41</span></div>
                    <p className="mt-2 pl-10 text-sm leading-6 text-signal-muted">Invite flow is scoped to admins now. I left notes in the thread and the reconnect check recovered the missed channel update.</p>
                  </div>
                  <div className="ml-auto max-w-[82ch] rounded-lg border border-signal-amber/30 bg-signal-amber/10 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">You <CheckCircle2 className="size-4 text-signal-cyan" aria-hidden="true" /></div>
                    <p className="mt-2 text-sm leading-6 text-signal-muted">Homepage points to sign up and login. Auth routes land on workspace setup before the app shell.</p>
                  </div>
                  <div className="max-w-[82ch]">
                    <div className="flex items-center gap-2 text-sm font-semibold"><span className="grid size-8 place-items-center rounded-md bg-signal-surface-raised text-xs">OP</span>Owen Park <span className="text-metadata font-normal text-signal-muted">09:43</span></div>
                    <p className="mt-2 pl-10 text-sm leading-6 text-signal-muted">Typing states stay ephemeral. Message order still comes from the server timestamp.</p>
                  </div>
                </div>

                <div className="border-t border-signal-line p-3 md:p-4">
                  <div className="rounded-lg border border-signal-line bg-signal-surface p-3">
                    <p className="text-sm text-signal-muted">Message the team...</p>
                    <div className="mt-3 flex items-center justify-between border-t border-signal-line pt-3">
                      <span className="inline-flex items-center gap-2 text-xs text-signal-muted"><MessageSquare className="size-3.5" aria-hidden="true" />Plain text - Enter to send</span>
                      <span className="rounded-md bg-signal-amber px-2 py-1 text-xs font-bold text-signal-carbon">Send</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
    </main>
  )
}
