import type { ReactNode } from "react"

import { RelayAppShell } from "@/components/relay/app-shell"

export default function AppLayout({ children }: { children: ReactNode }) {
  return <RelayAppShell>{children}</RelayAppShell>
}
