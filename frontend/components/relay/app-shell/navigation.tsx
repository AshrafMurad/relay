import Link from "next/link"
import { cva } from "class-variance-authority"
import { Camera, ChevronDown, Hash, LayoutGrid, LogOut, Plus, Search, UsersRound } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { BrandLogo } from "@/components/relay/brand-logo"
import { ThemeControl } from "@/components/relay/theme-control"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { AuthUserDTO, ChannelDTO, DirectConversationDTO, WorkspaceDTO, WorkspaceMemberDTO } from "@/lib/api/contracts"
import { cn } from "@/lib/utils"
import { AvatarPicture, initials } from "@/components/relay/app-shell/shared"

const navigationItemVariants = cva(
  "relative flex h-8 items-center gap-2 rounded-md px-2 text-xs transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-amber",
  {
    variants: {
      active: {
        true: "bg-signal-amber/12 font-semibold text-signal-amber",
        false: "text-signal-panel-muted hover:bg-sidebar-accent/80 hover:text-signal-panel-text",
      },
    },
    defaultVariants: { active: false },
  },
)

type WorkspaceNavigationProps = {
  channelId: string | null
  channels: ChannelDTO[]
  conversationId: string | null
  directConversations: DirectConversationDTO[]
  isSwitchingWorkspace: boolean
  mayManage: boolean
  members: WorkspaceMemberDTO[]
  onlineUserIds: Set<string>
  pathname: string
  targetWorkspace: WorkspaceDTO | null
  user: AuthUserDTO
  workspace: WorkspaceDTO
  workspaces: WorkspaceDTO[]
  onCreateChannel: () => void
  onOpenAccount: () => void
  onOpenDirectMessage: (userId: string) => void
  onSelectNavigation: () => void
  onSignOut: () => void
}

