"use client"

import { useState } from "react"
import { Hash, Search } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ChannelDTO, WorkspaceMemberDTO } from "@/lib/api/contracts"
import { cn } from "@/lib/utils"
import { AvatarPicture, initials } from "@/components/relay/app-shell/shared"

export function ChannelDetails({ channel, currentUserId, members, onlineUserIds }: { channel: ChannelDTO; currentUserId: string; members: WorkspaceMemberDTO[]; onlineUserIds: Set<string> }) {
  const [query, setQuery] = useState("")
  const normalizedQuery = query.trim().toLowerCase()
  const visibleMembers = normalizedQuery
    ? members.filter((member) => member.name.toLowerCase().includes(normalizedQuery) || member.email.toLowerCase().includes(normalizedQuery))
    : members

  return (
    <div className="theme-navigation flex h-full min-h-0 flex-col bg-signal-panel text-signal-panel-text">
      <div className="flex h-[60px] shrink-0 items-center border-b border-sidebar-border px-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Channel details</h2>
          <p className="text-helper mt-0.5 truncate text-signal-panel-muted">#{channel.name}</p>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-4">
          <section>
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-md border border-sidebar-border bg-signal-carbon text-signal-amber"><Hash className="size-4" /></span>
              <div className="min-w-0">
                <h3 className="text-xs font-semibold">About</h3>
                <p className="text-helper mt-0.5 truncate text-signal-panel-muted">#{channel.name}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-signal-panel-text/90">{channel.description || "No description has been added yet."}</p>
            <p className="text-metadata mt-2 uppercase tracking-[0.1em] text-signal-panel-muted">Public channel</p>
          </section>

          <section className="border-t border-sidebar-border pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold">Members</h3>
              <span className="text-metadata text-signal-panel-muted">{members.length}</span>
            </div>
            <label className="relative mt-3 block">
              <span className="sr-only">Find a member</span>
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-signal-panel-muted" />
              <Input className="h-8 border-sidebar-border bg-signal-carbon pl-8 text-xs text-signal-panel-text placeholder:text-signal-panel-muted focus-visible:ring-signal-cyan/20" onChange={(event) => setQuery(event.target.value)} placeholder="Find a member" value={query} />
            </label>
            <div className="mt-2 space-y-0.5">
              {visibleMembers.map((member) => {
                const online = member.userId === currentUserId || onlineUserIds.has(member.userId)
                return (
                  <div className="flex min-h-10 items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors duration-150 hover:bg-sidebar-accent/80" key={member.id}>
                    <span className="relative shrink-0">
                      <Avatar className="size-7 rounded-md">
                        <AvatarPicture className="rounded-md" src={member.image} />
                        <AvatarFallback className="text-metadata rounded-md bg-signal-panel-raised font-semibold text-signal-panel-muted">{initials(member.name)}</AvatarFallback>
                      </Avatar>
                      <span aria-label={online ? "Online" : "Offline"} className={cn("absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-signal-panel", online ? "bg-signal-cyan" : "bg-signal-panel-muted/45")} role="img" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{member.name}{member.userId === currentUserId && <span className="font-normal text-signal-panel-muted"> (you)</span>}</p>
                      <p className="text-metadata mt-0.5 capitalize text-signal-panel-muted">{member.role.toLowerCase()}</p>
                      <span className="sr-only">{online ? "Online" : "Offline"}</span>
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
