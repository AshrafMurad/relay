"use client"

import { Check, Clipboard, MailPlus, Settings, Shield, Trash2, UserRound, X } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { ApiClientError, apiRequest } from "@/lib/api/client"
import type { WorkspaceDTO, WorkspaceInvitationDTO, WorkspaceMemberDTO, WorkspaceRole } from "@/lib/api/contracts"

function invitationState(invitation: WorkspaceInvitationDTO) {
  if (invitation.acceptedAt) return "Accepted"
  if (invitation.revokedAt) return "Revoked"
  if (new Date(invitation.expiresAt) <= new Date()) return "Expired"
  return "Pending"
}

function validateEmail(value: string) {
  if (!value) return "Enter an email address."
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Enter a valid email address."
  return ""
}

export function WorkspaceMembersPage({ workspaceSlug }: { workspaceSlug: string }) {
  const [workspace, setWorkspace] = useState<WorkspaceDTO | null>(null)
  const [members, setMembers] = useState<WorkspaceMemberDTO[]>([])
  const [invitations, setInvitations] = useState<WorkspaceInvitationDTO[]>([])
  const [inviteUrl, setInviteUrl] = useState("")
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [memberAction, setMemberAction] = useState("")
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMemberDTO | null>(null)
  const [error, setError] = useState("")
  const [emailError, setEmailError] = useState("")

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
    const email = String(data.get("email") ?? "").trim()
    const nextEmailError = validateEmail(email)
    if (nextEmailError) {
      setEmailError(nextEmailError)
      return
    }
    setSubmitting(true)
    setError("")
    setEmailError("")
    setInviteUrl("")
    try {
      const result = await apiRequest<{ invitation: WorkspaceInvitationDTO; token: string }>(`/workspaces/${workspace.id}/invitations`, {
        method: "POST",
        body: JSON.stringify({ email, role: data.get("role") as WorkspaceRole }),
      })
      const url = `${window.location.origin}/invite/${encodeURIComponent(result.token)}`
      setInvitations((current) => [result.invitation, ...current])
      setInviteUrl(url)
      setCopied(false)
      form.reset()
      toast.success("Invitation created", { description: `Invite link for ${email} is ready to share.` })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Invitation could not be created."
      setError(message)
      toast.error("Invite was not created", { description: message })
    } finally {
      setSubmitting(false)
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      toast.success("Invite link copied", { description: "The invitation link is on your clipboard." })
    } catch {
      const message = "Copy was blocked by the browser. Select and copy the invitation link manually."
      setError(message)
      toast.error("Copy failed", { description: message })
    }
  }

  async function revoke(invitationId: string) {
    if (!workspace) return
    setError("")
    try {
      const result = await apiRequest<{ invitation: WorkspaceInvitationDTO }>(`/workspaces/${workspace.id}/invitations/${invitationId}`, { method: "DELETE" })
      setInvitations((current) => current.map((item) => item.id === invitationId ? result.invitation : item))
      toast.success("Invitation revoked", { description: "That invite link can no longer be accepted." })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Invitation could not be revoked."
      setError(message)
      toast.error("Revoke failed", { description: message })
    }
  }

  async function saveWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!workspace) return
    const name = String(new FormData(event.currentTarget).get("name") ?? "").trim()
    setSubmitting(true)
    setError("")
    try {
      const result = await apiRequest<{ workspace: WorkspaceDTO }>(`/workspaces/${workspace.id}`, { method: "PATCH", body: JSON.stringify({ name }) })
      setWorkspace(result.workspace)
      toast.success("Workspace updated")
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Workspace settings could not be updated."
      setError(message)
      toast.error("Update failed", { description: message })
    } finally {
      setSubmitting(false)
    }
  }

  async function changeRole(member: WorkspaceMemberDTO, role: "ADMIN" | "MEMBER") {
    if (!workspace || role === member.role) return
    setMemberAction(member.id)
    setError("")
    try {
      const result = await apiRequest<{ member: WorkspaceMemberDTO }>(`/workspaces/${workspace.id}/members/${member.id}`, { method: "PATCH", body: JSON.stringify({ role }) })
      setMembers((current) => current.map((item) => item.id === member.id ? result.member : item))
      toast.success("Member role updated", { description: `${member.name} is now ${role === "ADMIN" ? "an admin" : "a member"}.` })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The member role could not be updated."
      setError(message)
      toast.error("Role update failed", { description: message })
    } finally {
      setMemberAction("")
    }
  }

  async function removeMember() {
    if (!workspace || !memberToRemove) return
    const member = memberToRemove
    setMemberAction(member.id)
    setError("")
    try {
      await apiRequest(`/workspaces/${workspace.id}/members/${member.id}`, { method: "DELETE" })
      setMembers((current) => current.filter((item) => item.id !== member.id))
      setMemberToRemove(null)
      toast.success("Member removed", { description: `${member.name} no longer has workspace access.` })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The member could not be removed."
      setError(message)
      toast.error("Removal failed", { description: message })
    } finally {
      setMemberAction("")
    }
  }

  if (loading) return <div className="grid min-h-72 place-items-center text-sm text-signal-muted" role="status"><span className="inline-flex items-center gap-2"><Spinner className="text-signal-cyan" />Loading members...</span></div>

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
      <div className="mx-auto max-w-4xl">
        {error && <p className="mb-5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}

        {workspace?.currentUserRole === "OWNER" && (
          <section className="border-b border-signal-line pb-5">
            <div className="flex items-center gap-2"><Settings className="size-4 text-signal-cyan" /><h2 className="text-sm font-semibold">Workspace settings</h2></div>
            <form className="mt-4 flex gap-2" onSubmit={saveWorkspace}><label className="sr-only" htmlFor="workspace-name">Workspace name</label><Input defaultValue={workspace.name} id="workspace-name" maxLength={120} minLength={2} name="name" required /><Button disabled={submitting} type="submit">{submitting && <Spinner />}Save</Button></form>
          </section>
        )}

        {canInvite && (
          <section className={`${workspace?.currentUserRole === "OWNER" ? "mt-6" : ""} border-b border-signal-line pb-5`}>
            <div className="flex items-center gap-2"><MailPlus className="size-4 text-signal-cyan" /><h2 className="text-sm font-semibold">Invite a teammate</h2></div>
            <form className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px_auto]" noValidate onSubmit={invite}>
              <div>
                <label className="sr-only" htmlFor="invite-email">Email address</label><Input aria-describedby={emailError ? "invite-email-error" : undefined} aria-invalid={Boolean(emailError)} fieldSize="compact" id="invite-email" inputMode="email" name="email" onChange={() => setEmailError("")} placeholder="teammate@example.com" />
                {emailError && <p className="text-helper mt-1.5 font-semibold text-destructive" id="invite-email-error">{emailError}</p>}
              </div>
              <label className="sr-only" id="invite-role-label">Role</label><Select defaultValue="MEMBER" name="role"><SelectTrigger aria-labelledby="invite-role-label" className="w-full" id="invite-role"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MEMBER">Member</SelectItem>{workspace?.currentUserRole === "OWNER" && <SelectItem value="ADMIN">Admin</SelectItem>}</SelectContent></Select>
              <Button disabled={submitting} type="submit">{submitting && <Spinner />}{submitting ? "Creating" : "Create invite"}</Button>
            </form>
            {inviteUrl && (
              <div className="mt-4 border-t border-signal-line pt-4"><p className="text-xs font-semibold">Invitation link created</p><p className="mt-1 text-xs text-signal-muted">Share this link only with the invited person. It expires after seven days.</p><div className="mt-3 flex gap-2"><Input aria-label="Invitation link" className="min-w-0 flex-1 font-mono text-xs" fieldSize="compact" readOnly value={inviteUrl} /><Button onClick={() => void copyInvite()} type="button" variant="outline">{copied ? <Check /> : <Clipboard />}{copied ? "Copied" : "Copy"}</Button></div></div>
            )}
          </section>
        )}

        <section className="mt-6">
          <h2 className="text-sm font-semibold">Active members <span className="ml-1 text-signal-muted">{members.length}</span></h2>
          <div className="mt-3 divide-y divide-signal-line border-y border-signal-line">
            {members.map((member) => {
              const mayChangeRole = workspace?.currentUserRole === "OWNER" && member.role !== "OWNER"
              const mayRemove = member.role !== "OWNER" && (workspace?.currentUserRole === "OWNER" || (workspace?.currentUserRole === "ADMIN" && member.role === "MEMBER"))
              return <div className="flex min-h-14 items-center gap-3 py-3" key={member.id}><span className="grid size-8 place-items-center rounded-md bg-signal-surface-raised"><UserRound className="size-4 text-signal-muted" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{member.name}</p><p className="truncate text-xs text-signal-muted">{member.email}</p></div>{mayChangeRole ? <Select disabled={memberAction === member.id} onValueChange={(role) => void changeRole(member, role as "ADMIN" | "MEMBER")} value={member.role}><SelectTrigger aria-label={`Role for ${member.name}`} className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ADMIN">Admin</SelectItem><SelectItem value="MEMBER">Member</SelectItem></SelectContent></Select> : <span className="flex items-center gap-1 text-xs text-signal-muted"><Shield className="size-3" />{member.role.toLowerCase()}</span>}{mayRemove && <Button aria-label={`Remove ${member.name}`} disabled={memberAction === member.id} onClick={() => setMemberToRemove(member)} size="icon" type="button" variant="ghost"><Trash2 /></Button>}</div>
            })}
          </div>
        </section>

        {canInvite && (
          <section className="mt-6">
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
      <Dialog onOpenChange={(open) => { if (!open && !memberAction) setMemberToRemove(null) }} open={Boolean(memberToRemove)}>
        <DialogContent className="border-signal-line bg-signal-paper text-signal-ink ring-0" showCloseButton={!memberAction}>
          <DialogHeader className="pr-8">
            <DialogTitle>Remove {memberToRemove?.name}?</DialogTitle>
            <DialogDescription>{memberToRemove?.name} will immediately lose access to {workspace?.name}. Their membership record and message history will be retained.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-signal-line bg-signal-surface/60">
            <Button disabled={Boolean(memberAction)} onClick={() => setMemberToRemove(null)} type="button" variant="outline">Cancel</Button>
            <Button disabled={Boolean(memberAction)} onClick={() => void removeMember()} type="button" variant="destructive">{memberAction && <Spinner />}{memberAction ? "Removing" : "Remove member"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
