"use client"

import { Check, Clipboard, MailPlus, Shield, UserRound, X } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import { ApiClientError, apiRequest } from "@/lib/api/client"
import type { WorkspaceDTO, WorkspaceInvitationDTO, WorkspaceMemberDTO, WorkspaceRole } from "@/lib/api/contracts"

function inputClass() {
  return "h-9 rounded-md border border-signal-line bg-signal-surface px-3 text-sm text-signal-ink outline-none transition focus:border-signal-cyan focus:ring-2 focus:ring-signal-cyan/15"
}

function invitationState(invitation: WorkspaceInvitationDTO) {
  if (invitation.acceptedAt) return "Accepted"
  if (invitation.revokedAt) return "Revoked"
  if (new Date(invitation.expiresAt) <= new Date()) return "Expired"
  return "Pending"
}

export function WorkspaceMembersPage({ workspaceSlug }: { workspaceSlug: string }) {
  const [workspace, setWorkspace] = useState<WorkspaceDTO | null>(null)
  const [members, setMembers] = useState<WorkspaceMemberDTO[]>([])
  const [invitations, setInvitations] = useState<WorkspaceInvitationDTO[]>([])
  const [inviteUrl, setInviteUrl] = useState("")
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const canInvite = workspace?.currentUserRole === "OWNER" || workspace?.currentUserRole === "ADMIN"

  useEffect(() => {
    let cancelled = false
    apiRequest<{ workspaces: WorkspaceDTO[] }>("/workspaces").then(async ({ workspaces }) => {
      const current = workspaces.find((item) => item.slug === workspaceSlug)
      if (!current) throw new ApiClientError("WORKSPACE_NOT_FOUND", "Workspace was not found.")
      const [memberResult, invitationResult] = await Promise.all([
        apiRequest<{ members: WorkspaceMemberDTO[] }>(`/workspaces/${current.id}/members`),
        current.currentUserRole === "MEMBER"
          ? Promise.resolve({ invitations: [] })
          : apiRequest<{ invitations: WorkspaceInvitationDTO[] }>(`/workspaces/${current.id}/invitations`),
      ])
      if (cancelled) return
      setWorkspace(current)
      setMembers(memberResult.members)
      setInvitations(invitationResult.invitations)
    }).catch((caught) => {
      if (!cancelled) setError(caught instanceof Error ? caught.message : "Members could not be loaded.")
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [workspaceSlug])

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!workspace) return
    const form = event.currentTarget
    const data = new FormData(form)
    setSubmitting(true)
    setError("")
    setInviteUrl("")
    try {
      const result = await apiRequest<{ invitation: WorkspaceInvitationDTO; token: string }>(`/workspaces/${workspace.id}/invitations`, {
        method: "POST",
        body: JSON.stringify({ email: data.get("email"), role: data.get("role") as WorkspaceRole }),
      })
      const url = `${window.location.origin}/invite/${encodeURIComponent(result.token)}`
      setInvitations((current) => [result.invitation, ...current])
      setInviteUrl(url)
      setCopied(false)
      form.reset()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invitation could not be created.")
    } finally {
      setSubmitting(false)
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
    } catch {
      setError("Copy was blocked by the browser. Select and copy the invitation link manually.")
    }
  }

  async function revoke(invitationId: string) {
    if (!workspace) return
    setError("")
    try {
      const result = await apiRequest<{ invitation: WorkspaceInvitationDTO }>(`/workspaces/${workspace.id}/invitations/${invitationId}`, { method: "DELETE" })
      setInvitations((current) => current.map((item) => item.id === invitationId ? result.invitation : item))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invitation could not be revoked.")
    }
  }

  if (loading) return <div className="grid min-h-0 flex-1 place-items-center text-sm text-signal-muted" role="status">Loading members...</div>

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-7 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="max-w-2xl"><h1 className="text-2xl font-semibold tracking-[-0.02em]">Members</h1><p className="mt-2 text-sm leading-6 text-signal-muted">People with access to {workspace?.name ?? "this workspace"}, and invitations waiting to be accepted.</p></header>
        {error && <p className="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}

        {canInvite && (
          <section className="mt-8 border-y border-signal-line py-6">
            <div className="flex items-center gap-2"><MailPlus className="size-4 text-signal-cyan" /><h2 className="text-sm font-semibold">Invite a teammate</h2></div>
            <form className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]" onSubmit={invite}>
              <label className="sr-only" htmlFor="invite-email">Email address</label><input className={inputClass()} id="invite-email" name="email" placeholder="teammate@example.com" required type="email" />
              <label className="sr-only" htmlFor="invite-role">Role</label><select className={inputClass()} id="invite-role" name="role"><option value="MEMBER">Member</option>{workspace?.currentUserRole === "OWNER" && <option value="ADMIN">Admin</option>}</select>
              <Button disabled={submitting} type="submit">{submitting ? "Creating..." : "Create invite"}</Button>
            </form>
            {inviteUrl && (
              <div className="mt-4 border-t border-signal-line pt-4"><p className="text-xs font-semibold">Invitation link created</p><p className="mt-1 text-xs text-signal-muted">Share this link only with the invited person. It expires after seven days.</p><div className="mt-3 flex gap-2"><input aria-label="Invitation link" className={`${inputClass()} min-w-0 flex-1 font-mono text-xs`} readOnly value={inviteUrl} /><Button onClick={() => void copyInvite()} type="button" variant="outline">{copied ? <Check /> : <Clipboard />}{copied ? "Copied" : "Copy"}</Button></div></div>
            )}
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-sm font-semibold">Active members <span className="ml-1 text-signal-muted">{members.length}</span></h2>
          <div className="mt-3 divide-y divide-signal-line border-y border-signal-line">
            {members.map((member) => (
              <div className="flex min-h-14 items-center gap-3 py-3" key={member.id}><span className="grid size-8 place-items-center rounded-md bg-signal-surface-raised"><UserRound className="size-4 text-signal-muted" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{member.name}</p><p className="truncate text-xs text-signal-muted">{member.email}</p></div><span className="flex items-center gap-1 text-xs text-signal-muted"><Shield className="size-3" />{member.role.toLowerCase()}</span></div>
            ))}
          </div>
        </section>

        {canInvite && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold">Invitations</h2>
            {invitations.length === 0 ? <p className="mt-3 border-y border-signal-line py-5 text-sm text-signal-muted">No invitations have been created.</p> : (
              <div className="mt-3 divide-y divide-signal-line border-y border-signal-line">
                {invitations.map((invitation) => {
                  const state = invitationState(invitation)
                  const mayRevoke = state === "Pending" && (workspace?.currentUserRole === "OWNER" || invitation.role === "MEMBER")
                  return <div className="flex min-h-14 items-center gap-3 py-3" key={invitation.id}><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{invitation.email}</p><p className="text-xs text-signal-muted">{invitation.role.toLowerCase()} · {state}</p></div>{mayRevoke && <Button aria-label={`Revoke invitation for ${invitation.email}`} onClick={() => void revoke(invitation.id)} size="sm" type="button" variant="ghost"><X />Revoke</Button>}</div>
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
