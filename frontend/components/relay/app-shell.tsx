"use client"

import Link from "next/link"
import { useParams, usePathname, useRouter } from "next/navigation"
import { startTransition, useEffect, useState, type FormEvent, type ReactNode } from "react"
import { cva } from "class-variance-authority"
import {
  Archive,
  ChevronDown,
  Hash,
  Info,
  LayoutGrid,
  LogOut,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  UserRound,
  UsersRound,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { BrandLogo } from "@/components/relay/brand-logo"
import { ChannelMessages } from "@/components/relay/channel-messages"
import { ThemeControl } from "@/components/relay/theme-control"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Textarea } from "@/components/ui/textarea"
import { ApiClientError, apiRequest } from "@/lib/api/client"
import type { AuthUserDTO, ChannelDTO, ConversationReadStateDTO, DirectConversationDTO, MessageDTO, WorkspaceDTO, WorkspaceMemberDTO } from "@/lib/api/contracts"
import { canManageChannels, channelNameSchema } from "@/lib/channels"
import { cn } from "@/lib/utils"

type LoadState = "loading" | "ready" | "error"
type ChannelFormMode = "create" | "edit"

function initials(value: string) {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
}

const navigationItemVariants = cva(
  "relative flex min-h-8 items-center gap-2 rounded-md px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-amber",
  {
    variants: {
      active: {
        true: "bg-signal-amber/12 font-semibold text-signal-amber",
        false: "text-signal-panel-muted hover:bg-sidebar-accent hover:text-signal-panel-text",
      },
    },
    defaultVariants: { active: false },
  },
)

