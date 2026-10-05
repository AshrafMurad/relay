export default function WorkspaceLoading() {
  return (
    <main className="grid h-dvh place-items-center bg-signal-paper p-6 text-signal-ink" role="status">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto size-12 rounded-lg bg-signal-carbon text-signal-amber" />
        <p className="mt-4 text-sm font-semibold">Opening workspace</p>
        <p className="mt-1 text-xs text-signal-muted">Loading conversation context.</p>
        <div className="mt-5 space-y-2" aria-hidden="true">
          <div className="mx-auto h-2 w-48 animate-pulse rounded bg-signal-surface-raised" />
          <div className="mx-auto h-2 w-32 animate-pulse rounded bg-signal-surface-raised" />
        </div>
      </div>
    </main>
  )
}
