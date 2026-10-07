import { InvitationPage } from "@/components/relay/invitation-page"

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <InvitationPage token={token} />
}
