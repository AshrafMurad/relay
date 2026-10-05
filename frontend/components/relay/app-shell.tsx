"use client"

import Link from "next/link"
import { useParams, usePathname, useRouter } from "next/navigation"
import { startTransition, useEffect, useState, type FormEvent, type ReactNode } from "react"
import {
  Archive,
  ChevronDown,
  Hash,
  LogOut,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SunMoon,
  UserRound,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ChannelMessages } from "@/components/relay/channel-messages"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ApiClientError, apiRequest } from "@/lib/api/client"
import type { AuthUserDTO, ChannelDTO, ConversationReadStateDTO, DirectConversationDTO, MessageDTO, WorkspaceDTO, WorkspaceMemberDTO } from "@/lib/api/contracts"
import { canManageChannels, channelNameSchema } from "@/lib/channels"
import { cn } from "@/lib/utils"

type LoadState = "loading" | "ready" | "error"
type ChannelFormMode = "create" | "edit"

function initials(value: string) {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
}

function fieldClass() {
  return "h-10 rounded-md border border-signal-line bg-signal-surface px-3 text-sm text-signal-ink outline-none transition focus:border-signal-cyan focus:ring-2 focus:ring-signal-cyan/15"
}

function RelayMark() {
  return (
    <svg aria-hidden="true" className="size-8" viewBox="0 0 32 32" fill="none">
      <path d="M8 7h8.5a5.5 5.5 0 0 1 0 11H8m8.5 0L24 26" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
      <rect x="5" y="4" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="5" y="15.5" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="22" y="23" width="5" height="5" rx="1" fill="currentColor" />
    </svg>
  )
}

function LoadingShell() {
  return (
    <main className="grid h-dvh place-items-center bg-signal-paper p-6 text-signal-ink">
      <div className="w-full max-w-sm text-center" role="status">
        <div className="mx-auto grid size-12 place-items-center rounded-lg bg-signal-carbon text-signal-amber"><RelayMark /></div>
        <p className="mt-4 text-sm font-semibold">Opening workspace</p>
        <p className="mt-1 text-xs text-signal-muted">Loading routes, members, and unread state.</p>
        <div className="mt-5 space-y-2" aria-hidden="true">
          <div className="mx-auto h-2 w-48 animate-pulse rounded bg-signal-surface-raised" />
          <div className="mx-auto h-2 w-32 animate-pulse rounded bg-signal-surface-raised" />
        </div>
      </div>
    </main>
  )
}

