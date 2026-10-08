"use client"

import Link from "next/link"
import { useParams, usePathname, useRouter } from "next/navigation"
import { startTransition, useEffect, useState, type FormEvent, type ReactNode } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { AppHeader } from "@/components/relay/app-shell/app-header"
import { ChannelDetails } from "@/components/relay/app-shell/channel-details"
import { AccountImagesDialog, ChannelFormDialog, UtilityDialog, type ChannelFormMode } from "@/components/relay/app-shell/dialogs"
import { WorkspaceNavigation, WorkspaceRail } from "@/components/relay/app-shell/navigation"
import { BrandLogo } from "@/components/relay/brand-logo"
import { ChannelMessages } from "@/components/relay/channel-messages"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ApiClientError, apiRequest } from "@/lib/api/client"
import type { AuthUserDTO, ChannelDTO, ConversationReadStateDTO, DirectConversationDTO, MessageDTO, WorkspaceDTO, WorkspaceMemberDTO } from "@/lib/api/contracts"
import { canManageChannels, channelNameSchema } from "@/lib/channels"
import { cn } from "@/lib/utils"

type LoadState = "loading" | "ready" | "error"

function LoadingShell() {
  return (
    <main className="grid h-dvh place-items-center bg-signal-paper p-6 text-signal-ink">
      <div className="w-full max-w-sm text-center" role="status">
        <div className="mx-auto size-12"><BrandLogo mark="icon" priority /></div>
        <p className="mt-4 text-sm font-semibold">Opening workspace</p>
        <p className="mt-1 text-xs text-signal-muted">Loading routes, members, and unread state.</p>
        <Spinner className="mx-auto mt-5 size-5 text-signal-cyan" />
      </div>
    </main>
  )
}

