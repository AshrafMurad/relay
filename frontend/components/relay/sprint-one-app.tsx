"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { apiRequest, ApiClientError } from "@/lib/api/client"
import type { AuthUserDTO, WorkspaceDTO, WorkspaceInvitationDTO, WorkspaceMemberDTO, WorkspaceRole } from "@/lib/api/contracts"
import { cn } from "@/lib/utils"

type Status = { tone: "neutral" | "success" | "error"; message: string } | null

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-signal-ink">
      {label}
      {children}
    </label>
  )
}

function inputClass() {
  return "h-10 rounded-md border border-signal-line bg-signal-surface px-3 text-sm text-signal-ink outline-none transition focus:border-signal-cyan focus:ring-2 focus:ring-signal-cyan/15"
}

function StatusMessage({ status }: { status: Status }) {
  if (!status) return null
  return (
    <p
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        status.tone === "error" && "border-red-400/30 bg-red-500/10 text-red-200",
        status.tone === "success" && "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
        status.tone === "neutral" && "border-signal-line bg-signal-surface text-signal-muted",
      )}
    >
      {status.message}
    </p>
  )
}

function errorStatus(error: unknown): Status {
  if (error instanceof ApiClientError) return { tone: "error", message: error.message }
  return { tone: "error", message: "Something went wrong." }
}

