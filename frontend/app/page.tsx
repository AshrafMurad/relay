import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="min-h-dvh overflow-y-auto bg-signal-carbon text-signal-panel-text">
      <section className="mx-auto grid min-h-dvh w-full max-w-7xl gap-10 px-5 py-6 md:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(540px,1.1fr)] lg:items-center lg:py-10">
        <div className="flex min-h-[calc(100dvh-3rem)] flex-col justify-between gap-10 rounded-2xl border border-white/10 bg-signal-panel p-5 md:p-7 lg:min-h-[calc(100dvh-5rem)]">
          <nav className="flex items-center justify-between gap-4" aria-label="Public navigation">
            <Link className="flex items-center gap-3" href="/" aria-label="Relay home">
              <span className="grid size-10 place-items-center rounded-lg bg-signal-amber text-sm font-bold text-signal-carbon">R</span>
              <span className="text-sm font-semibold tracking-tight">Relay</span>
            </Link>
            <div className="flex items-center gap-2">
              <Button render={<Link href="/login" />} size="sm" variant="ghost">Log in</Button>
              <Button render={<Link href="/signup" />} size="sm">Sign up</Button>
            </div>
          </nav>

          <div className="max-w-2xl py-10 md:py-16">
            <h1 className="max-w-[12ch] text-5xl font-semibold leading-[0.95] tracking-[-0.03em] text-signal-panel-text md:text-7xl">
              Team signal, routed clearly.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-signal-panel-muted md:text-lg">
              Relay is a focused communication workspace for small remote teams, built around durable messages, clear workspace access, and realtime confidence.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button render={<Link href="/signup" />} size="lg">Create account</Button>
              <Button render={<Link href="/login" />} size="lg" variant="outline">Log in</Button>
            </div>
          </div>

          <div className="grid gap-3 border-t border-white/10 pt-5 text-sm text-signal-panel-muted sm:grid-cols-3">
            <p><span className="block font-semibold text-signal-cyan">Durable</span> PostgreSQL-backed message truth.</p>
            <p><span className="block font-semibold text-signal-cyan">Immediate</span> Socket.IO propagation where it matters.</p>
            <p><span className="block font-semibold text-signal-cyan">Authorized</span> Server-side checks for every resource.</p>
          </div>
        </div>

        <div className="relative min-h-[560px] overflow-hidden rounded-2xl border border-signal-line bg-signal-paper p-4 text-signal-ink shadow-2xl md:p-6">
          <div className="absolute left-8 top-0 h-full w-px bg-signal-amber/35" aria-hidden="true" />
          <div className="relative grid h-full min-h-[520px] grid-rows-[auto_1fr_auto] overflow-hidden rounded-xl border border-signal-line bg-signal-surface">
            <div className="flex items-center justify-between border-b border-signal-line px-4 py-3">
              <div>
                <p className="text-sm font-semibold"># launch-room</p>
                <p className="text-xs text-signal-muted">Signal clear - synced just now</p>
              </div>
              <span className="rounded-full border border-signal-cyan/40 px-2.5 py-1 text-xs font-medium text-signal-cyan-ink">5 online</span>
            </div>

            <div className="grid gap-5 overflow-hidden p-4 md:grid-cols-[180px_minmax(0,1fr)] md:p-5">
              <aside className="hidden rounded-lg border border-signal-line bg-signal-surface-raised p-3 md:block">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-signal-muted">Workspace</p>
                <div className="mt-3 grid gap-1 text-sm">
                  <div className="rounded-md bg-signal-amber/10 px-3 py-2 font-semibold text-signal-amber-ink"># launch-room</div>
                  <div className="px-3 py-2 text-signal-muted"># design</div>
                  <div className="px-3 py-2 text-signal-muted"># backend</div>
                  <div className="px-3 py-2 text-signal-muted"># support</div>
                </div>
              </aside>

              <div className="flex min-w-0 flex-col justify-end gap-4">
                <div className="max-w-[82ch] rounded-lg bg-signal-surface-raised p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold"><span className="size-2 rounded-full bg-signal-cyan" />Mina Chen</div>
                  <p className="mt-2 text-sm leading-6 text-signal-muted">Backend accepted the invite flow and the channel shell recovered after reconnect. I am leaving the demo workspace ready for the next pass.</p>
                </div>
                <div className="ml-auto max-w-[82ch] rounded-lg border border-signal-amber/30 bg-signal-amber/10 p-4">
                  <div className="text-sm font-semibold">You</div>
                  <p className="mt-2 text-sm leading-6 text-signal-muted">Homepage is separate. Login and sign-up now route into the workspace setup screen.</p>
                </div>
                <div className="rounded-lg border border-signal-line bg-signal-surface p-3">
                  <p className="text-sm text-signal-muted">Message the team...</p>
                  <div className="mt-3 flex items-center justify-between border-t border-signal-line pt-3">
                    <span className="text-xs text-signal-muted">Plain text - Enter to send</span>
                    <span className="rounded-md bg-signal-amber px-2 py-1 text-xs font-bold text-signal-carbon">Enter</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-signal-line px-4 py-3 text-xs text-signal-muted">Public screen only. Sign in to create or enter a real workspace.</div>
          </div>
        </div>
      </section>
    </main>
  )
}
