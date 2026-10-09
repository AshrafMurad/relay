"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Link2, LogOut, Plus, RadioTower, Search } from "lucide-react"
import { startTransition, useDeferredValue, useEffect, useState, type FormEvent } from "react"

import { BrandLogo } from "@/components/relay/brand-logo"
import { ThemeControl } from "@/components/relay/theme-control"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ApiClientError, apiRequest } from "@/lib/api/client"
import type { AuthUserDTO, WorkspaceDTO } from "@/lib/api/contracts"
import { useErrorTranslator } from "@/lib/i18n/errors"
import { useTranslateT } from "@/lib/i18n/use-translate-t"

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
  const common = useTranslateT("common")
  const t = useTranslateT("workspace")
  const errors = useErrorTranslator()
  const [user, setUser] = useState<AuthUserDTO | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [workspaceNameError, setWorkspaceNameError] = useState("")
  const [invitationError, setInvitationError] = useState("")
  const [workspaceQuery, setWorkspaceQuery] = useState("")
  const deferredWorkspaceQuery = useDeferredValue(workspaceQuery)
  const showWorkspaceSearch = workspaces.length >= 6
  const filteredWorkspaces = deferredWorkspaceQuery.trim()
    ? workspaces.filter((workspace) => workspace.name.toLocaleLowerCase().includes(deferredWorkspaceQuery.trim().toLocaleLowerCase()))
    : workspaces

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
      setError(errors.apiError(caught))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [errors, forceChoose, router])

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const name = String(new FormData(form).get("name") ?? "").trim()
    if (!name) {
      setWorkspaceNameError(errors.field("workspaceNameRequired"))
      return
    }
    if (name.length < 2) {
      setWorkspaceNameError(errors.field("workspaceNameLength"))
      return
    }
    if (name.length > 120) {
      setWorkspaceNameError(errors.field("workspaceNameLength"))
      return
    }
    setSubmitting(true)
    setError("")
    setWorkspaceNameError("")
    try {
      const result = await apiRequest<{ workspace: WorkspaceDTO }>("/workspaces", {
        method: "POST",
        body: JSON.stringify({ name }),
      })
      window.localStorage.setItem(LAST_WORKSPACE_KEY, result.workspace.slug)
      startTransition(() => router.replace(`/app/${result.workspace.slug}`))
    } catch (caught) {
      setError(errors.apiError(caught))
      setSubmitting(false)
    }
  }

  function continueToInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const token = tokenFromInput(String(new FormData(event.currentTarget).get("invitation") ?? ""))
    if (!token) {
      setInvitationError(errors.field("invitationRequired"))
      return
    }
    setInvitationError("")
    startTransition(() => router.push(`/invite/${encodeURIComponent(token)}`))
  }

  async function signOut() {
    await apiRequest<void>("/auth/signout", { method: "POST" })
    startTransition(() => router.replace("/login"))
  }

  if (loading) {
    return (
      <main className="grid h-dvh place-items-center overflow-y-auto bg-background p-6 text-foreground">
        <div className="text-center" role="status"><div className="mx-auto size-11"><BrandLogo mark="icon" priority /></div><p className="mt-4 text-sm font-semibold">{t("routing")}</p><p className="mt-1 text-xs text-signal-muted">{t("checkingMemberships")}</p></div>
      </main>
    )
  }

  return (
    <main className="h-dvh overflow-y-auto bg-background text-foreground">
      <header className="theme-navigation flex h-16 items-center justify-between border-b border-sidebar-border bg-sidebar px-5 text-sidebar-foreground sm:px-8">
        <Link aria-label="Relay home" className="flex shrink-0 items-center" href="/">
          <BrandLogo className="hidden w-28 dark:block" priority />
          <span className="flex items-center gap-2 dark:hidden">
            <span className="size-8"><BrandLogo mark="icon" priority /></span>
            <span className="text-lg font-semibold tracking-[-0.025em] text-signal-ink">{common("appName")}</span>
          </span>
        </Link>
        <div className="flex items-center gap-2"><ThemeControl className="hover:bg-sidebar-accent" />{user && <><span className="hidden text-xs text-sidebar-foreground/70 sm:inline">{user.email}</span><Button className="hover:bg-sidebar-accent" onClick={() => void signOut()} size="sm" type="button" variant="ghost"><LogOut />{t("signOut")}</Button></>}</div>
      </header>

      <div className="mx-auto grid min-h-[calc(100dvh-4rem)] w-full max-w-5xl items-center gap-10 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)] lg:px-8">
        <section className="max-w-xl">
          <div className="mb-6 grid size-11 place-items-center rounded-lg bg-signal-carbon text-signal-amber"><RadioTower className="size-5" /></div>
          <h1 className="text-page-title max-w-[12ch]">{t("heroTitle")}</h1>
          <p className="text-body mt-5 max-w-[58ch] text-muted-foreground">{t("heroBody")}</p>
          {error && <p className="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
        </section>

        <section className="panel-prominent px-5">
          {workspaces.length > 0 && (
            <div className="border-b border-signal-line py-6">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-sm font-semibold">{t("yourWorkspaces")}</h2>
                <span className="text-metadata text-signal-muted">{t("total", { count: workspaces.length })}</span>
              </div>
              {showWorkspaceSearch && (
                <div className="relative mt-3">
                  <label className="sr-only" htmlFor="workspace-search">{t("findWorkspace")}</label>
                  <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-signal-muted" />
                  <Input className="pl-9" id="workspace-search" onChange={(event) => setWorkspaceQuery(event.target.value)} placeholder={t("findWorkspace")} type="search" value={workspaceQuery} />
                </div>
              )}
              {showWorkspaceSearch ? (
                <ScrollArea aria-label={t("workspacesAria")} className="mt-3 h-[min(18rem,36dvh)] pr-3">
                  <div className="divide-y divide-signal-line" role="list">
                    {filteredWorkspaces.map((workspace) => (
                      <div key={workspace.id} role="listitem">
                        <Link className="flex min-h-14 items-center gap-3 py-3 text-sm transition-colors hover:text-signal-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-amber" href={`/app/${workspace.slug}`}>
                          <span className="text-metadata grid size-8 place-items-center rounded-md bg-signal-carbon font-bold text-signal-panel-text">{workspace.name.slice(0, 2).toUpperCase()}</span>
                          <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{workspace.name}</span><span className="text-xs text-signal-muted">{workspace.currentUserRole.toLowerCase()}</span></span>
                          <ArrowRight aria-hidden="true" className="size-4" />
                        </Link>
                      </div>
                    ))}
                    {filteredWorkspaces.length === 0 && <p className="py-8 text-center text-sm text-signal-muted">{t("noMatches", { query: deferredWorkspaceQuery.trim() })}</p>}
                  </div>
                </ScrollArea>
              ) : (
                <div className="mt-3 divide-y divide-signal-line" role="list">
                  {filteredWorkspaces.map((workspace) => (
                    <div key={workspace.id} role="listitem">
                      <Link className="flex min-h-14 items-center gap-3 py-3 text-sm transition-colors hover:text-signal-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-amber" href={`/app/${workspace.slug}`}>
                        <span className="text-metadata grid size-8 place-items-center rounded-md bg-signal-carbon font-bold text-signal-panel-text">{workspace.name.slice(0, 2).toUpperCase()}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{workspace.name}</span><span className="text-xs text-signal-muted">{workspace.currentUserRole.toLowerCase()}</span></span>
                        <ArrowRight aria-hidden="true" className="size-4" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <form className="py-6" noValidate onSubmit={createWorkspace}>
            <div className="flex items-center gap-2"><Plus className="size-4 text-signal-amber" /><h2 className="text-sm font-semibold">{t("createWorkspace")}</h2></div>
            <p className="mt-2 text-xs leading-5 text-signal-muted">{t("createWorkspaceHint")}</p>
            <div className="mt-4 flex gap-2"><label className="sr-only" htmlFor="workspace-name">{t("workspaceName")}</label><Input aria-describedby={workspaceNameError ? "workspace-name-error" : undefined} aria-invalid={Boolean(workspaceNameError)} id="workspace-name" name="name" onChange={() => setWorkspaceNameError("")} placeholder={t("workspaceNamePlaceholder")} /><Button disabled={submitting} type="submit">{submitting ? t("creating") : common("create")}</Button></div>
            {workspaceNameError && <p className="text-helper mt-2 font-semibold text-destructive" id="workspace-name-error">{workspaceNameError}</p>}
          </form>

          <form className="border-t border-signal-line py-6" noValidate onSubmit={continueToInvite}>
            <div className="flex items-center gap-2"><Link2 className="size-4 text-signal-cyan" /><h2 className="text-sm font-semibold">{t("joinInvitation")}</h2></div>
            <p className="mt-2 text-xs leading-5 text-signal-muted">{t("joinInvitationHint")}</p>
            <div className="mt-4 flex gap-2"><label className="sr-only" htmlFor="invitation">{t("invitationLink")}</label><Input aria-describedby={invitationError ? "invitation-error" : undefined} aria-invalid={Boolean(invitationError)} id="invitation" name="invitation" onChange={() => setInvitationError("")} placeholder={t("invitationPlaceholder")} /><Button type="submit" variant="outline">{common("continue")}</Button></div>
            {invitationError && <p className="text-helper mt-2 font-semibold text-destructive" id="invitation-error">{invitationError}</p>}
          </form>
        </section>
      </div>
    </main>
  )
}
