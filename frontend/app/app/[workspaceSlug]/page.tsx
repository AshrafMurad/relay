import { RelayAppShell } from "@/components/relay/app-shell"

export default async function WorkspacePage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params
  return <RelayAppShell channelId={null} workspaceSlug={workspaceSlug} />
}
