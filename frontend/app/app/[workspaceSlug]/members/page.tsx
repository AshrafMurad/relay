import { WorkspaceMembersPage } from "@/components/relay/workspace-members-page"

export default async function MembersPage({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params
  return <WorkspaceMembersPage workspaceSlug={workspaceSlug} />
}
