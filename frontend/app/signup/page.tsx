import { redirect } from "next/navigation"

import { AuthPage } from "@/components/relay/auth-page"
import { safeNextPath } from "@/lib/auth/redirect"
import { hasActiveSession } from "@/lib/auth/session"

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const nextPath = safeNextPath((await searchParams).next)
  if (await hasActiveSession()) redirect(nextPath)

  return <AuthPage mode="signup" nextPath={nextPath} />
}
