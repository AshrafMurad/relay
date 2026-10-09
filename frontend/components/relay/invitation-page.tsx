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
import { useErrorTranslator } from "@/lib/i18n/errors"
import { useTranslateT } from "@/lib/i18n/use-translate-t"

const LAST_WORKSPACE_KEY = "relay:last-workspace"

export function InvitationPage({ token }: { token: string }) {
  const router = useRouter()
  const common = useTranslateT("common")
  const t = useTranslateT("invitation")
  const errors = useErrorTranslator()
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
        if (!cancelled) setError(errors.apiError(caught))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [errors, token])

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
      setError(errors.apiError(caught))
      setAccepting(false)
    }
  }

  return (
    <main className="grid flex-1 place-items-center px-2 py-6 sm:px-5 sm:py-10">
        <section className="panel-prominent w-full max-w-xl p-6 sm:p-8">
          {loading ? (
            <div className="text-center" role="status"><div className="mx-auto size-11"><BrandLogo mark="icon" priority /></div><p className="mt-4 text-sm font-semibold">{t("loading")}</p></div>
          ) : !invitation ? (
            <div className="text-center"><h1 className="text-page-title">{t("unavailableTitle")}</h1><p className="text-body mt-3 text-muted-foreground">{error || t("invalidLink")}</p><Button className="mt-6" nativeButton={false} render={<Link href="/app" />}>{t("goToRelay")}</Button></div>
          ) : invitation.status !== "PENDING" ? (
            <div className="text-center"><h1 className="text-page-title">{t(`terminal.${invitation.status}.title`)}</h1><p className="text-body mt-3 text-muted-foreground">{t(`terminal.${invitation.status}.detail`)}</p><Button className="mt-6" nativeButton={false} render={<Link href="/app" />}>{t("openRelay")}</Button></div>
          ) : (
            <>
              <div className="grid size-11 place-items-center rounded-lg bg-signal-carbon text-signal-cyan"><ShieldCheck className="size-5" /></div>
              <h1 className="text-page-title mt-6">{t("joinWorkspace", { name: invitation.workspaceName })}</h1>
              <p className="text-body mt-3 text-muted-foreground">{t("invitedBody")}</p>
              <dl className="mt-7 divide-y divide-border border-y border-border text-sm">
                <div className="flex items-center gap-3 py-3"><UserRound className="size-4 text-muted-foreground" /><dt className="text-muted-foreground">{t("invitedAccount")}</dt><dd className="ml-auto font-medium">{invitation.emailHint}</dd></div>
                <div className="flex items-center gap-3 py-3"><CheckCircle2 className="size-4 text-muted-foreground" /><dt className="text-muted-foreground">{t("workspaceRole")}</dt><dd className="ml-auto font-medium">{invitation.role === "ADMIN" ? common("role.admin") : common("role.member")}</dd></div>
                <div className="flex items-center gap-3 py-3"><CalendarClock className="size-4 text-muted-foreground" /><dt className="text-muted-foreground">{t("expires")}</dt><dd className="ml-auto font-medium">{new Date(invitation.expiresAt).toLocaleDateString()}</dd></div>
              </dl>
              {error && <p className="mt-5 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
              {user ? (
                <div className="mt-6">
                  <p className="text-helper mb-3 text-muted-foreground">{t("signedInAs", { email: user.email })}</p>
                  <Button className="w-full" disabled={accepting} onClick={() => void acceptInvitation()} type="button">{accepting ? t("joining") : t("joinWorkspace", { name: invitation.workspaceName })}<ArrowRight /></Button>
                </div>
              ) : (
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  <Button nativeButton={false} render={<Link href={`/signup?next=${authQuery}`} />}>{t("createAccount")}<ArrowRight /></Button>
                  <Button nativeButton={false} render={<Link href={`/login?next=${authQuery}`} />} variant="outline">{t("login")}</Button>
                </div>
              )}
            </>
          )}
        </section>
    </main>
  )
}
