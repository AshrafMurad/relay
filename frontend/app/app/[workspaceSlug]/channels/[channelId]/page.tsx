import { RelayAppShell } from "@/components/relay/app-shell"

export default async function ChannelPage({ params }: { params: Promise<{ workspaceSlug: string; channelId: string }> }) {
  const { workspaceSlug, channelId } = await params
  return <RelayAppShell channelId={channelId} workspaceSlug={workspaceSlug} />
}
