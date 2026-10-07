"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, CalendarClock, CheckCircle2, ShieldCheck, UserRound } from "lucide-react"
import { startTransition, useEffect, useState } from "react"

import { BrandLogo } from "@/components/relay/brand-logo"
import { usePublicSession } from "@/components/relay/public-session-provider"
import { Button } from "@/components/ui/button"
import { apiRequest } from "@/lib/api/client"
import type { WorkspaceDTO, WorkspaceInvitationDTO, WorkspaceInvitationPreviewDTO } from "@/lib/api/contracts"

const LAST_WORKSPACE_KEY = "relay:last-workspace"

const terminalCopy: Record<Exclude<WorkspaceInvitationPreviewDTO["status"], "PENDING">, { title: string; detail: string }> = {
  ACCEPTED: { title: "This invitation was already used", detail: "Sign in to Relay to open workspaces you already belong to." },
  EXPIRED: { title: "This invitation has expired", detail: "Ask a workspace Owner or Admin to send a new invitation." },
  REVOKED: { title: "This invitation was revoked", detail: "Ask the workspace team if you still need access." },
}

export function InvitationPage({ token }: { token: string }) {
  const router = useRouter()
  const { user } = usePublicSession()
  const [invitation, setInvitation] = useState<WorkspaceInvitationPreviewDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState("")
  const returnPath = `/invite/${encodeURIComponent(token)}`
  const authQuery = encodeURIComponent(returnPath)

  useEffect(() => {
    let cancelled = false
    apiRequest<{ invitation: WorkspaceInvitationPreviewDTO }>(`/workspaces/invitations/${encodeURIComponent(token)}`)
      .then(async (result) => {
        if (cancelled) return
        setInvitation(result.invitation)
      })
      .catch((caught) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Invitation could not be checked.")
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  async function acceptInvitation() {
    setAccepting(true)
    setError("")
    try {
      const result = await apiRequest<{ invitation: WorkspaceInvitationDTO; workspace: WorkspaceDTO }>("/workspaces/invitations/accept", {
        method: "POST",
        body: JSON.stringify({ token }),
      })
      window.localStorage.setItem(LAST_WORKSPACE_KEY, result.workspace.slug)
      startTransition(() => router.replace(`/app/${result.workspace.slug}`))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invitation could not be accepted.")
      setAccepting(false)
    }
  }

  return (
    <main className="grid flex-1 place-items-center px-2 py-6 sm:px-5 sm:py-10">
        <section className="panel-prominent w-full max-w-xl p-6 sm:p-8">
          {loading ? (
            <div className="text-center" role="status"><div className="mx-auto size-11"><BrandLogo mark="icon" priority /></div><p className="mt-4 text-sm font-semibold">Checking invitation</p></div>
          ) : !invitation ? (
            <div className="text-center"><h1 className="text-page-title">Invitation unavailable</h1><p className="text-body mt-3 text-muted-foreground">{error || "This invitation link is invalid."}</p><Button className="mt-6" nativeButton={false} render={<Link href="/app" />}>Go to Relay</Button></div>
          ) : invitation.status !== "PENDING" ? (
            <div className="text-center"><h1 className="text-page-title">{terminalCopy[invitation.status].title}</h1><p className="text-body mt-3 text-muted-foreground">{terminalCopy[invitation.status].detail}</p><Button className="mt-6" nativeButton={false} render={<Link href="/app" />}>Open Relay</Button></div>
          ) : (
            <>
              <div className="grid size-11 place-items-center rounded-lg bg-signal-carbon text-signal-cyan"><ShieldCheck className="size-5" /></div>
              <h1 className="text-page-title mt-6">Join {invitation.workspaceName}</h1>
              <p className="text-body mt-3 text-muted-foreground">You have been invited to collaborate in this Relay workspace.</p>
              <dl className="mt-7 divide-y divide-border border-y border-border text-sm">
                <div className="flex items-center gap-3 py-3"><UserRound className="size-4 text-muted-foreground" /><dt className="text-muted-foreground">Invited account</dt><dd className="ml-auto font-medium">{invitation.emailHint}</dd></div>
                <div className="flex items-center gap-3 py-3"><CheckCircle2 className="size-4 text-muted-foreground" /><dt className="text-muted-foreground">Workspace role</dt><dd className="ml-auto font-medium">{invitation.role === "ADMIN" ? "Admin" : "Member"}</dd></div>
                <div className="flex items-center gap-3 py-3"><CalendarClock className="size-4 text-muted-foreground" /><dt className="text-muted-foreground">Expires</dt><dd className="ml-auto font-medium">{new Date(invitation.expiresAt).toLocaleDateString()}</dd></div>
              </dl>
              {error && <p className="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
              {user ? (
                <div className="mt-6">
                  <p className="text-helper mb-3 text-muted-foreground">Signed in as <span className="font-semibold text-foreground">{user.email}</span>. The account email must match the invitation.</p>
                  <Button className="w-full" disabled={accepting} onClick={() => void acceptInvitation()} type="button">{accepting ? "Joining..." : `Join ${invitation.workspaceName}`}<ArrowRight /></Button>
                </div>
              ) : (
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  <Button nativeButton={false} render={<Link href={`/signup?next=${authQuery}`} />}>Create account<ArrowRight /></Button>
                  <Button nativeButton={false} render={<Link href={`/login?next=${authQuery}`} />} variant="outline">Log in</Button>
                </div>
              )}
            </>
          )}
        </section>
    </main>
  )
}
