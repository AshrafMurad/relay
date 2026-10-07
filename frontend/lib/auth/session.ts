import { cookies } from "next/headers"

import { API_BASE_URL } from "@/lib/api/client"

export async function hasActiveSession() {
  const cookieHeader = (await cookies()).toString()
  if (!cookieHeader) return false

  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      cache: "no-store",
      headers: { cookie: cookieHeader },
    })

    return response.ok
  } catch {
    return false
  }
}
