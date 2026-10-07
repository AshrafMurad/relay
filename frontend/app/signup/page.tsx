import { redirect } from "next/navigation"

import { AuthPage } from "@/components/relay/auth-page"
import { hasActiveSession } from "@/lib/auth/session"

export default async function SignupPage() {
  if (await hasActiveSession()) redirect("/workspace")

  return <AuthPage mode="signup" />
}