export function WorkspaceNavigation({ channelId, channels, conversationId, directConversations, isSwitchingWorkspace, mayManage, members, onlineUserIds, pathname, targetWorkspace, user, workspace, workspaces, onCreateChannel, onOpenAccount, onOpenDirectMessage, onSelectNavigation, onSignOut }: WorkspaceNavigationProps) {
  return (
    <div className="theme-navigation flex h-full min-h-0 flex-col bg-signal-panel">
      <div className="flex h-[60px] shrink-0 items-center gap-2 border-b border-sidebar-border px-3 pr-12 lg:pr-3">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button className="h-11 min-w-0 flex-1 justify-start px-2 text-signal-panel-text hover:bg-sidebar-accent/80" variant="ghost" />}>
            <Avatar className="size-8 shrink-0 rounded-md border border-sidebar-border bg-signal-carbon"><AvatarPicture className="rounded-md object-cover" src={targetWorkspace?.imageUrl ?? workspace.imageUrl} /><AvatarFallback className="text-metadata rounded-md bg-signal-carbon font-bold text-signal-amber">{initials(targetWorkspace?.name ?? workspace.name)}</AvatarFallback></Avatar>
            <span className="min-w-0 text-left"><span className="block truncate text-[13px] font-semibold leading-4">{targetWorkspace?.name ?? workspace.name}</span><span className="text-helper block truncate text-signal-panel-muted">{workspace.currentUserRole.toLowerCase()} workspace</span></span>
            <ChevronDown className="ml-auto size-3.5 text-signal-panel-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
              {workspaces.map((item) => (
                <DropdownMenuItem key={item.id} onClick={onSelectNavigation} render={<Link href={`/app/${item.slug}`} />}>{item.name}</DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSelectNavigation} render={<Link href="/app?choose=1" />}>All workspaces</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain", isSwitchingWorkspace && "pointer-events-none opacity-55")}>
        <div className="p-3">
          <div className="mb-3 border-b border-sidebar-border pb-3">
          <Link aria-current={pathname.endsWith("/members") ? "page" : undefined} className={cn("mb-1", navigationItemVariants({ active: pathname.endsWith("/members") }))} href={`/app/${workspace.slug}/members`} onClick={onSelectNavigation}>
            <UsersRound className="size-3.5" /> Members
          </Link>
          <Link aria-current={pathname.endsWith("/search") ? "page" : undefined} className={navigationItemVariants({ active: pathname.endsWith("/search") })} href={`/app/${workspace.slug}/search`} onClick={onSelectNavigation}>
            <Search className="size-3.5" /> Search messages
          </Link>
          </div>
          <div className="flex h-9 items-end justify-between px-2 pb-1">
            <div>
              <p className="text-helper font-semibold uppercase tracking-[0.12em] text-signal-panel-muted">Channels <span className="text-metadata ml-1 font-normal">{channels.length}</span></p>
              <p className="sr-only">{mayManage ? "You can manage channels." : "Only owners and admins can manage channels."}</p>
            </div>
            {mayManage && <Button aria-label="Create channel" onClick={onCreateChannel} size="icon-xs" type="button" variant="ghost"><Plus /></Button>}
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
                  onClick={onSelectNavigation}
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
          <div className="mt-4 flex h-9 items-end justify-between px-2 pb-1">
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
                  onClick={onSelectNavigation}
                >
                  {active && <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-signal-amber" />}
                  <span className="relative shrink-0">
                    <Avatar className="size-5 rounded-md"><AvatarPicture className="rounded-md" src={conversation.otherUser.image} /><AvatarFallback className="text-metadata rounded-md bg-sidebar-accent font-semibold text-signal-panel-muted">{initials(conversation.otherUser.name)}</AvatarFallback></Avatar>
                    <span aria-label={onlineUserIds.has(conversation.otherUser.id) ? "Online" : "Offline"} className={cn("absolute -bottom-px -right-px size-2 rounded-full border border-signal-panel", onlineUserIds.has(conversation.otherUser.id) ? "bg-signal-cyan" : "bg-signal-panel-muted/50")} role="img" />
                  </span>
                  <span className={cn("truncate", conversation.unreadCount > 0 && !active && "font-semibold text-signal-panel-text")}>{conversation.otherUser.name}</span>
                  {conversation.unreadCount > 0 && <span className="text-metadata ml-auto rounded-full bg-signal-amber px-1.5 py-0.5 font-bold text-signal-carbon">{conversation.unreadCount}</span>}
                </Link>
              )
            })}
            {members.filter((member) => member.userId !== user.id && !directConversations.some((conversation) => conversation.otherUser.id === member.userId)).map((member) => (
              <button
                className={cn(navigationItemVariants(), "w-full text-left")}
                key={member.userId}
                onClick={() => onOpenDirectMessage(member.userId)}
                type="button"
              >
                <span className="relative shrink-0"><Avatar className="size-5 rounded-md"><AvatarPicture className="rounded-md" src={member.image} /><AvatarFallback className="text-metadata rounded-md bg-sidebar-accent font-semibold text-signal-panel-muted">{initials(member.name)}</AvatarFallback></Avatar><span aria-label={onlineUserIds.has(member.userId) ? "Online" : "Offline"} className={cn("absolute -bottom-px -right-px size-2 rounded-full border border-signal-panel", onlineUserIds.has(member.userId) ? "bg-signal-cyan" : "bg-signal-panel-muted/50")} role="img" /></span>
                <span className="truncate">{member.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="shrink-0 border-t border-sidebar-border bg-signal-panel p-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button className="h-auto w-full justify-start gap-2.5 px-1.5 py-1.5 text-signal-panel-text hover:bg-sidebar-accent/50" variant="ghost" />}>
            <span className="relative shrink-0"><Avatar className="size-8 rounded-lg"><AvatarPicture className="rounded-lg object-cover" src={user.image} /><AvatarFallback className="text-metadata rounded-lg bg-signal-amber font-bold text-signal-carbon">{initials(user.name)}</AvatarFallback></Avatar><span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-signal-panel bg-signal-cyan" /></span>
            <span className="min-w-0 flex-1 text-left"><span className="block truncate text-xs font-semibold">{user.name}</span><span className="text-metadata mt-0.5 block truncate text-signal-panel-muted" title={user.email}>{user.email}</span></span>
            <ChevronDown className="size-3.5 shrink-0 text-signal-panel-muted" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="theme-navigation w-64 border-sidebar-border bg-signal-panel text-signal-panel-text">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuItem onClick={onOpenAccount}><Camera /> Profile and workspace images</DropdownMenuItem>
              <DropdownMenuItem onClick={onSelectNavigation} render={<Link href="/app?choose=1" />}><LayoutGrid /> All workspaces</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <div className="px-1 py-0.5"><ThemeControl className="w-full justify-start text-signal-panel-muted hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" showLabel /></div>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onSignOut} variant="destructive"><LogOut /> Sign out</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

export function WorkspaceRail({ workspaceSlug, workspaces }: { workspaceSlug: string; workspaces: WorkspaceDTO[] }) {
  return (
    <aside className="theme-navigation hidden h-full min-h-0 flex-col items-center border-r border-sidebar-border bg-signal-carbon py-3 md:flex">
      <div className="mb-3 size-8"><BrandLogo mark="icon" priority /><span className="sr-only">Relay</span></div>
      <span className="mb-3 h-px w-7 bg-sidebar-border" aria-hidden="true" />
      <nav aria-label="Workspaces" className="flex flex-1 flex-col gap-2.5">
        {workspaces.map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger render={<Link aria-current={item.slug === workspaceSlug ? "page" : undefined} className={cn("text-metadata relative grid size-10 place-items-center rounded-lg border font-bold transition-[background-color,border-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-amber", item.slug === workspaceSlug ? "border-signal-amber/70 bg-signal-amber/10 text-signal-amber" : "border-sidebar-border text-signal-panel-muted hover:border-signal-panel-muted hover:bg-sidebar-accent hover:text-signal-panel-text")} href={`/app/${item.slug}`} />}>
              {item.slug === workspaceSlug && <span className="absolute inset-y-2 -left-[13px] w-0.5 rounded-r bg-signal-amber" />}
              <Avatar className="size-full rounded-lg"><AvatarPicture className="rounded-lg object-cover" src={item.imageUrl} /><AvatarFallback className="text-metadata rounded-lg bg-transparent font-bold text-inherit">{initials(item.name)}</AvatarFallback></Avatar>
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
  )
}
