import { WorkspaceGateway } from "@/components/relay/workspace-gateway"

export default async function AppEntryPage({ searchParams }: { searchParams: Promise<{ choose?: string }> }) {
  const query = await searchParams
  return <WorkspaceGateway forceChoose={query.choose === "1"} />
}