export function RelayAppShell({ children, workspaceSlug }: { children: ReactNode; workspaceSlug: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams<{ channelId?: string | string[]; conversationId?: string | string[] }>()
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
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState<ChannelFormMode>("create")
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const selectedChannel = channels.find((channel) => channel.id === channelId) ?? null
  const selectedDirectConversation = directConversations.find((conversation) => conversation.id === conversationId) ?? null
  const mayManage = workspace ? canManageChannels(workspace.currentUserRole) : false

  useEffect(() => {
    let cancelled = false

    async function load() {
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
        setState("ready")

      } catch (caught) {
        if (cancelled) return
        if (caught instanceof ApiClientError && caught.code === "UNAUTHORIZED") {
          startTransition(() => router.replace("/"))
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
    if (state !== "ready" || channelId || conversationId || pathname.endsWith("/search") || !workspace || channels.length === 0) return
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

  function openCreate() {
    setFormMode("create")
    setFormError("")
    setFormOpen(true)
  }

  function openEdit() {
    setFormMode("edit")
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
      setFormError(parsedName.error.issues[0]?.message ?? "Channel name is invalid.")
      return
    }

    setSubmitting(true)
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
      if (formMode === "create") {
        startTransition(() => router.push(`/app/${workspace.slug}/channels/${channel.id}`))
      }
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Channel could not be saved.")
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
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Channel could not be ${action}d.`)
    }
  }

  async function signOut() {
    await apiRequest<void>("/auth/signout", { method: "POST" })
    startTransition(() => router.replace("/"))
  }

  function toggleTheme() {
    const root = document.documentElement
    root.classList.toggle("dark")
    root.style.colorScheme = root.classList.contains("dark") ? "dark" : "light"
  }

  if (state === "loading") return <LoadingShell />

  if (state === "error" || !workspace || !user) {
    return (
      <main className="grid h-dvh place-items-center bg-signal-paper p-6 text-signal-ink">
        <section className="max-w-md text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-lg bg-signal-carbon text-signal-amber"><RelayMark /></div>
          <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-signal-amber">Workspace unavailable</p>
          <h1 className="mt-3 text-xl font-semibold">This workspace could not be opened</h1>
          <p className="mt-2 text-sm text-signal-muted">{error || "Your membership may have changed."}</p>
          <Button className="mt-5" render={<Link href="/" />}>Return home</Button>
        </section>
      </main>
    )
  }

  const navigation = (
    <div className="flex h-full min-h-0 flex-col bg-signal-panel">
      <div className="flex h-[60px] shrink-0 items-center gap-2 border-b border-signal-line px-4">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button className="min-w-0 flex-1 justify-start px-2 text-signal-panel-text" variant="ghost" />}>
            <span className="truncate">{workspace.name}</span><ChevronDown className="ml-auto size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
            {workspaces.map((item) => (
              <DropdownMenuItem key={item.id} onClick={() => setNavigationOpen(false)} render={<Link href={`/app/${item.slug}`} />}>{item.name}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-3">
          <Link className={cn("mb-2 flex min-h-8 items-center gap-2 rounded-md px-2 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-amber", pathname.endsWith("/search") ? "bg-signal-amber/12 font-semibold text-signal-amber" : "text-signal-panel-muted hover:bg-white/5 hover:text-signal-panel-text")} href={`/app/${workspace.slug}/search`} onClick={() => setNavigationOpen(false)}>
            <Search className="size-3.5" /> Search messages
          </Link>
          <div className="flex h-9 items-center justify-between px-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-signal-panel-muted">Channels</p>
              <p className="sr-only">{mayManage ? "You can manage channels." : "Only owners and admins can manage channels."}</p>
            </div>
            {mayManage && <Button aria-label="Create channel" onClick={openCreate} size="icon-xs" type="button" variant="ghost"><Plus /></Button>}
          </div>
          <nav aria-label="Channels" className="mt-1 space-y-0.5">
            {channels.map((channel) => {
              const active = channel.id === channelId
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-8 items-center gap-2 rounded-md px-2 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-amber",
                    active ? "bg-signal-amber/12 font-semibold text-signal-amber" : "text-signal-panel-muted hover:bg-white/5 hover:text-signal-panel-text",
                    channel.archivedAt && "opacity-60",
                  )}
                  href={`/app/${workspace.slug}/channels/${channel.id}`}
                  key={channel.id}
                  onClick={() => setNavigationOpen(false)}
                >
                  {active && <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-signal-amber" />}
                  <Hash className="size-3.5" />
                  <span className="truncate">{channel.name}</span>
                  {channel.unreadCount > 0 && <span className="ml-auto rounded-full bg-signal-amber px-1.5 py-0.5 text-[9px] font-bold text-signal-carbon">{channel.unreadCount}</span>}
                  {channel.archivedAt && <span className="ml-auto text-[9px] uppercase">Archived</span>}
                </Link>
              )
            })}
          </nav>
          {channels.length === 0 && (
            <div className="mx-2 mt-3 rounded-md border border-dashed border-white/15 p-3 text-[11px] leading-5 text-signal-panel-muted">
              {mayManage ? "No channels yet. Create one to start the workspace." : "No channels are available. Ask an Owner or Admin to create one."}
            </div>
          )}
          <div className="mt-5 flex h-9 items-center justify-between px-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-signal-panel-muted">Direct Messages</p>
          </div>
          <nav aria-label="Direct messages" className="mt-1 space-y-0.5">
            {directConversations.map((conversation) => {
              const active = conversation.id === conversationId
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-8 items-center gap-2 rounded-md px-2 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-amber",
                    active ? "bg-signal-amber/12 font-semibold text-signal-amber" : "text-signal-panel-muted hover:bg-white/5 hover:text-signal-panel-text",
                  )}
                  href={`/app/${workspace.slug}/dm/${conversation.id}`}
                  key={conversation.id}
                  onClick={() => setNavigationOpen(false)}
                >
                  {active && <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-signal-amber" />}
                  <UserRound className="size-3.5" />
                  <span className="truncate">{conversation.otherUser.name}</span>
                  {conversation.unreadCount > 0 && <span className="ml-auto rounded-full bg-signal-amber px-1.5 py-0.5 text-[9px] font-bold text-signal-carbon">{conversation.unreadCount}</span>}
                </Link>
              )
            })}
            {members.filter((member) => member.userId !== user.id && !directConversations.some((conversation) => conversation.otherUser.id === member.userId)).map((member) => (
              <button
                className="flex min-h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[12px] text-signal-panel-muted transition-colors hover:bg-white/5 hover:text-signal-panel-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-amber sm:min-h-8"
                key={member.userId}
                onClick={() => void openDirectMessage(member.userId)}
                type="button"
              >
                <UserRound className="size-3.5" />
                <span className="truncate">{member.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </ScrollArea>

      <div className="flex items-center gap-3 border-t border-signal-line p-3">
        <Avatar className="size-8 rounded-lg"><AvatarFallback className="rounded-lg bg-signal-amber text-[9px] font-bold text-signal-carbon">{initials(user.name)}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-signal-panel-text">{user.name}</p><p className="truncate text-[9px] text-signal-panel-muted">{workspace.currentUserRole.toLowerCase()}</p></div>
        <Button aria-label="Toggle theme" onClick={toggleTheme} size="icon-sm" type="button" variant="ghost"><SunMoon /></Button>
        <Button aria-label="Sign out" onClick={() => void signOut()} size="icon-sm" type="button" variant="ghost"><LogOut /></Button>
      </div>
    </div>
  )

  return (
    <TooltipProvider>
      <div className="grid h-dvh overflow-hidden bg-signal-paper text-signal-ink md:grid-cols-[64px_minmax(0,1fr)] lg:grid-cols-[64px_260px_minmax(0,1fr)]">
        {children}
        <aside className="hidden h-dvh flex-col items-center border-r border-signal-line bg-signal-carbon py-3 md:flex">
          <div className="mb-4 text-signal-amber"><RelayMark /><span className="sr-only">Relay</span></div>
          <nav aria-label="Workspaces" className="flex flex-1 flex-col gap-2">
            {workspaces.map((item) => (
              <Tooltip key={item.id}>
                <TooltipTrigger render={<Link aria-current={item.id === workspace.id ? "page" : undefined} className={cn("grid size-10 place-items-center rounded-lg border text-[10px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-amber", item.id === workspace.id ? "border-signal-amber bg-white/8 text-signal-panel-text" : "border-white/10 text-signal-panel-muted hover:border-white/25")} href={`/app/${item.slug}`} />}>
                  {initials(item.name)}
                </TooltipTrigger>
                <TooltipContent side="right">{item.name}</TooltipContent>
              </Tooltip>
            ))}
          </nav>
          <Button aria-label="Toggle theme" onClick={toggleTheme} size="icon-sm" type="button" variant="ghost"><SunMoon /></Button>
        </aside>

        <aside className="hidden min-w-0 border-r border-signal-line lg:block">{navigation}</aside>

        <main className="flex min-h-0 min-w-0 flex-col">
          <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-signal-line bg-signal-paper/95 px-3 sm:px-5">
            <Sheet onOpenChange={setNavigationOpen} open={navigationOpen}>
              <SheetTrigger render={<Button aria-label="Open navigation" className="lg:hidden" size="icon" type="button" variant="ghost" />}><Menu /></SheetTrigger>
              <SheetContent className="w-[min(88vw,320px)] gap-0 border-signal-line bg-signal-panel p-0" side="left">
                <SheetHeader className="sr-only"><SheetTitle>Workspace navigation</SheetTitle><SheetDescription>Choose a workspace or channel.</SheetDescription></SheetHeader>
                {navigation}
              </SheetContent>
            </Sheet>
            {selectedDirectConversation ? <UserRound className="size-4 text-signal-muted" /> : <Hash className="size-4 text-signal-muted" />}
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-semibold">{selectedDirectConversation?.otherUser.name ?? selectedChannel?.name ?? workspace.name}</h1>
              <p className="truncate text-[10px] text-signal-muted">{selectedDirectConversation ? selectedDirectConversation.otherUser.email : selectedChannel?.description || (selectedChannel ? "No channel description" : "Choose a channel or direct message from the workspace navigation")}</p>
            </div>
            {selectedChannel && !selectedDirectConversation && mayManage && (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button aria-label="Channel options" size="icon-sm" type="button" variant="ghost" />}><MoreHorizontal /></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Channel</DropdownMenuLabel>
                  <DropdownMenuItem onClick={openEdit}><Pencil /> Edit details</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {selectedChannel.archivedAt
                    ? <DropdownMenuItem onClick={() => void changeArchiveState("restore")}><RotateCcw /> Restore channel</DropdownMenuItem>
                    : <DropdownMenuItem disabled={selectedChannel.name === "general"} onClick={() => void changeArchiveState("archive")} variant="destructive"><Archive /> Archive channel</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </header>

          {error && state === "ready" && <p className="border-b border-destructive/25 bg-destructive/10 px-5 py-2 text-xs text-destructive" role="alert">{error}</p>}

          {selectedDirectConversation ? (
            <ChannelMessages key={selectedDirectConversation.id} onActivity={updateConversationActivity} onReadState={updateReadState} target={{ type: "dm", conversation: selectedDirectConversation }} user={user} />
          ) : selectedChannel ? (
            <ChannelMessages key={selectedChannel.id} onActivity={updateConversationActivity} onReadState={updateReadState} target={{ type: "channel", channel: selectedChannel }} user={user} />
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

        <Sheet onOpenChange={setFormOpen} open={formOpen}>
          <SheetContent className="w-[min(92vw,420px)] border-signal-line bg-signal-paper" side="right">
            <SheetHeader>
              <SheetTitle>{formMode === "create" ? "Create channel" : "Edit channel"}</SheetTitle>
              <SheetDescription>{formMode === "create" ? "Add a public channel for every active workspace member." : `Update #${selectedChannel?.name}.`}</SheetDescription>
            </SheetHeader>
            <form className="grid gap-5 px-4" key={`${formMode}-${selectedChannel?.id ?? "new"}`} onSubmit={submitChannel}>
              <label className="grid gap-1.5 text-sm font-medium">Name<input autoFocus className={fieldClass()} defaultValue={formMode === "edit" ? selectedChannel?.name : ""} name="name" pattern="[a-z0-9_-]{2,80}" readOnly={formMode === "edit" && selectedChannel?.name === "general"} required /><span className="text-[11px] font-normal text-signal-muted">Lowercase letters, numbers, hyphens, and underscores only.</span></label>
              <label className="grid gap-1.5 text-sm font-medium">Description <span className="text-signal-muted">(optional)</span><textarea className="min-h-28 rounded-md border border-signal-line bg-signal-surface p-3 text-sm outline-none focus:border-signal-cyan focus:ring-2 focus:ring-signal-cyan/15" defaultValue={formMode === "edit" ? selectedChannel?.description ?? "" : ""} name="description" /></label>
              {formError && <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">{formError}</p>}
              <div className="flex justify-end gap-2"><Button onClick={() => setFormOpen(false)} type="button" variant="outline">Cancel</Button><Button disabled={submitting} type="submit">{submitting ? "Saving..." : formMode === "create" ? "Create channel" : "Save changes"}</Button></div>
            </form>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  )
}
