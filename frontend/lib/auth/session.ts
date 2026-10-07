import { cache } from "react"
import { cookies } from "next/headers"

import { API_BASE_URL } from "@/lib/api/client"
import type { AuthUserDTO } from "@/lib/api/contracts"

export const getCurrentSessionUser = cache(async (): Promise<AuthUserDTO | null> => {
  const cookieHeader = (await cookies()).toString()
  if (!cookieHeader) return null

  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      cache: "no-store",
      headers: { cookie: cookieHeader },
    })

    if (!response.ok) return null
    const result = await response.json() as { user: AuthUserDTO }
    return result.user
  } catch {
    return null
  }
})

export async function hasActiveSession() {
  return Boolean(await getCurrentSessionUser())
}
