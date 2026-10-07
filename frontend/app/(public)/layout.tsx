import type { ReactNode } from "react"

import { PublicNavigation } from "@/components/relay/public-navigation"
import { PublicSessionProvider } from "@/components/relay/public-session-provider"
import { getCurrentSessionUser } from "@/lib/auth/session"

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentSessionUser()

  return (
    <PublicSessionProvider initialUser={user}>
      <div className="public-frame">
        <div className="public-container flex flex-col">
          <PublicNavigation />
          <div className="flex min-h-0 flex-1 flex-col py-4">{children}</div>
        </div>
      </div>
    </PublicSessionProvider>
  )
}
