"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Link2, LogOut, Plus, RadioTower } from "lucide-react"
import { startTransition, useEffect, useState, type FormEvent } from "react"

import { BrandLogo } from "@/components/relay/brand-logo"
import { ThemeControl } from "@/components/relay/theme-control"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ApiClientError, apiRequest } from "@/lib/api/client"
import type { AuthUserDTO, WorkspaceDTO } from "@/lib/api/contracts"

const LAST_WORKSPACE_KEY = "relay:last-workspace"

function tokenFromInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ""
  try {
    const url = new URL(trimmed)
    const segments = url.pathname.split("/").filter(Boolean)
    return segments.at(-1) ?? ""
  } catch {
    return trimmed.split("/").filter(Boolean).at(-1) ?? ""
  }
}

export function WorkspaceGateway({ forceChoose = false }: { forceChoose?: boolean }) {
  const router = useRouter()
  const [user, setUser] = useState<AuthUserDTO | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    Promise.all([
      apiRequest<{ user: AuthUserDTO }>("/auth/me"),
      apiRequest<{ workspaces: WorkspaceDTO[] }>("/workspaces"),
    ]).then(([session, workspaceResult]) => {
      if (cancelled) return
      setUser(session.user)
      setWorkspaces(workspaceResult.workspaces)

      if (!forceChoose && workspaceResult.workspaces.length > 0) {
        const lastSlug = window.localStorage.getItem(LAST_WORKSPACE_KEY)
        const destination = workspaceResult.workspaces.find((workspace) => workspace.slug === lastSlug)
          ?? (workspaceResult.workspaces.length === 1 ? workspaceResult.workspaces[0] : null)
        if (destination) {
          startTransition(() => router.replace(`/app/${destination.slug}`))
          return
        }
      }
      setLoading(false)
    }).catch((caught) => {
      if (cancelled) return
      if (caught instanceof ApiClientError && caught.code === "UNAUTHORIZED") {
        startTransition(() => router.replace("/login"))
        return
      }
      setError(caught instanceof Error ? caught.message : "Workspace access could not be loaded.")
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [forceChoose, router])

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const name = String(new FormData(form).get("name") ?? "").trim()
    if (!name) return
    setSubmitting(true)
    setError("")
    try {
      const result = await apiRequest<{ workspace: WorkspaceDTO }>("/workspaces", {
        method: "POST",
        body: JSON.stringify({ name }),
      })
      window.localStorage.setItem(LAST_WORKSPACE_KEY, result.workspace.slug)
      startTransition(() => router.replace(`/app/${result.workspace.slug}`))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Workspace could not be created.")
      setSubmitting(false)
    }
  }

  function continueToInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const token = tokenFromInput(String(new FormData(event.currentTarget).get("invitation") ?? ""))
    if (!token) {
      setError("Enter the invitation link you received.")
      return
    }
    startTransition(() => router.push(`/invite/${encodeURIComponent(token)}`))
  }

  async function signOut() {
    await apiRequest<void>("/auth/signout", { method: "POST" })
    startTransition(() => router.replace("/login"))
  }

  if (loading) {
    return (
      <main className="grid h-dvh place-items-center overflow-y-auto bg-background p-6 text-foreground">
        <div className="text-center" role="status"><div className="mx-auto size-11"><BrandLogo mark="icon" priority /></div><p className="mt-4 text-sm font-semibold">Routing your workspace</p><p className="mt-1 text-xs text-signal-muted">Checking your active memberships.</p></div>
      </main>
    )
  }

  return (
    <main className="h-dvh overflow-y-auto bg-background text-foreground">
      <header className="flex h-16 items-center justify-between border-b border-sidebar-border bg-sidebar px-5 text-sidebar-foreground sm:px-8">
        <Link aria-label="Relay home" className="w-28" href="/"><BrandLogo priority /></Link>
        <div className="flex items-center gap-2"><ThemeControl className="hover:bg-sidebar-accent" />{user && <><span className="hidden text-xs text-sidebar-foreground/70 sm:inline">{user.email}</span><Button className="hover:bg-sidebar-accent" onClick={() => void signOut()} size="sm" type="button" variant="ghost"><LogOut />Sign out</Button></>}</div>
      </header>

      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-5xl items-center gap-10 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)] lg:px-8">
        <section className="max-w-xl">
          <div className="mb-6 grid size-11 place-items-center rounded-lg bg-signal-carbon text-signal-amber"><RadioTower className="size-5" /></div>
          <h1 className="text-page-title max-w-[12ch]">Choose where your team connects.</h1>
          <p className="text-body mt-5 max-w-[58ch] text-muted-foreground">Create a new workspace for your team, or use an invitation to join one that already exists. You can switch workspaces at any time.</p>
          {error && <p className="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
        </section>

        <section className="panel-prominent px-5">
          {workspaces.length > 0 && (
            <div className="border-b border-signal-line py-6">
              <h2 className="text-sm font-semibold">Your workspaces</h2>
              <div className="mt-3 divide-y divide-signal-line">
                {workspaces.map((workspace) => (
                  <Link className="flex min-h-14 items-center gap-3 py-3 text-sm transition-colors hover:text-signal-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-amber" href={`/app/${workspace.slug}`} key={workspace.id}>
                    <span className="text-metadata grid size-8 place-items-center rounded-md bg-signal-carbon font-bold text-signal-panel-text">{workspace.name.slice(0, 2).toUpperCase()}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{workspace.name}</span><span className="text-xs text-signal-muted">{workspace.currentUserRole.toLowerCase()}</span></span>
                    <ArrowRight className="size-4" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          <form className="py-6" onSubmit={createWorkspace}>
            <div className="flex items-center gap-2"><Plus className="size-4 text-signal-amber" /><h2 className="text-sm font-semibold">Create a workspace</h2></div>
            <p className="mt-2 text-xs leading-5 text-signal-muted">You will become the Owner and Relay will prepare a general channel.</p>
            <div className="mt-4 flex gap-2"><label className="sr-only" htmlFor="workspace-name">Workspace name</label><Input id="workspace-name" maxLength={120} minLength={2} name="name" placeholder="Acme product team" required /><Button disabled={submitting} type="submit">{submitting ? "Creating..." : "Create"}</Button></div>
          </form>

          <form className="border-t border-signal-line py-6" onSubmit={continueToInvite}>
            <div className="flex items-center gap-2"><Link2 className="size-4 text-signal-cyan" /><h2 className="text-sm font-semibold">Join with an invitation</h2></div>
            <p className="mt-2 text-xs leading-5 text-signal-muted">Paste the invitation link sent by a workspace Owner or Admin.</p>
            <div className="mt-4 flex gap-2"><label className="sr-only" htmlFor="invitation">Invitation link</label><Input id="invitation" name="invitation" placeholder="https://relay.example/invite/..." required /><Button type="submit" variant="outline">Continue</Button></div>
          </form>
        </section>
      </div>
    </main>
  )
}
