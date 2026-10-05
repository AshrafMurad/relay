import Link from "next/link"
import { ArrowRight, CheckCircle2, Clock3, MessageSquare, RadioTower, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="min-h-dvh overflow-y-auto bg-signal-carbon text-signal-panel-text">
      <section className="mx-auto grid min-h-dvh w-full max-w-7xl gap-5 px-4 py-4 md:px-6 lg:grid-cols-[72px_minmax(0,0.82fr)_minmax(560px,1.18fr)] lg:px-8 lg:py-6">
        <aside className="hidden rounded-2xl border border-white/10 bg-black/20 p-3 lg:flex lg:min-h-[calc(100dvh-3rem)] lg:flex-col lg:items-center lg:justify-between" aria-label="Relay route rail">
          <Link className="grid size-11 place-items-center rounded-lg bg-signal-amber text-sm font-bold text-signal-carbon" href="/" aria-label="Relay home">R</Link>
          <div className="flex flex-col items-center gap-3 text-signal-panel-muted">
            <span className="size-2 rounded-full bg-signal-amber" />
            <span className="h-20 w-px bg-signal-amber/35" />
            <span className="size-2 rounded-full bg-signal-cyan" />
          </div>
          <div className="rounded-full border border-white/10 px-2 py-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-signal-panel-muted [writing-mode:vertical-rl]">Clear</div>
        </aside>

        <div className="flex min-h-[calc(100dvh-2rem)] flex-col justify-between gap-10 rounded-2xl border border-white/10 bg-signal-panel p-5 md:p-7 lg:min-h-[calc(100dvh-3rem)]">
          <nav className="flex items-center justify-between gap-4" aria-label="Public navigation">
            <Link className="flex items-center gap-3 lg:hidden" href="/" aria-label="Relay home">
              <span className="grid size-10 place-items-center rounded-lg bg-signal-amber text-sm font-bold text-signal-carbon">R</span>
              <span className="text-sm font-semibold tracking-tight">Relay</span>
            </Link>
            <span className="hidden text-sm font-semibold tracking-tight lg:inline">Relay</span>
            <div className="flex items-center gap-2">
              <Button render={<Link href="/login" />} size="sm" variant="ghost">Log in</Button>
              <Button render={<Link href="/signup" />} size="sm">Sign up</Button>
            </div>
          </nav>

          <div className="max-w-2xl py-8 md:py-14">
            <div className="mb-7 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-signal-cyan">
              <RadioTower className="size-3.5" aria-hidden="true" />
              Signal clear for small remote teams
            </div>
            <h1 className="max-w-[11ch] text-5xl font-semibold leading-[0.92] tracking-[-0.035em] text-signal-panel-text md:text-7xl xl:text-8xl">
              Work chat with memory.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-signal-panel-muted md:text-lg">
              Relay keeps team conversation fast while protecting the durable truth: authenticated access, workspace roles, recoverable messages, and realtime state you can trust.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button className="h-10 px-4" render={<Link href="/signup" />}>Create your workspace <ArrowRight className="size-4" aria-hidden="true" /></Button>
              <Button className="h-10 px-4" render={<Link href="/login" />} variant="outline">Log in</Button>
            </div>
          </div>

          <div className="grid gap-3 border-t border-white/10 pt-5 text-sm text-signal-panel-muted sm:grid-cols-[1fr_1fr]">
            <p className="flex gap-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-signal-cyan" aria-hidden="true" /><span><span className="block font-semibold text-signal-panel-text">Permission-aware by default</span>Every workspace operation is scoped to membership and role.</span></p>
            <p className="flex gap-3"><Clock3 className="mt-0.5 size-4 shrink-0 text-signal-cyan" aria-hidden="true" /><span><span className="block font-semibold text-signal-panel-text">Built for reconnects</span>Durable messages stay canonical when a browser drops and returns.</span></p>
          </div>
        </div>

        <div className="relative min-h-[620px] overflow-hidden rounded-2xl border border-signal-line bg-signal-paper p-3 text-signal-ink shadow-2xl md:p-5 lg:min-h-[calc(100dvh-3rem)]">
          <div className="absolute inset-x-5 top-8 h-px bg-signal-amber/40" aria-hidden="true" />
          <div className="relative grid h-full min-h-[580px] overflow-hidden rounded-xl border border-signal-line bg-signal-surface md:grid-cols-[64px_210px_minmax(0,1fr)]">
            <div className="hidden border-r border-signal-line bg-signal-carbon p-3 md:flex md:flex-col md:items-center md:gap-3">
              <div className="grid size-9 place-items-center rounded-md bg-signal-amber text-xs font-bold text-signal-carbon">R</div>
              <div className="size-9 rounded-md border border-white/10 bg-white/5" />
              <div className="size-9 rounded-md border border-white/10 bg-white/5" />
            </div>

            <aside className="hidden border-r border-signal-line bg-signal-panel p-3 text-signal-panel-text md:block">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Northstar Lab</p>
                <span className="rounded-full bg-signal-amber px-1.5 py-0.5 text-[10px] font-bold text-signal-carbon">3</span>
              </div>
              <div className="mt-5 grid gap-1 text-sm">
                <div className="rounded-md bg-signal-amber/10 px-3 py-2 font-semibold text-signal-amber"># launch-room</div>
                <div className="px-3 py-2 text-signal-panel-muted"># design</div>
                <div className="flex items-center justify-between px-3 py-2 text-signal-panel-muted"><span># backend</span><span className="size-1.5 rounded-full bg-signal-amber" /></div>
                <div className="px-3 py-2 text-signal-panel-muted"># support</div>
              </div>
              <div className="mt-8 border-t border-white/10 pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-signal-panel-muted">Direct</p>
                <div className="mt-3 grid gap-2 text-sm text-signal-panel-muted">
                  <p className="flex items-center gap-2"><span className="size-2 rounded-full bg-signal-cyan" />Mina Chen</p>
                  <p className="flex items-center gap-2"><span className="size-2 rounded-full bg-signal-cyan/35" />Owen Park</p>
                </div>
              </div>
            </aside>

            <section className="grid min-w-0 grid-rows-[60px_1fr_auto]">
              <header className="flex items-center justify-between border-b border-signal-line px-4 py-3 md:px-5">
                <div>
                  <p className="text-sm font-semibold"># launch-room</p>
                  <p className="text-xs text-signal-muted">Signal clear - synced just now</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-signal-cyan/40 px-2.5 py-1 text-xs font-medium text-signal-cyan-ink"><span className="size-1.5 rounded-full bg-signal-cyan" />5 online</span>
              </header>

              <div className="flex min-h-0 flex-col justify-end gap-4 overflow-hidden p-4 md:p-6">
                <div className="max-w-[82ch]">
                  <div className="flex items-center gap-2 text-sm font-semibold"><span className="grid size-8 place-items-center rounded-md bg-signal-surface-raised text-xs">MC</span>Mina Chen <span className="font-mono text-[10px] font-normal text-signal-muted">09:41</span></div>
                  <p className="mt-2 pl-10 text-sm leading-6 text-signal-muted">Invite flow is scoped to admins now. I left notes in the thread and the reconnect check recovered the missed channel update.</p>
                </div>
                <div className="ml-auto max-w-[82ch] rounded-lg border border-signal-amber/30 bg-signal-amber/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">You <CheckCircle2 className="size-4 text-signal-cyan" aria-hidden="true" /></div>
                  <p className="mt-2 text-sm leading-6 text-signal-muted">Great. Homepage points to sign up and login. Auth routes land on workspace setup before the app shell.</p>
                </div>
                <div className="max-w-[82ch]">
                  <div className="flex items-center gap-2 text-sm font-semibold"><span className="grid size-8 place-items-center rounded-md bg-signal-surface-raised text-xs">OP</span>Owen Park <span className="font-mono text-[10px] font-normal text-signal-muted">09:43</span></div>
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
            </section>
          </div>
        </div>
      </section>
    </main>
  )
}
