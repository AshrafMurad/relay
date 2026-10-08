import Link from "next/link"
import type { ReactNode } from "react"
import { Archive, Hash, Info, Menu, MoreHorizontal, Pencil, RotateCcw, Search, UserRound, UsersRound } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { AvatarPicture, initials } from "@/components/relay/app-shell/shared"
import type { ChannelDTO, DirectConversationDTO, WorkspaceDTO, WorkspaceMemberDTO } from "@/lib/api/contracts"
import { cn } from "@/lib/utils"

type AppHeaderProps = {
  mayManage: boolean
  members: WorkspaceMemberDTO[]
  navigation: ReactNode
  navigationOpen: boolean
  selectedChannel: ChannelDTO | null
  selectedDirectConversation: DirectConversationDTO | null
  workspace: WorkspaceDTO
  onArchiveStateChange: (action: "archive" | "restore") => void
  onEditChannel: () => void
  onNavigationOpenChange: (open: boolean) => void
  onOpenDetails: () => void
}

export function AppHeader({ mayManage, members, navigation, navigationOpen, selectedChannel, selectedDirectConversation, workspace, onArchiveStateChange, onEditChannel, onNavigationOpenChange, onOpenDetails }: AppHeaderProps) {
  return (
    <header className="flex h-[60px] shrink-0 items-center gap-2.5 border-b border-signal-line bg-signal-paper/95 px-3 sm:px-5">
      <Sheet onOpenChange={onNavigationOpenChange} open={navigationOpen}>
        <SheetTrigger render={<Button aria-label="Open navigation" className="lg:hidden" size="icon" type="button" variant="ghost" />}><Menu /></SheetTrigger>
        <SheetContent className="theme-navigation w-[min(88vw,320px)] gap-0 border-sidebar-border bg-signal-panel p-0" side="left">
          <SheetHeader className="sr-only"><SheetTitle>Workspace navigation</SheetTitle><SheetDescription>Choose a workspace or channel.</SheetDescription></SheetHeader>
          {navigation}
        </SheetContent>
      </Sheet>
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-signal-surface-raised/70 text-signal-muted">{selectedDirectConversation ? <UserRound className="size-4" /> : <Hash className="size-4" />}</span>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold leading-4 tracking-[-0.01em]">{selectedDirectConversation?.otherUser.name ?? selectedChannel?.name ?? workspace.name}</h1>
        <p className="text-helper truncate text-signal-muted">{selectedDirectConversation ? selectedDirectConversation.otherUser.email : selectedChannel?.description || (selectedChannel ? "No channel description" : "Choose a channel or direct message from the workspace navigation")}</p>
      </div>
      {selectedChannel && <div className="hidden items-center -space-x-1.5 sm:flex" aria-label={`${members.length} workspace members`}>{members.slice(0, 3).map((member) => <Avatar className="size-6 rounded-md border-2 border-signal-paper" key={member.id}><AvatarPicture className="rounded-sm" src={member.image} /><AvatarFallback className="rounded-sm bg-signal-surface-raised text-[8px] font-semibold text-signal-muted">{initials(member.name)}</AvatarFallback></Avatar>)}{members.length > 3 && <span className="text-metadata grid size-6 place-items-center rounded-md border-2 border-signal-paper bg-signal-surface-raised text-signal-muted">+{members.length - 3}</span>}</div>}
      <Tooltip>
        <TooltipTrigger render={<Link aria-label="Search messages" className={buttonVariants({ size: "icon-sm", variant: "ghost" })} href={`/app/${workspace.slug}/search`} />}><Search /></TooltipTrigger>
        <TooltipContent>Search messages</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger render={<Link aria-label="Workspace members" className={cn(buttonVariants({ size: "icon-sm", variant: "ghost" }), "hidden sm:inline-flex")} href={`/app/${workspace.slug}/members`} />}><UsersRound /></TooltipTrigger>
        <TooltipContent>Workspace members</TooltipContent>
      </Tooltip>
      {selectedChannel && <Tooltip><TooltipTrigger render={<Button aria-label="Open channel details" className="xl:hidden" onClick={onOpenDetails} size="icon-sm" type="button" variant="ghost" />}><Info /></TooltipTrigger><TooltipContent>Channel details</TooltipContent></Tooltip>}
      {selectedChannel && !selectedDirectConversation && mayManage && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button aria-label="Channel options" size="icon-sm" type="button" variant="ghost" />}><MoreHorizontal /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Channel</DropdownMenuLabel>
              <DropdownMenuItem onClick={onEditChannel}><Pencil /> Edit details</DropdownMenuItem>
              <DropdownMenuSeparator />
              {selectedChannel.archivedAt
                ? <DropdownMenuItem onClick={() => onArchiveStateChange("restore")}><RotateCcw /> Restore channel</DropdownMenuItem>
                : <DropdownMenuItem disabled={selectedChannel.name === "general"} onClick={() => onArchiveStateChange("archive")} variant="destructive"><Archive /> Archive channel</DropdownMenuItem>}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  )
}
