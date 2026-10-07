"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"

import { apiRequest } from "@/lib/api/client"
import type { AuthUserDTO } from "@/lib/api/contracts"

type PublicSessionValue = {
  user: AuthUserDTO | null
  signOut: () => Promise<void>
}

const PublicSessionContext = createContext<PublicSessionValue | null>(null)

export function PublicSessionProvider({ children, initialUser }: { children: ReactNode; initialUser: AuthUserDTO | null }) {
  const router = useRouter()
  const [user, setUser] = useState(initialUser)

  async function signOut() {
    await apiRequest<void>("/auth/signout", { method: "POST" })
    setUser(null)
    router.refresh()
  }

  return <PublicSessionContext value={{ signOut, user }}>{children}</PublicSessionContext>
}

export function usePublicSession() {
  const value = useContext(PublicSessionContext)
  if (!value) throw new Error("usePublicSession must be used within PublicSessionProvider")
  return value
}