export function SprintOneApp() {
  const [user, setUser] = useState<AuthUserDTO | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceDTO[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [members, setMembers] = useState<WorkspaceMemberDTO[]>([])
  const [invitations, setInvitations] = useState<WorkspaceInvitationDTO[]>([])
  const [status, setStatus] = useState<Status>(null)

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null
  const canInvite = activeWorkspace?.currentUserRole === "OWNER" || activeWorkspace?.currentUserRole === "ADMIN"

  useEffect(() => {
    let cancelled = false
    apiRequest<{ user: AuthUserDTO }>("/auth/me")
      .then((result) => {
        if (!cancelled) setUser(result.user)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    apiRequest<{ workspaces: WorkspaceDTO[] }>("/workspaces")
      .then((result) => {
        if (cancelled) return
        setWorkspaces(result.workspaces)
        setActiveWorkspaceId((current) => current ?? result.workspaces[0]?.id ?? null)
      })
      .catch((error) => {
        if (!cancelled) setStatus(errorStatus(error))
      })
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (!activeWorkspaceId) return
    let cancelled = false
    Promise.all([
      apiRequest<{ members: WorkspaceMemberDTO[] }>(`/workspaces/${activeWorkspaceId}/members`),
      canInvite
        ? apiRequest<{ invitations: WorkspaceInvitationDTO[] }>(`/workspaces/${activeWorkspaceId}/invitations`)
        : Promise.resolve({ invitations: [] }),
    ])
      .then(([memberResult, invitationResult]) => {
        if (cancelled) return
        setMembers(memberResult.members)
        setInvitations(invitationResult.invitations)
      })
      .catch((error) => {
        if (!cancelled) setStatus(errorStatus(error))
      })
    return () => {
      cancelled = true
    }
  }, [activeWorkspaceId, canInvite])

  async function handleCreateWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const result = await apiRequest<{ workspace: WorkspaceDTO }>("/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: form.get("name") }),
      })
      setWorkspaces((current) => [...current, result.workspace])
      setActiveWorkspaceId(result.workspace.id)
      setStatus({ tone: "success", message: "Workspace created with you as Owner." })
      event.currentTarget.reset()
    } catch (error) {
      setStatus(errorStatus(error))
    }
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeWorkspace) return
    const form = new FormData(event.currentTarget)
    try {
      const result = await apiRequest<{ invitation: WorkspaceInvitationDTO; token: string }>(`/workspaces/${activeWorkspace.id}/invitations`, {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), role: form.get("role") as WorkspaceRole }),
      })
      setInvitations((current) => [result.invitation, ...current])
      setStatus({ tone: "success", message: `Invitation created. Share token: ${result.token}` })
      event.currentTarget.reset()
    } catch (error) {
      setStatus(errorStatus(error))
    }
  }

  async function handleAcceptInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      const result = await apiRequest<{ workspace: WorkspaceDTO; invitation: WorkspaceInvitationDTO }>("/workspaces/invitations/accept", {
        method: "POST",
        body: JSON.stringify({ token: form.get("token") }),
      })
      setWorkspaces((current) => [...current.filter((workspace) => workspace.id !== result.workspace.id), result.workspace])
      setActiveWorkspaceId(result.workspace.id)
      setStatus({ tone: "success", message: "Invitation accepted. Workspace access granted." })
      event.currentTarget.reset()
    } catch (error) {
      setStatus(errorStatus(error))
    }
  }

  async function handleSignOut() {
    await apiRequest<void>("/auth/signout", { method: "POST" })
    setUser(null)
    setWorkspaces([])
    setActiveWorkspaceId(null)
    setStatus({ tone: "neutral", message: "Signed out." })
  }

  return (
    <main className="min-h-dvh bg-signal-carbon text-signal-ink">
      <div className="mx-auto grid min-h-dvh w-full max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-xl border border-signal-line bg-signal-panel p-5 shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-signal-amber">Relay Sprint 1</p>
          <h1 className="mt-3 text-3xl font-semibold text-signal-panel-text">Identity and workspace access</h1>
          <p className="mt-3 text-sm leading-6 text-signal-panel-muted">
            Create an account, create workspaces, invite teammates, and validate role-based access.
          </p>
          <div className="mt-5"><StatusMessage status={status} /></div>
          {user ? (
            <div className="mt-6 rounded-lg border border-white/10 bg-black/10 p-4">
              <p className="text-sm font-semibold text-signal-panel-text">{user.name}</p>
              <p className="text-xs text-signal-panel-muted">{user.email}</p>
              <Button className="mt-4" onClick={handleSignOut} type="button" variant="outline">Sign out</Button>
            </div>
          ) : (
            <div className="mt-6 grid gap-3 rounded-lg border border-white/10 bg-black/10 p-4">
              <p className="text-sm text-signal-panel-muted">Use the dedicated auth pages, then return here to create or enter a workspace.</p>
              <div className="flex flex-wrap gap-2">
                <Button nativeButton={false} render={<Link href="/login" />} type="button">Log in</Button>
                <Button nativeButton={false} render={<Link href="/signup" />} type="button" variant="outline">Sign up</Button>
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-6">
          {!user ? (
            <div className="grid min-h-[420px] place-items-center rounded-xl border border-signal-line bg-signal-surface p-8 text-center">
              <div><h2 className="text-xl font-semibold">Sign in to enter a workspace</h2><p className="mt-2 text-sm text-signal-muted">Workspace APIs and socket context require an authenticated session.</p></div>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-signal-line bg-signal-surface p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                  <div><h2 className="text-xl font-semibold">Workspaces</h2><p className="text-sm text-signal-muted">Switch between active memberships.</p></div>
                  <form className="flex gap-2" onSubmit={handleCreateWorkspace}>
                    <input className={inputClass()} name="name" placeholder="New workspace" required />
                    <Button type="submit">Create</Button>
                  </form>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {workspaces.map((workspace) => (
                    <button className={cn("rounded-lg border px-3 py-2 text-left text-sm", workspace.id === activeWorkspaceId ? "border-signal-amber bg-signal-amber/10" : "border-signal-line bg-transparent")} key={workspace.id} onClick={() => setActiveWorkspaceId(workspace.id)} type="button">
                      <span className="block font-semibold">{workspace.name}</span><span className="text-xs text-signal-muted">{workspace.currentUserRole}</span>
                    </button>
                  ))}
                </div>
              </div>

              {activeWorkspace && (
                <div className="grid gap-6">
                  <div className="flex items-center justify-between rounded-xl border border-signal-amber/30 bg-signal-amber/10 p-5">
                    <div><h2 className="font-semibold">{activeWorkspace.name}</h2><p className="text-sm text-signal-muted">Open the channel workspace.</p></div>
                    <Button nativeButton={false} render={<Link href={`/app/${activeWorkspace.slug}`} />}>Enter workspace</Button>
                  </div>
                  <div className="grid gap-6 xl:grid-cols-2">
                  <div className="rounded-xl border border-signal-line bg-signal-surface p-5">
                    <h2 className="text-lg font-semibold">Members</h2>
                    <div className="mt-4 grid gap-2">
                      {members.map((member) => <div className="rounded-lg border border-signal-line p-3" key={member.id}><p className="font-medium">{member.name}</p><p className="text-xs text-signal-muted">{member.email} · {member.role}</p></div>)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-signal-line bg-signal-surface p-5">
                    <h2 className="text-lg font-semibold">Invitations</h2>
                    {canInvite ? <form className="mt-4 grid gap-3" onSubmit={handleInvite}><Field label="Invite email"><input className={inputClass()} name="email" required type="email" /></Field><Field label="Role"><select className={inputClass()} name="role"><option value="MEMBER">Member</option>{activeWorkspace.currentUserRole === "OWNER" && <option value="ADMIN">Admin</option>}</select></Field><Button type="submit">Invite</Button></form> : <p className="mt-3 text-sm text-signal-muted">Members cannot invite teammates.</p>}
                    <form className="mt-5 grid gap-3 border-t border-signal-line pt-5" onSubmit={handleAcceptInvite}><Field label="Accept invitation token"><input className={inputClass()} name="token" required /></Field><Button type="submit" variant="outline">Accept invitation</Button></form>
                    <div className="mt-4 grid gap-2">{invitations.map((invitation) => <div className="rounded-lg border border-signal-line p-3 text-sm" key={invitation.id}>{invitation.email} · {invitation.role}</div>)}</div>
                  </div>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  )
}
