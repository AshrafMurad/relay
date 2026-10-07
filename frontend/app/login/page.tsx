import { redirect } from "next/navigation"

import { AuthPage } from "@/components/relay/auth-page"
import { hasActiveSession } from "@/lib/auth/session"

export default async function LoginPage() {
  if (await hasActiveSession()) redirect("/workspace")

  return <AuthPage mode="login" />
}
