import { SearchPage } from "@/components/relay/search-page"

export default async function WorkspaceSearchRoute({ params }: { params: Promise<{ workspaceSlug: string }> }) {
  const { workspaceSlug } = await params
  return <SearchPage workspaceSlug={workspaceSlug} />
}