export function RelayAppShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams<{ workspaceSlug?: string | string[]; channelId?: string | string[]; conversationId?: string | string[] }>()
  const workspaceSlug = typeof params.workspaceSlug === "string" ? params.workspaceSlug : ""
  const channelId = typeof params.channelId === "string" ? params.channelId : null
  const conversationId = typeof params.conversationId === "string" ? params.conversationId : null
  const [state, setState] = useState<LoadState>("loading")
  const [user, setUser] = useState<AuthUserDTO | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceDTO[]>([])
  const [workspace, setWorkspace] = useState<WorkspaceDTO | null>(null)
  const [channels, setChannels] = useState<ChannelDTO[]>([])
  const [members, setMembers] = useState<WorkspaceMemberDTO[]>([])
  const [directConversations, setDirectConversations] = useState<DirectConversationDTO[]>([])
  const [error, setError] = useState("")
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(() => new Set())
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<ChannelFormMode>("create")
  const [channelNameError, setChannelNameError] = useState("")
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null)
  const [workspaceImageFile, setWorkspaceImageFile] = useState<File | null>(null)
  const [profilePreview, setProfilePreview] = useState<string | null>(null)
  const [workspacePreview, setWorkspacePreview] = useState<string | null>(null)
  const [imageError, setImageError] = useState("")
  const [imageSubmitting, setImageSubmitting] = useState<"profile" | "workspace" | null>(null)
  const [imageUploadProgress, setImageUploadProgress] = useState(0)

  const selectedChannel = channels.find((channel) => channel.id === channelId) ?? null
  const selectedDirectConversation = directConversations.find((conversation) => conversation.id === conversationId) ?? null
  const targetWorkspace = workspaces.find((item) => item.slug === workspaceSlug) ?? workspace
  const isSwitchingWorkspace = state === "loading" && Boolean(workspace && user && workspaceSlug)
  const isMembersPage = pathname.endsWith("/members")
  const isSearchPage = pathname.endsWith("/search")
  const isUtilityPage = isMembersPage || isSearchPage
  const mayManage = workspace ? canManageChannels(workspace.currentUserRole) : false

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!workspaceSlug) return
      setState("loading")
      setError("")
      try {
        const [{ user: currentUser }, { workspaces: availableWorkspaces }] = await Promise.all([
          apiRequest<{ user: AuthUserDTO }>("/auth/me"),
          apiRequest<{ workspaces: WorkspaceDTO[] }>("/workspaces"),
        ])
        const currentWorkspace = availableWorkspaces.find((item) => item.slug === workspaceSlug)
        if (!currentWorkspace) throw new ApiClientError("WORKSPACE_NOT_FOUND", "Workspace was not found or is no longer available.")
        const [{ channels: availableChannels }, { members: workspaceMembers }, { conversations }] = await Promise.all([
          apiRequest<{ channels: ChannelDTO[] }>(`/workspaces/${currentWorkspace.id}/channels`),
          apiRequest<{ members: WorkspaceMemberDTO[] }>(`/workspaces/${currentWorkspace.id}/members`),
          apiRequest<{ conversations: DirectConversationDTO[] }>(`/workspaces/${currentWorkspace.id}/direct-conversations`),
        ])
        if (cancelled) return
        setUser(currentUser)
        setWorkspaces(availableWorkspaces)
        setWorkspace(currentWorkspace)
        setChannels(availableChannels)
        setMembers(workspaceMembers)
        setDirectConversations(conversations)
        window.localStorage.setItem("relay:last-workspace", currentWorkspace.slug)
        setState("ready")
      } catch (caught) {
        if (cancelled) return
        if (caught instanceof ApiClientError && caught.code === "UNAUTHORIZED") {
          startTransition(() => router.replace("/login"))
          return
        }
        setError(caught instanceof Error ? caught.message : "Workspace could not be loaded.")
        setState("error")
      }
    }

    void load()
    return () => { cancelled = true }
  }, [router, workspaceSlug])

  useEffect(() => {
    return () => { if (profilePreview) URL.revokeObjectURL(profilePreview) }
  }, [profilePreview])

  useEffect(() => {
    return () => { if (workspacePreview) URL.revokeObjectURL(workspacePreview) }
  }, [workspacePreview])

  useEffect(() => {
    if (!imageSubmitting) return
    const interval = window.setInterval(() => setImageUploadProgress((current) => Math.min(current + 12, 88)), 250)
    return () => window.clearInterval(interval)
  }, [imageSubmitting])

  useEffect(() => {
    if (state !== "ready" || channelId || conversationId || pathname.endsWith("/search") || pathname.endsWith("/members") || !workspace || channels.length === 0) return
    const first = channels.find((channel) => !channel.archivedAt) ?? channels[0]
    startTransition(() => router.replace(`/app/${workspace.slug}/channels/${first.id}`))
  }, [channelId, conversationId, channels, pathname, router, state, workspace])

  async function openDirectMessage(otherUserId: string) {
    if (!workspace) return
    try {
      const { conversation } = await apiRequest<{ conversation: DirectConversationDTO }>(`/workspaces/${workspace.id}/direct-conversations`, {
        method: "POST",
        body: JSON.stringify({ userId: otherUserId }),
      })
      setDirectConversations((current) => current.some((item) => item.id === conversation.id) ? current : [conversation, ...current])
      setNavigationOpen(false)
      startTransition(() => router.push(`/app/${workspace.slug}/dm/${conversation.id}`))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Direct message could not be opened.")
    }
  }

  function updateConversationActivity(conversation: { type: "channel" | "dm"; id: string }, message: MessageDTO) {
    if (conversation.type === "channel") {
      setChannels((current) => current
        .map((channel) => channel.id === conversation.id ? { ...channel, lastMessageAt: message.createdAt, unreadCount: channel.id === channelId || message.author.id === user?.id ? channel.unreadCount : channel.unreadCount + 1 } : channel)
        .sort((left, right) => {
          if (left.archivedAt && !right.archivedAt) return 1
          if (!left.archivedAt && right.archivedAt) return -1
          return (right.lastMessageAt ?? right.updatedAt).localeCompare(left.lastMessageAt ?? left.updatedAt) || left.name.localeCompare(right.name)
        }))
      return
    }
    setDirectConversations((current) => current
      .map((item) => item.id === conversation.id ? { ...item, lastMessageAt: message.createdAt, unreadCount: item.id === conversationId || message.author.id === user?.id ? item.unreadCount : item.unreadCount + 1 } : item)
      .sort((left, right) => (right.lastMessageAt ?? right.updatedAt).localeCompare(left.lastMessageAt ?? left.updatedAt)))
  }

  function updateReadState(readState: ConversationReadStateDTO) {
    if (readState.userId !== user?.id) return
    if (readState.conversation.type === "channel") {
      setChannels((current) => current.map((channel) => channel.id === readState.conversation.id ? { ...channel, lastReadMessageId: readState.lastReadMessageId, unreadCount: 0 } : channel))
      return
    }
    setDirectConversations((current) => current.map((item) => item.id === readState.conversation.id ? { ...item, lastReadMessageId: readState.lastReadMessageId, unreadCount: 0 } : item))
  }

  function updatePresence(userId: string, status: "online" | "offline") {
    setOnlineUserIds((current) => {
      const next = new Set(current)
      if (status === "online") next.add(userId)
      else next.delete(userId)
      return next
    })
  }

  function openCreate() {
    setFormMode("create")
    setChannelNameError("")
    setFormError("")
    setFormOpen(true)
  }

  function openEdit() {
    setFormMode("edit")
    setChannelNameError("")
    setFormError("")
    setFormOpen(true)
  }

  async function submitChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!workspace) return
    const form = new FormData(event.currentTarget)
    const name = String(form.get("name") ?? "")
    const description = String(form.get("description") ?? "")
    const parsedName = channelNameSchema.safeParse(name)
    if (!parsedName.success) {
      setChannelNameError(parsedName.error.issues[0]?.message ?? "Channel name is invalid.")
      return
    }

    setSubmitting(true)
    setChannelNameError("")
    setFormError("")
    try {
      const path = formMode === "create" ? `/workspaces/${workspace.id}/channels` : `/channels/${selectedChannel!.id}`
      const { channel } = await apiRequest<{ channel: ChannelDTO }>(path, {
        method: formMode === "create" ? "POST" : "PATCH",
        body: JSON.stringify({ name, description }),
      })
      setChannels((current) => formMode === "create"
        ? [...current, channel].sort((left, right) => left.name.localeCompare(right.name))
        : current.map((item) => item.id === channel.id ? channel : item))
      setFormOpen(false)
      toast.success(formMode === "create" ? "Channel created" : "Channel updated", {
        description: formMode === "create" ? `#${channel.name} is ready for the workspace.` : `#${channel.name} details were saved.`,
      })
      if (formMode === "create") {
        startTransition(() => router.push(`/app/${workspace.slug}/channels/${channel.id}`))
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Channel could not be saved."
      setFormError(message)
      toast.error("Channel was not saved", { description: message })
    } finally {
      setSubmitting(false)
    }
  }

  async function changeArchiveState(action: "archive" | "restore") {
    if (!selectedChannel) return
    try {
      const { channel } = await apiRequest<{ channel: ChannelDTO }>(`/channels/${selectedChannel.id}/${action}`, { method: "POST" })
      setChannels((current) => current.map((item) => item.id === channel.id ? channel : item))
      setError("")
      toast.success(action === "archive" ? "Channel archived" : "Channel restored", {
        description: `#${channel.name} is ${action === "archive" ? "hidden from active channel flow" : "available again"}.`,
      })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : `Channel could not be ${action}d.`
      setError(message)
      toast.error(action === "archive" ? "Archive failed" : "Restore failed", { description: message })
    }
  }

  async function signOut() {
    await apiRequest<void>("/auth/signout", { method: "POST" })
    startTransition(() => router.replace("/login"))
  }

  async function uploadProfileImage() {
    if (!profileImageFile) return
    setImageSubmitting("profile")
    setImageUploadProgress(12)
    setImageError("")
    try {
      const form = new FormData()
      form.set("file", profileImageFile)
      const response = await apiRequest<{ user: AuthUserDTO }>("/auth/me/image", { method: "POST", body: form })
      setUser(response.user)
      setMembers((current) => current.map((member) => member.userId === response.user.id ? { ...member, image: response.user.image, name: response.user.name, email: response.user.email } : member))
      setProfileImageFile(null)
      setProfilePreview(null)
      setImageUploadProgress(100)
      toast.success("Profile image updated", { description: "Your new image is now shown across Relay." })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Profile image could not be uploaded."
      setImageError(message)
      toast.error("Profile upload failed", { description: message })
    } finally {
      setImageSubmitting(null)
      setImageUploadProgress(0)
    }
  }

  async function uploadWorkspaceImage() {
    if (!workspaceImageFile || !workspace) return
    setImageSubmitting("workspace")
    setImageUploadProgress(12)
    setImageError("")
    try {
      const form = new FormData()
      form.set("file", workspaceImageFile)
      const response = await apiRequest<{ workspace: WorkspaceDTO }>(`/workspaces/${workspace.id}/image`, { method: "POST", body: form })
      setWorkspace(response.workspace)
      setWorkspaces((current) => current.map((item) => item.id === response.workspace.id ? response.workspace : item))
      setWorkspaceImageFile(null)
      setWorkspacePreview(null)
      setImageUploadProgress(100)
      toast.success("Workspace image updated", { description: `${response.workspace.name} now uses the new workspace image.` })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Workspace image could not be uploaded."
      setImageError(message)
      toast.error("Workspace upload failed", { description: message })
    } finally {
      setImageSubmitting(null)
      setImageUploadProgress(0)
    }
  }

  function chooseProfileImage(file: File | null) {
    if (profilePreview) URL.revokeObjectURL(profilePreview)
    setProfileImageFile(file)
    setProfilePreview(file ? URL.createObjectURL(file) : null)
  }

  function chooseWorkspaceImage(file: File | null) {
    if (workspacePreview) URL.revokeObjectURL(workspacePreview)
    setWorkspaceImageFile(file)
    setWorkspacePreview(file ? URL.createObjectURL(file) : null)
  }

  function closeUtilityPage() {
    if (!workspace) return
    const firstChannel = channels.find((channel) => !channel.archivedAt) ?? channels[0]
    const destination = firstChannel ? `/app/${workspace.slug}/channels/${firstChannel.id}` : `/app/${workspace.slug}`
    startTransition(() => router.replace(destination))
  }

  if (!workspaceSlug || (state === "loading" && (!workspace || !user))) return <LoadingShell />

  if (state === "error" || !workspace || !user) {
    return (
      <main className="grid h-dvh place-items-center bg-signal-paper p-6 text-signal-ink">
        <section className="max-w-md text-center">
          <div className="mx-auto size-12"><BrandLogo mark="icon" priority /></div>
          <p className="text-metadata mt-5 uppercase tracking-[0.18em] text-signal-amber">Workspace unavailable</p>
          <h1 className="mt-3 text-xl font-semibold">This workspace could not be opened</h1>
          <p className="mt-2 text-sm text-signal-muted">{error || "Your membership may have changed."}</p>
          <Button className="mt-5" nativeButton={false} render={<Link href="/" />}>Return home</Button>
        </section>
      </main>
    )
  }

  const navigation = (
    <WorkspaceNavigation
      channelId={channelId}
      channels={channels}
      conversationId={conversationId}
      directConversations={directConversations}
      isSwitchingWorkspace={isSwitchingWorkspace}
      mayManage={mayManage}
      members={members}
      onlineUserIds={onlineUserIds}
      targetWorkspace={targetWorkspace}
      user={user}
      workspace={workspace}
      workspaces={workspaces}
      onCreateChannel={openCreate}
      onOpenAccount={() => { setImageError(""); setAccountOpen(true) }}
      onOpenDirectMessage={(userId) => void openDirectMessage(userId)}
      onSelectNavigation={() => setNavigationOpen(false)}
      onSignOut={() => void signOut()}
    />
  )

  return (
    <TooltipProvider>
      <div className={cn("fixed inset-0 grid min-h-0 overflow-hidden bg-signal-paper text-signal-ink md:grid-cols-[64px_minmax(0,1fr)] lg:grid-cols-[64px_260px_minmax(0,1fr)]", selectedChannel && "xl:grid-cols-[64px_260px_minmax(0,1fr)_292px]")}>
        <WorkspaceRail workspaceSlug={workspaceSlug} workspaces={workspaces} />

        <aside className="hidden h-full min-h-0 min-w-0 overflow-hidden border-r border-signal-line lg:block">{navigation}</aside>

        <main className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
          <AppHeader
            mayManage={mayManage}
            members={members}
            navigation={navigation}
            navigationOpen={navigationOpen}
            selectedChannel={selectedChannel}
            selectedDirectConversation={selectedDirectConversation}
            workspace={workspace}
            onArchiveStateChange={(action) => void changeArchiveState(action)}
            onEditChannel={openEdit}
            onNavigationOpenChange={setNavigationOpen}
            onOpenDetails={() => setDetailsOpen(true)}
          />

          {error && state === "ready" && <p className="border-b border-destructive/25 bg-destructive/10 px-5 py-2 text-xs text-destructive" role="alert">{error}</p>}

          {isSwitchingWorkspace ? (
            <section className="grid min-h-0 flex-1 place-items-center overflow-auto p-6 sm:p-10" role="status">
              <div className="max-w-md rounded-lg border border-signal-line bg-signal-surface/50 px-5 py-6 text-center">
                <Spinner className="mx-auto mb-4 size-6 text-signal-cyan" />
                <h2 className="text-base font-semibold">Switching to {targetWorkspace?.name ?? "workspace"}</h2>
                <p className="mt-2 text-sm text-signal-muted">Refreshing channels, members, and direct messages.</p>
              </div>
            </section>
          ) : selectedDirectConversation ? (
            <ChannelMessages key={selectedDirectConversation.id} onActivity={updateConversationActivity} onPresence={updatePresence} onReadState={updateReadState} target={{ type: "dm", conversation: selectedDirectConversation }} user={user} />
          ) : selectedChannel ? (
            <ChannelMessages key={selectedChannel.id} onActivity={updateConversationActivity} onAddDescription={mayManage ? openEdit : undefined} onInvitePeople={() => startTransition(() => router.push(`/app/${workspace.slug}/members`))} onPresence={updatePresence} onReadState={updateReadState} target={{ type: "channel", channel: selectedChannel }} user={user} />
          ) : (
            <section className="grid min-h-0 flex-1 place-items-center overflow-auto p-6 sm:p-10">
              {channelId ? (
                <div className="max-w-md rounded-lg border border-signal-line bg-signal-surface/50 px-5 py-6 text-center"><h2 className="text-base font-semibold">Conversation unavailable</h2><p className="mt-2 text-sm text-signal-muted">This conversation does not belong to the current workspace or is no longer accessible.</p></div>
              ) : (
                <div className="max-w-md rounded-lg border border-dashed border-signal-line bg-signal-surface/45 px-5 py-6 text-center"><h2 className="text-base font-semibold">No channel selected</h2><p className="mt-2 text-sm text-signal-muted">{channels.length ? "Choose a channel to open the conversation." : mayManage ? "Create the first channel for this workspace." : "An Owner or Admin needs to create a channel."}</p>{mayManage && channels.length === 0 && <Button className="mt-5" onClick={openCreate}>Create channel</Button>}</div>
              )}
            </section>
          )}
        </main>

        {selectedChannel && <aside className="hidden h-full min-h-0 min-w-0 overflow-hidden border-l border-signal-line xl:block"><ChannelDetails channel={selectedChannel} currentUserId={user.id} members={members} onlineUserIds={onlineUserIds} /></aside>}

        {selectedChannel && <Sheet onOpenChange={setDetailsOpen} open={detailsOpen}><SheetContent className="theme-navigation w-[min(92vw,340px)] gap-0 border-sidebar-border bg-signal-panel p-0" side="right"><SheetHeader className="sr-only"><SheetTitle>Channel details</SheetTitle><SheetDescription>Information and members for #{selectedChannel.name}.</SheetDescription></SheetHeader><ChannelDetails channel={selectedChannel} currentUserId={user.id} members={members} onlineUserIds={onlineUserIds} /></SheetContent></Sheet>}

        <UtilityDialog isMembersPage={isMembersPage} onClose={closeUtilityPage} open={isUtilityPage} workspaceName={workspace.name}>{children}</UtilityDialog>

        <AccountImagesDialog
          imageError={imageError}
          imageSubmitting={imageSubmitting}
          imageUploadProgress={imageUploadProgress}
          mayManage={mayManage}
          open={accountOpen}
          profileImageFile={profileImageFile}
          profilePreview={profilePreview}
          user={user}
          workspace={workspace}
          workspaceImageFile={workspaceImageFile}
          workspacePreview={workspacePreview}
          onChooseProfileImage={chooseProfileImage}
          onChooseWorkspaceImage={chooseWorkspaceImage}
          onOpenChange={setAccountOpen}
          onUploadProfileImage={() => void uploadProfileImage()}
          onUploadWorkspaceImage={() => void uploadWorkspaceImage()}
        />

        <ChannelFormDialog
          channelNameError={channelNameError}
          formError={formError}
          formMode={formMode}
          open={formOpen}
          selectedChannel={selectedChannel}
          submitting={submitting}
          onClearChannelNameError={() => setChannelNameError("")}
          onOpenChange={setFormOpen}
          onSubmit={(event) => void submitChannel(event)}
        />
      </div>
    </TooltipProvider>
  )
}