function LoadingShell() {
  return (
    <main className="grid h-dvh place-items-center bg-signal-paper p-6 text-signal-ink">
      <div className="w-full max-w-sm text-center" role="status">
        <div className="mx-auto size-12"><BrandLogo mark="icon" priority /></div>
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

function ChannelDetails({ channel, currentUserId, members, onlineUserIds }: { channel: ChannelDTO; currentUserId: string; members: WorkspaceMemberDTO[]; onlineUserIds: Set<string> }) {
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLowerCase()
  const visibleMembers = normalizedQuery
    ? members.filter((member) => member.name.toLowerCase().includes(normalizedQuery) || member.email.toLowerCase().includes(normalizedQuery))
    : members

  return (
    <div className="flex h-full min-h-0 flex-col bg-signal-panel text-signal-panel-text">
      <div className="flex h-[60px] shrink-0 items-center border-b border-sidebar-border px-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Channel details</h2>
          <p className="text-helper mt-0.5 truncate text-signal-panel-muted">#{channel.name}</p>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 p-4">
          <section>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-md border border-sidebar-border bg-signal-carbon text-signal-amber"><Hash className="size-4" /></span>
              <div className="min-w-0">
                <h3 className="text-xs font-semibold">About</h3>
                <p className="text-helper mt-0.5 truncate text-signal-panel-muted">#{channel.name}</p>
                <p className="text-metadata mt-0.5 uppercase tracking-[0.12em] text-signal-panel-muted">Public channel</p>
              </div>
            </div>
            <p className="text-helper mt-3 leading-5 text-signal-panel-muted">{channel.description || "No description has been added yet."}</p>
          </section>

          <section className="border-t border-sidebar-border pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold">Members</h3>
              <span className="text-metadata text-signal-panel-muted">{members.length}</span>
            </div>
            <label className="relative mt-3 block">
              <span className="sr-only">Find a member</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-signal-panel-muted" />
              <Input className="h-8 border-sidebar-border bg-signal-carbon pl-8 text-xs text-signal-panel-text placeholder:text-signal-panel-muted focus-visible:ring-signal-cyan/20" onChange={(event) => setQuery(event.target.value)} placeholder="Find a member" value={query} />
            </label>
            <div className="mt-3 space-y-1">
              {visibleMembers.map((member) => {
                const online = member.userId === currentUserId || onlineUserIds.has(member.userId)
                return (
                  <div className="flex items-center gap-2.5 rounded-md px-1.5 py-2 transition-colors hover:bg-sidebar-accent" key={member.id}>
                    <span className="relative shrink-0">
                      <Avatar className="size-7 rounded-md">
                        {member.image && <AvatarImage alt="" className="rounded-md" src={member.image} />}
                        <AvatarFallback className="text-metadata rounded-md bg-signal-panel-raised font-semibold text-signal-panel-muted">{initials(member.name)}</AvatarFallback>
                      </Avatar>
                      <span aria-label={online ? "Online" : "Offline"} className={cn("absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-signal-panel", online ? "bg-signal-cyan" : "bg-signal-panel-muted/45")} role="img" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{member.name}{member.userId === currentUserId && <span className="font-normal text-signal-panel-muted"> (you)</span>}</p>
                      <p className="text-metadata mt-0.5 capitalize text-signal-panel-muted">{online ? "Online" : member.role.toLowerCase()}</p>
                    </div>
                  </div>
                )
              })}
              {visibleMembers.length === 0 && <p className="text-helper py-3 text-center text-signal-panel-muted">No members match “{query}”.</p>}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
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
  const [formError, setFormError] = useState("")
  const [submitting, setSubmitting] = useState(false)

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
    startTransition(() => router.replace("/login"))
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
    <div className="flex h-full min-h-0 flex-col bg-signal-panel">
      <div className="flex h-[60px] shrink-0 items-center gap-2 border-b border-sidebar-border px-3">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button className="h-11 min-w-0 flex-1 justify-start px-2 text-signal-panel-text hover:bg-sidebar-accent" variant="ghost" />}>
            <span className="text-metadata grid size-7 shrink-0 place-items-center rounded-md border border-sidebar-border bg-signal-carbon font-bold text-signal-amber">{initials(targetWorkspace?.name ?? workspace.name)}</span>
            <span className="min-w-0 text-left"><span className="block truncate text-xs font-semibold">{targetWorkspace?.name ?? workspace.name}</span><span className="text-helper block truncate text-signal-panel-muted">{workspace.currentUserRole.toLowerCase()} workspace</span></span>
            <ChevronDown className="ml-auto size-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
              {workspaces.map((item) => (
                <DropdownMenuItem key={item.id} onClick={() => setNavigationOpen(false)} render={<Link href={`/app/${item.slug}`} />}>{item.name}</DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setNavigationOpen(false)} render={<Link href="/app?choose=1" />}>All workspaces</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className={cn("min-h-0 flex-1", isSwitchingWorkspace && "pointer-events-none opacity-55")}>
        <div className="p-3">
          <div className="mb-3 border-b border-sidebar-border pb-3">
          <Link aria-current={pathname.endsWith("/members") ? "page" : undefined} className={cn("mb-1", navigationItemVariants({ active: pathname.endsWith("/members") }))} href={`/app/${workspace.slug}/members`} onClick={() => setNavigationOpen(false)}>
            <UsersRound className="size-3.5" /> Members
          </Link>
          <Link aria-current={pathname.endsWith("/search") ? "page" : undefined} className={navigationItemVariants({ active: pathname.endsWith("/search") })} href={`/app/${workspace.slug}/search`} onClick={() => setNavigationOpen(false)}>
            <Search className="size-3.5" /> Search messages
          </Link>
          </div>
          <div className="flex h-9 items-center justify-between px-2">
            <div>
              <p className="text-helper font-semibold uppercase tracking-[0.12em] text-signal-panel-muted">Channels <span className="text-metadata ml-1 font-normal">{channels.length}</span></p>
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
                    navigationItemVariants({ active }),
                    channel.archivedAt && "opacity-60",
                  )}
                  href={`/app/${workspace.slug}/channels/${channel.id}`}
                  key={channel.id}
                  onClick={() => setNavigationOpen(false)}
                >
                  {active && <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-signal-amber" />}
                  <Hash className="size-3.5" />
                  <span className="truncate">{channel.name}</span>
                  {channel.unreadCount > 0 && <span className="text-metadata ml-auto rounded-full bg-signal-amber px-1.5 py-0.5 font-bold text-signal-carbon">{channel.unreadCount}</span>}
                  {channel.archivedAt && <span className="text-metadata ml-auto uppercase">Archived</span>}
                </Link>
              )
            })}
          </nav>
          {channels.length === 0 && (
            <div className="text-helper mx-2 mt-3 rounded-md border border-dashed border-sidebar-border p-3 text-signal-panel-muted">
              {mayManage ? "No channels yet. Create one to start the workspace." : "No channels are available. Ask an Owner or Admin to create one."}
            </div>
          )}
          <div className="mt-5 flex h-9 items-center justify-between px-2">
            <p className="text-helper font-semibold uppercase tracking-[0.12em] text-signal-panel-muted">Direct Messages <span className="text-metadata ml-1 font-normal">{directConversations.length}</span></p>
          </div>
          <nav aria-label="Direct messages" className="mt-1 space-y-0.5">
            {directConversations.map((conversation) => {
              const active = conversation.id === conversationId
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    navigationItemVariants({ active }),
                  )}
                  href={`/app/${workspace.slug}/dm/${conversation.id}`}
                  key={conversation.id}
                  onClick={() => setNavigationOpen(false)}
                >
                  {active && <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-signal-amber" />}
                  <Avatar className="size-5 rounded-md"><AvatarFallback className="text-metadata rounded-md bg-sidebar-accent font-semibold text-signal-panel-muted">{initials(conversation.otherUser.name)}</AvatarFallback></Avatar>
                  <span className="truncate">{conversation.otherUser.name}</span>
                  {conversation.unreadCount > 0 && <span className="text-metadata ml-auto rounded-full bg-signal-amber px-1.5 py-0.5 font-bold text-signal-carbon">{conversation.unreadCount}</span>}
                </Link>
              )
            })}
            {members.filter((member) => member.userId !== user.id && !directConversations.some((conversation) => conversation.otherUser.id === member.userId)).map((member) => (
              <button
                className={cn(navigationItemVariants(), "min-h-9 w-full text-left sm:min-h-8")}
                key={member.userId}
                onClick={() => void openDirectMessage(member.userId)}
                type="button"
              >
                <Avatar className="size-5 rounded-md"><AvatarFallback className="text-metadata rounded-md bg-sidebar-accent font-semibold text-signal-panel-muted">{initials(member.name)}</AvatarFallback></Avatar>
                <span className="truncate">{member.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-2.5">
        <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
          <span className="relative shrink-0"><Avatar className="size-8 rounded-lg">{user.image && <AvatarImage alt="" className="rounded-lg" src={user.image} />}<AvatarFallback className="text-metadata rounded-lg bg-signal-amber font-bold text-signal-carbon">{initials(user.name)}</AvatarFallback></Avatar><span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-signal-panel bg-signal-cyan" /></span>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-signal-panel-text">{user.name}</p><p className="text-metadata mt-0.5 truncate text-signal-panel-muted">Online · {user.email}</p></div>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1">
          <ThemeControl className="justify-start text-signal-panel-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" showLabel />
          <Button className="justify-start text-signal-panel-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={() => void signOut()} size="sm" type="button" variant="ghost"><LogOut />Sign out</Button>
        </div>
      </div>
    </div>
  )

  return (
    <TooltipProvider>
      <div className={cn("grid h-dvh overflow-hidden bg-signal-paper text-signal-ink md:grid-cols-[64px_minmax(0,1fr)] lg:grid-cols-[64px_260px_minmax(0,1fr)]", selectedChannel && "xl:grid-cols-[64px_260px_minmax(0,1fr)_292px]")}>
        <aside className="hidden h-dvh flex-col items-center border-r border-signal-line bg-signal-carbon py-3 md:flex">
          <div className="mb-4 size-8"><BrandLogo mark="icon" priority /><span className="sr-only">Relay</span></div>
          <nav aria-label="Workspaces" className="flex flex-1 flex-col gap-2">
            {workspaces.map((item) => (
              <Tooltip key={item.id}>
                <TooltipTrigger render={<Link aria-current={item.slug === workspaceSlug ? "page" : undefined} className={cn("text-metadata relative grid size-10 place-items-center rounded-lg border font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-amber", item.slug === workspaceSlug ? "border-signal-amber bg-sidebar-accent text-signal-panel-text" : "border-sidebar-border text-signal-panel-muted hover:border-signal-panel-muted")} href={`/app/${item.slug}`} />}>
                  {item.slug === workspaceSlug && <span className="absolute inset-y-2 -left-[13px] w-0.5 rounded-r bg-signal-amber" />}
                  {initials(item.name)}
                </TooltipTrigger>
                <TooltipContent side="right">{item.name}</TooltipContent>
              </Tooltip>
            ))}
          </nav>
          <Tooltip>
            <TooltipTrigger render={<Link aria-label="All workspaces" className={cn(buttonVariants({ size: "icon-sm", variant: "ghost" }), "text-signal-panel-muted hover:bg-sidebar-accent hover:text-signal-panel-text")} href="/app?choose=1" />}><LayoutGrid /></TooltipTrigger>
            <TooltipContent side="right">All workspaces</TooltipContent>
          </Tooltip>
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
            <span className="grid size-8 shrink-0 place-items-center rounded-md border border-signal-line bg-signal-surface text-signal-muted">{selectedDirectConversation ? <UserRound className="size-4" /> : <Hash className="size-4" />}</span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-semibold tracking-[-0.01em]">{selectedDirectConversation?.otherUser.name ?? selectedChannel?.name ?? workspace.name}</h1>
              <p className="text-helper truncate text-signal-muted">{selectedDirectConversation ? selectedDirectConversation.otherUser.email : selectedChannel?.description || (selectedChannel ? "No channel description" : "Choose a channel or direct message from the workspace navigation")}</p>
            </div>
            {selectedChannel && <div className="hidden items-center -space-x-1.5 sm:flex" aria-label={`${members.length} workspace members`}>{members.slice(0, 3).map((member) => <Avatar className="size-6 rounded-md border-2 border-signal-paper" key={member.id}>{member.image && <AvatarImage alt="" className="rounded-sm" src={member.image} />}<AvatarFallback className="rounded-sm bg-signal-surface-raised text-[8px] font-semibold text-signal-muted">{initials(member.name)}</AvatarFallback></Avatar>)}{members.length > 3 && <span className="text-metadata grid size-6 place-items-center rounded-md border-2 border-signal-paper bg-signal-surface-raised text-signal-muted">+{members.length - 3}</span>}</div>}
            <Tooltip>
              <TooltipTrigger render={<Link aria-label="Search messages" className={buttonVariants({ size: "icon-sm", variant: "ghost" })} href={`/app/${workspace.slug}/search`} />}><Search /></TooltipTrigger>
              <TooltipContent>Search messages</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={<Link aria-label="Workspace members" className={cn(buttonVariants({ size: "icon-sm", variant: "ghost" }), "hidden sm:inline-flex")} href={`/app/${workspace.slug}/members`} />}><UsersRound /></TooltipTrigger>
              <TooltipContent>Workspace members</TooltipContent>
            </Tooltip>
            {selectedChannel && <Tooltip><TooltipTrigger render={<Button aria-label="Open channel details" className="xl:hidden" onClick={() => setDetailsOpen(true)} size="icon-sm" type="button" variant="ghost" />}><Info /></TooltipTrigger><TooltipContent>Channel details</TooltipContent></Tooltip>}
            {selectedChannel && !selectedDirectConversation && mayManage && (
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button aria-label="Channel options" size="icon-sm" type="button" variant="ghost" />}><MoreHorizontal /></DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Channel</DropdownMenuLabel>
                    <DropdownMenuItem onClick={openEdit}><Pencil /> Edit details</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {selectedChannel.archivedAt
                      ? <DropdownMenuItem onClick={() => void changeArchiveState("restore")}><RotateCcw /> Restore channel</DropdownMenuItem>
                      : <DropdownMenuItem disabled={selectedChannel.name === "general"} onClick={() => void changeArchiveState("archive")} variant="destructive"><Archive /> Archive channel</DropdownMenuItem>}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </header>

          {error && state === "ready" && <p className="border-b border-destructive/25 bg-destructive/10 px-5 py-2 text-xs text-destructive" role="alert">{error}</p>}

          {isSwitchingWorkspace ? (
            <section className="grid min-h-0 flex-1 place-items-center overflow-auto p-6 sm:p-10" role="status">
              <div className="max-w-md rounded-lg border border-signal-line bg-signal-surface/50 px-5 py-6 text-center">
                <div className="mx-auto mb-4 size-10"><BrandLogo mark="icon" /></div>
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

        {selectedChannel && <aside className="hidden min-w-0 border-l border-signal-line xl:block"><ChannelDetails channel={selectedChannel} currentUserId={user.id} members={members} onlineUserIds={onlineUserIds} /></aside>}

        {selectedChannel && <Sheet onOpenChange={setDetailsOpen} open={detailsOpen}><SheetContent className="w-[min(92vw,340px)] gap-0 border-signal-line bg-signal-panel p-0" side="right"><SheetHeader className="sr-only"><SheetTitle>Channel details</SheetTitle><SheetDescription>Information and members for #{selectedChannel.name}.</SheetDescription></SheetHeader><ChannelDetails channel={selectedChannel} currentUserId={user.id} members={members} onlineUserIds={onlineUserIds} /></SheetContent></Sheet>}

        <Dialog open={isUtilityPage} onOpenChange={(open) => { if (!open) closeUtilityPage() }}>
          <DialogContent className={cn("max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-lg border border-signal-line bg-signal-paper p-0 text-signal-ink ring-0 sm:max-w-2xl", isMembersPage && "sm:max-w-4xl")}>
            <DialogHeader className="shrink-0 border-b border-signal-line px-5 py-4 pr-12 text-left">
              <DialogTitle>{isMembersPage ? "Workspace members" : "Search messages"}</DialogTitle>
              <DialogDescription>{isMembersPage ? `Manage access to ${workspace.name} and share pending invitations.` : `Find messages across channels and direct conversations in ${workspace.name}.`}</DialogDescription>
            </DialogHeader>
            {children}
          </DialogContent>
        </Dialog>

        <Sheet onOpenChange={setFormOpen} open={formOpen}>
          <SheetContent className="w-[min(92vw,420px)] border-signal-line bg-signal-paper" side="right">
            <SheetHeader>
              <SheetTitle>{formMode === "create" ? "Create channel" : "Edit channel"}</SheetTitle>
              <SheetDescription>{formMode === "create" ? "Add a public channel for every active workspace member." : `Update #${selectedChannel?.name}.`}</SheetDescription>
            </SheetHeader>
            <form className="grid gap-5 px-4" key={`${formMode}-${selectedChannel?.id ?? "new"}`} onSubmit={submitChannel}>
               <label className="grid gap-1.5 text-sm font-medium">Name<Input autoFocus defaultValue={formMode === "edit" ? selectedChannel?.name : ""} name="name" pattern="[a-z0-9_-]{2,80}" readOnly={formMode === "edit" && selectedChannel?.name === "general"} required /><span className="text-helper font-normal text-muted-foreground">Lowercase letters, numbers, hyphens, and underscores only.</span></label>
               <label className="grid gap-1.5 text-sm font-medium">Description <span className="text-muted-foreground">(optional)</span><Textarea className="min-h-28" defaultValue={formMode === "edit" ? selectedChannel?.description ?? "" : ""} name="description" /></label>
              {formError && <p className="rounded-md border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">{formError}</p>}
              <div className="flex justify-end gap-2"><Button onClick={() => setFormOpen(false)} type="button" variant="outline">Cancel</Button><Button disabled={submitting} type="submit">{submitting ? "Saving..." : formMode === "create" ? "Create channel" : "Save changes"}</Button></div>
            </form>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  )
}
