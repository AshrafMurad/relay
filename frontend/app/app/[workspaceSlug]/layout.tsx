import type { ReactNode } from "react"

import { RelayAppShell } from "@/components/relay/app-shell"

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ workspaceSlug: string }>
}) {
  const { workspaceSlug } = await params
  return <RelayAppShell workspaceSlug={workspaceSlug}>{children}</RelayAppShell>
}
