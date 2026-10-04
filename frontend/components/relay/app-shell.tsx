"use client"

import { useState, type ReactNode } from "react"
import {
  AtSign,
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  ChevronRight,
  CirclePlus,
  Code2,
  ExternalLink,
  File,
  GitCommitHorizontal,
  Hash,
  ImageIcon,
  Inbox,
  Link2,
  ListChecks,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  Send,
  Settings2,
  Smile,
  Star,
  SunMoon,
  Users,
  Wifi,
  X,
} from "lucide-react"

import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const channels = [
  { name: "general", unread: 0 },
  { name: "product-build", unread: 3 },
  { name: "design-review", unread: 0 },
  { name: "customer-notes", unread: 0 },
  { name: "launch-planning", unread: 1 },
  { name: "bugs", unread: 0 },
  { name: "random", unread: 0 },
]

const directMessages = [
  { name: "Maya Chen", initials: "MC", status: "online" },
  { name: "Jon Bell", initials: "JB", status: "online" },
  { name: "Priya Nair", initials: "PN", status: "away" },
  { name: "Theo Martin", initials: "TM", status: "online" },
  { name: "Sarah Kim", initials: "SK", status: "online" },
]

function RelayMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 32 32" fill="none">
      <path
        d="M8 7h8.5a5.5 5.5 0 0 1 0 11H8m8.5 0L24 26"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="square"
      />
      <rect x="5" y="4" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="5" y="15.5" width="5" height="5" rx="1" fill="currentColor" />
      <rect x="22" y="23" width="5" height="5" rx="1" fill="currentColor" />
    </svg>
  )
}

function WorkspaceRail() {
  const workspaces = [
    { label: "Acme Co", initials: "AC", active: true, unread: false },
    { label: "Northstar", initials: "NS", active: false, unread: true },
    { label: "Papertrail", initials: "PT", active: false, unread: false },
    { label: "Design System", initials: "DS", active: false, unread: false },
  ]

  return (
    <aside className="hidden h-dvh w-16 flex-col items-center border-r border-signal-line bg-signal-carbon py-3 md:flex">
      <div className="mb-3 grid size-10 place-items-center text-signal-amber">
        <RelayMark className="size-8" />
        <span className="sr-only">Relay</span>
      </div>
      <div className="mb-3 h-px w-8 bg-signal-line" />
      <nav aria-label="Workspaces" className="flex flex-1 flex-col items-center gap-2">
        {workspaces.map((workspace) => (
          <Tooltip key={workspace.label}>
            <TooltipTrigger
              render={
                <button
                  aria-current={workspace.active ? "page" : undefined}
                  className={cn(
                    "relative grid size-10 place-items-center rounded-lg border text-[10px] font-bold tracking-[0.06em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-amber",
                    workspace.active
                      ? "border-signal-amber bg-white/8 text-signal-panel-text"
                      : "border-white/10 bg-transparent text-signal-panel-muted hover:border-white/25 hover:text-signal-panel-text"
                  )}
                  type="button"
                />
              }
            >
              {workspace.initials}
              {workspace.active && (
                <span className="absolute -left-[9px] h-6 w-0.5 rounded-r bg-signal-amber" />
              )}
              {workspace.unread && (
                <span className="absolute -right-1 -top-1 size-2 rounded-full bg-signal-amber ring-2 ring-signal-carbon" />
              )}
            </TooltipTrigger>
            <TooltipContent side="right">{workspace.label}</TooltipContent>
          </Tooltip>
        ))}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Add workspace"
                className="mt-1 border-white/10 bg-transparent text-signal-panel-muted hover:bg-white/8 hover:text-signal-panel-text"
                size="icon"
                type="button"
                variant="outline"
              />
            }
          >
            <Plus />
          </TooltipTrigger>
          <TooltipContent side="right">Add workspace</TooltipContent>
        </Tooltip>
      </nav>
      <Avatar className="size-9 rounded-lg" size="sm">
        <AvatarFallback className="rounded-lg bg-[#d8a96f] text-[10px] font-bold text-[#301f11]">AR</AvatarFallback>
        <AvatarBadge className="bg-signal-cyan" />
      </Avatar>
    </aside>
  )
}

function ConnectionControl() {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 bg-black/10 px-3 py-2.5 text-left transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan"
            type="button"
          />
        }
      >
        <span className="grid size-6 place-items-center rounded-md bg-signal-cyan/10 text-signal-cyan">
          <Wifi className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold text-signal-panel-text">Signal clear</span>
          <span className="block text-[9px] text-signal-panel-muted">Synced just now</span>
        </span>
        <ChevronRight className="size-3.5 text-signal-panel-muted" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 border border-signal-line bg-signal-surface p-0" side="right" sideOffset={10}>
        <PopoverHeader className="border-b border-signal-line px-3 py-2.5">
          <div className="flex items-center justify-between">
            <PopoverTitle className="text-xs text-signal-ink">Connection</PopoverTitle>
            <span className="size-2 rounded-full bg-signal-cyan" />
          </div>
          <PopoverDescription className="text-[10px]">Relay is fully synchronized.</PopoverDescription>
        </PopoverHeader>
        <dl className="grid grid-cols-2 gap-y-2 px-3 py-3 text-[10px]">
          <dt className="text-signal-muted">Realtime link</dt>
          <dd className="text-right font-medium text-signal-ink">Connected</dd>
          <dt className="text-signal-muted">Latency</dt>
          <dd className="text-right font-mono text-signal-ink">42 ms</dd>
          <dt className="text-signal-muted">Last sync</dt>
          <dd className="text-right text-signal-ink">Just now</dd>
          <dt className="text-signal-muted">Queued messages</dt>
          <dd className="text-right font-mono text-signal-ink">0</dd>
        </dl>
      </PopoverContent>
    </Popover>
  )
}

function SidebarNavigation({
  activeRoute,
  onRouteChange,
  mobile = false,
}: {
  activeRoute: string
  onRouteChange: (route: string) => void
  mobile?: boolean
}) {
  const primaryNavigation = [
    { label: "Search", icon: Search, shortcut: "Ctrl K" },
    { label: "Inbox", icon: Inbox, count: 3 },
    { label: "Threads", icon: MessageCircle },
    { label: "Mentions", icon: AtSign },
    { label: "Saved", icon: Bookmark },
    { label: "More", icon: MoreHorizontal },
  ]

  return (
    <div className={cn("flex min-h-0 flex-col bg-signal-panel", mobile ? "h-full" : "h-dvh border-r border-signal-line")}>
      <div className="flex h-[60px] shrink-0 items-center gap-2 border-b border-signal-line px-4">
        <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-amber" type="button">
          <span className="truncate text-sm font-semibold text-signal-panel-text">Acme Co</span>
          <ChevronDown className="size-3 text-signal-panel-muted" />
        </button>
        <Button aria-label="Workspace settings" size="icon-sm" type="button" variant="ghost">
          <Settings2 />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 px-3 py-3">
          {primaryNavigation.map((item) => (
            <button
              className="flex h-8 w-full items-center gap-3 rounded-md px-2 text-left text-[12px] text-signal-panel-muted transition-colors hover:bg-white/5 hover:text-signal-panel-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan"
              key={item.label}
              type="button"
            >
              <item.icon className="size-4" />
              <span>{item.label}</span>
              {item.count && (
                <span className="ml-auto min-w-5 rounded-full bg-signal-amber px-1.5 py-0.5 text-center text-[9px] font-bold text-signal-carbon">
                  {item.count}
                </span>
              )}
              {item.shortcut && (
                <kbd className="ml-auto rounded border border-white/10 bg-black/10 px-1.5 py-0.5 font-mono text-[8px] text-signal-panel-muted">
                  {item.shortcut}
                </kbd>
              )}
            </button>
          ))}

          <div className="flex h-8 items-center justify-between px-2 pt-3">
            <p className="text-[11px] font-medium text-signal-panel-muted">Channels</p>
            <Button aria-label="Create channel" size="icon-xs" type="button" variant="ghost">
              <Plus />
            </Button>
          </div>
          <nav aria-label="Channels" className="space-y-0.5">
            {channels.map((channel) => {
              const active = activeRoute === channel.name
              return (
                <button
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-amber",
                    active
                      ? "bg-signal-amber/12 font-semibold text-signal-amber"
                      : channel.unread
                        ? "font-semibold text-signal-panel-text hover:bg-white/5"
                        : "text-signal-panel-muted hover:bg-white/5 hover:text-signal-panel-text"
                  )}
                  key={channel.name}
                  onClick={() => onRouteChange(channel.name)}
                  type="button"
                >
                  {active && <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-signal-amber" />}
                  <Hash className="size-3.5" />
                  <span className="truncate">{channel.name}</span>
                  {channel.unread > 0 && !active && (
                    <span className="ml-auto size-2 rounded-full bg-signal-amber" />
                  )}
                </button>
              )
            })}
          </nav>

          <div className="flex h-8 items-center justify-between px-2 pt-3">
            <p className="text-[11px] font-medium text-signal-panel-muted">Direct messages</p>
            <Button aria-label="Start direct message" size="icon-xs" type="button" variant="ghost">
              <Plus />
            </Button>
          </div>
          <nav aria-label="Direct messages" className="space-y-0.5">
            {directMessages.map((person) => (
              <button
                className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[12px] text-signal-panel-muted transition-colors hover:bg-white/5 hover:text-signal-panel-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan"
                key={person.name}
                onClick={() => onRouteChange(person.name)}
                type="button"
              >
                <Avatar className="size-5" size="sm">
                  <AvatarFallback className="bg-white/10 text-[8px] font-bold text-signal-panel-text">{person.initials}</AvatarFallback>
                  <AvatarBadge className={person.status === "online" ? "bg-signal-cyan" : "bg-signal-muted"} />
                </Avatar>
                <span className={cn("truncate", person.name === "Jon Bell" && "font-semibold text-signal-panel-text")}>{person.name}</span>
                {person.name === "Priya Nair" && <span className="ml-auto size-2 rounded-full bg-signal-amber" />}
              </button>
            ))}
          </nav>
        </div>
      </ScrollArea>

      <div className="shrink-0 border-t border-signal-line p-3">
        <ConnectionControl />
      </div>
    </div>
  )
}

function Reaction({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <button
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan",
        active
          ? "border-signal-cyan/40 bg-signal-cyan/10 text-signal-cyan"
          : "border-signal-line bg-signal-surface text-signal-muted hover:text-signal-ink"
      )}
      type="button"
    >
      {children}
    </button>
  )
}

function PersonAvatar({ initials, color }: { initials: string; color: string }) {
  return (
    <Avatar className="size-8 rounded-lg" size="default">
      <AvatarFallback className={cn("rounded-lg text-[9px] font-bold", color)}>{initials}</AvatarFallback>
    </Avatar>
  )
}

function MessageRow({
  initials,
  color,
  name,
  time,
  children,
  actions,
}: {
  initials: string
  color: string
  name: string
  time: string
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <article className="group relative flex gap-3 px-5 py-2.5 transition-colors hover:bg-signal-surface/35 sm:px-7">
      <PersonAvatar color={color} initials={initials} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline gap-2">
          <h3 className="text-[12px] font-semibold text-signal-ink">{name}</h3>
          <time className="font-mono text-[9px] text-signal-muted">{time}</time>
        </div>
        <div className="max-w-[82ch] text-[12px] leading-5 text-signal-ink/90">{children}</div>
        {actions && <div className="mt-2 flex flex-wrap items-center gap-1.5">{actions}</div>}
      </div>
      <div className="absolute right-5 top-1.5 hidden items-center rounded-md border border-signal-line bg-signal-surface shadow-md group-hover:flex group-focus-within:flex">
        <Button aria-label={`React to ${name}`} size="icon-xs" type="button" variant="ghost"><Smile /></Button>
        <Button aria-label={`Reply to ${name}`} size="icon-xs" type="button" variant="ghost"><MessageCircle /></Button>
        <Button aria-label="More message actions" size="icon-xs" type="button" variant="ghost"><MoreHorizontal /></Button>
      </div>
      <Button aria-label={`More actions for ${name}'s message`} className="absolute right-3 top-2 sm:hidden" size="icon-sm" type="button" variant="ghost"><MoreHorizontal /></Button>
    </article>
  )
}

function OnboardingPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div className={cn("overflow-hidden rounded-md border border-signal-line bg-signal-carbon", compact ? "h-28" : "h-32 max-w-[480px]") }>
      <div className="grid h-full grid-cols-[0.9fr_2fr]">
        <div className="flex flex-col justify-between border-r border-signal-line bg-signal-carbon p-3">
          <RelayMark className="size-6 text-signal-amber" />
          <div>
            <p className="text-[11px] font-semibold leading-tight text-signal-ink">Onboarding flow</p>
            <p className="text-[11px] font-semibold text-signal-ink">v2.0</p>
            <p className="mt-1 text-[6px] font-bold tracking-wide text-signal-amber">RELAY PRODUCT DESIGN</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 bg-[#151d21] p-3">
          {[false, false, true].map((light, index) => (
            <div className={cn("rounded-sm p-2", light ? "bg-[#e9e7df]" : "bg-[#232d31]")} key={index}>
              <div className={cn("mb-3 h-2 rounded-sm", light ? "bg-[#c3c7c2]" : "bg-[#344248]")} />
              <div className={cn("mb-1 h-1 w-3/4 rounded-sm", light ? "bg-[#7b8584]" : "bg-[#617176]")} />
              <div className={cn("h-1 w-1/2 rounded-sm", light ? "bg-[#aeb3ae]" : "bg-[#46555a]")} />
              <div className="mt-4 h-5 rounded-sm bg-signal-amber" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ConversationComposer({ channel }: { channel: string }) {
  const [draft, setDraft] = useState("")

  return (
    <div className="shrink-0 px-3 pb-3 sm:px-5">
      <div className="rounded-lg border border-signal-line bg-signal-surface focus-within:border-signal-muted focus-within:ring-2 focus-within:ring-signal-cyan/10">
        <Textarea
          aria-label={`Message ${channel}`}
          className="min-h-12 resize-none border-0 bg-transparent px-3 py-2.5 text-[12px] shadow-none focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
          onChange={(event) => setDraft(event.target.value)}
          placeholder={`Message #${channel}`}
          rows={1}
          value={draft}
        />
        <div className="flex items-center gap-0.5 border-t border-signal-line px-2 py-1.5">
          <Button aria-label="Add attachment" size="icon-sm" type="button" variant="ghost"><CirclePlus /></Button>
          <Button aria-label="Add image" size="icon-sm" type="button" variant="ghost"><ImageIcon /></Button>
          <Button aria-label="Add emoji" size="icon-sm" type="button" variant="ghost"><Smile /></Button>
          <Button aria-label="Mention teammate" size="icon-sm" type="button" variant="ghost"><AtSign /></Button>
          <Button aria-label="Use slash command" size="icon-sm" type="button" variant="ghost"><Code2 /></Button>
          <span className="ml-auto hidden text-[9px] text-signal-muted md:inline">Enter to send</span>
          <span className="hidden text-[9px] text-signal-muted/65 lg:inline">Shift + Enter for new line</span>
          <Button
            aria-label="Send message"
            className="ml-2 bg-signal-amber text-signal-carbon hover:bg-signal-amber/85"
            disabled={!draft.trim()}
            onClick={() => setDraft("")}
            size="icon-sm"
            type="button"
          >
            <Send />
          </Button>
        </div>
      </div>
    </div>
  )
}

function ThreadPanel({ onClose }: { onClose?: () => void }) {
  return (
    <section className="flex h-full min-h-0 flex-col bg-signal-panel" aria-label="Thread">
      <header className="flex h-[60px] shrink-0 items-center border-b border-signal-line px-4">
        <div>
          <h2 className="text-sm font-semibold text-signal-panel-text">Thread</h2>
          <p className="text-[9px] text-signal-panel-muted"># product-build</p>
        </div>
        {onClose && (
          <Button aria-label="Close thread" className="ml-auto" onClick={onClose} size="icon-sm" type="button" variant="ghost"><X /></Button>
        )}
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          <div className="flex gap-3">
            <PersonAvatar color="bg-[#e7c7a8] text-[#332216]" initials="MC" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2"><h3 className="text-[12px] font-semibold text-signal-panel-text">Maya Chen</h3><time className="font-mono text-[9px] text-signal-panel-muted">09:14</time></div>
              <p className="mt-1 text-[11px] leading-[1.55] text-signal-panel-text/90">Here&apos;s the updated design for the new onboarding flow. This should make the experience much clearer for new users. Would love your feedback!</p>
              <div className="mt-3"><OnboardingPreview compact /></div>
              <p className="mt-1.5 text-[9px] text-signal-panel-muted">onboarding-flow-v2.png · 1.2 MB</p>
              <div className="mt-2 flex gap-1.5"><Reaction>● 6</Reaction><Reaction>▲ 3</Reaction><Reaction active><MessageCircle className="size-3" /> 2</Reaction></div>
            </div>
          </div>

          <div className="my-5 flex items-center gap-3"><span className="text-[10px] font-semibold text-signal-panel-text">5 replies</span><span className="h-px flex-1 bg-white/10" /></div>

          <div className="space-y-5">
            {[
              { initials: "JB", name: "Jon Bell", time: "09:28", color: "bg-[#91c6ba] text-[#102a25]", text: "Looks great! I especially like the simplified steps." },
              { initials: "PN", name: "Priya Nair", time: "09:31", color: "bg-[#b99ed8] text-[#281b3c]", text: "I'll add a progress bar and update the copy." },
              { initials: "TM", name: "Theo Martin", time: "09:42", color: "bg-[#e4b77c] text-[#30200f]", text: "We should also consider adding a short video for the first step." },
              { initials: "SK", name: "Sarah Kim", time: "09:55", color: "bg-[#e5a395] text-[#3c1e18]", text: "Good idea. I can work on a simple animation for that." },
              { initials: "JB", name: "Jon Bell", time: "10:01", color: "bg-[#91c6ba] text-[#102a25]", text: "Perfect! Let's sync later today to finalize this." },
            ].map((reply) => (
              <div className="flex gap-3" key={`${reply.name}-${reply.time}`}>
                <PersonAvatar color={reply.color} initials={reply.initials} />
                <div className="min-w-0 flex-1"><div className="flex items-baseline gap-2"><h3 className="text-[11px] font-semibold text-signal-panel-text">{reply.name}</h3><time className="font-mono text-[8px] text-signal-panel-muted">{reply.time}</time></div><p className="mt-1 text-[11px] leading-[1.5] text-signal-panel-text/85">{reply.text}</p></div>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
      <div className="shrink-0 p-3">
        <div className="rounded-lg border border-white/10 bg-black/10">
          <Textarea aria-label="Reply to thread" className="min-h-12 resize-none border-0 bg-transparent px-3 py-2.5 text-[11px] text-signal-panel-text shadow-none placeholder:text-signal-panel-muted focus-visible:ring-0 dark:bg-transparent" placeholder="Reply to thread" rows={1} />
          <div className="flex items-center border-t border-white/10 px-2 py-1.5"><Button aria-label="Attach file" className="text-signal-panel-muted hover:text-signal-panel-text" size="icon-sm" type="button" variant="ghost"><Plus /></Button><Button aria-label="Add emoji" className="text-signal-panel-muted hover:text-signal-panel-text" size="icon-sm" type="button" variant="ghost"><Smile /></Button><Button aria-label="Mention teammate" className="text-signal-panel-muted hover:text-signal-panel-text" size="icon-sm" type="button" variant="ghost"><AtSign /></Button><Button aria-label="Send thread reply" className="ml-auto bg-signal-amber text-signal-carbon hover:bg-signal-amber/85" size="icon-sm" type="button"><Send /></Button></div>
        </div>
      </div>
    </section>
  )
}

function MessageHistory({ onOpenThread }: { onOpenThread: () => void }) {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <div role="log" aria-label="Message history" className="mx-auto w-full max-w-6xl py-2">
        <div className="flex items-center gap-3 px-5 py-2 sm:px-7"><span className="h-px flex-1 bg-signal-line" /><span className="rounded-full border border-signal-line bg-signal-surface px-3 py-1 text-[9px] text-signal-muted">Today</span><span className="h-px flex-1 bg-signal-line" /></div>

        <MessageRow initials="MC" color="bg-[#91c6ba] text-[#102a25]" name="Maya Chen" time="09:14" actions={<><Reaction>● 6</Reaction><Reaction>▲ 3</Reaction><Reaction active><MessageCircle className="size-3" /> 2</Reaction></>}>
          <p>Here&apos;s the updated design for the new onboarding flow. This should make the experience much clearer for new users. Would love your feedback!</p>
          <div className="mt-2.5"><OnboardingPreview /></div>
          <p className="mt-1.5 text-[9px] text-signal-muted">onboarding-flow-v2.png · 1.2 MB</p>
        </MessageRow>

        <MessageRow initials="JB" color="bg-[#e4b77c] text-[#30200f]" name="Jon Bell" time="09:28" actions={<Reaction>● 2</Reaction>}>
          <p>Looks great! I especially like the simplified steps. One small suggestion — we might want to show a progress indicator at the top.</p>
        </MessageRow>

        <MessageRow initials="PN" color="bg-[#b99ed8] text-[#281b3c]" name="Priya Nair" time="09:31" actions={<Reaction>♥ 4</Reaction>}>
          <p>Agreed. I&apos;ll add a progress bar and update the copy. Also attaching the latest Figma file.</p>
          <div className="mt-2 flex max-w-[520px] items-center gap-3 rounded-md border border-signal-line bg-signal-surface px-3 py-2.5">
            <div className="grid size-8 place-items-center rounded-md bg-signal-surface-raised"><span className="grid grid-cols-2 gap-0.5"><span className="size-1.5 rounded-full bg-[#f24e1e]"/><span className="size-1.5 rounded-full bg-[#ff7262]"/><span className="size-1.5 rounded-full bg-[#a259ff]"/><span className="size-1.5 rounded-full bg-[#1abcfe]"/></span></div>
            <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-signal-ink">Relay – Onboarding flow</p><p className="text-[9px] text-signal-muted">Figma file · Updated 5 minutes ago</p></div><ExternalLink className="size-3.5 text-signal-muted" />
          </div>
        </MessageRow>

        <MessageRow initials="TM" color="bg-[#8abfaa] text-[#153028]" name="Theo Martin" time="09:42" actions={<><Reaction>▲ 3</Reaction><Reaction active><Check className="size-3" /> 1</Reaction></>}>
          <p>I pushed the API changes for the onboarding endpoints. You can test it on the staging environment. Let me know if you run into any issues.</p>
          <div className="mt-2 flex max-w-[520px] items-center gap-3 rounded-md border border-signal-line bg-signal-surface px-3 py-2.5"><GitCommitHorizontal className="size-5 text-signal-cyan"/><div><p className="text-[10px] text-signal-ink">feat(auth): add onboarding endpoints</p><p className="font-mono text-[8px] text-signal-muted">8f3a2c1 · 4 files changed</p></div></div>
        </MessageRow>

        <div className="px-5 py-1 sm:px-7"><button className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-[10px] font-medium text-signal-cyan transition-colors hover:bg-signal-cyan/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan" onClick={onOpenThread} type="button"><MessageCircle className="size-3.5" /> Open thread · 5 replies</button></div>
      </div>
    </ScrollArea>
  )
}

export function RelayAppShell() {
  const [activeRoute, setActiveRoute] = useState("product-build")
  const [threadOpen, setThreadOpen] = useState(true)
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false)

  function toggleTheme() {
    const root = document.documentElement
    root.classList.toggle("dark")
    root.style.colorScheme = root.classList.contains("dark") ? "dark" : "light"
  }

  function openThread() {
    setThreadOpen(true)
    setMobileThreadOpen(true)
  }

  return (
    <TooltipProvider>
      <div className={cn("grid h-dvh min-h-[620px] overflow-hidden bg-signal-paper text-signal-ink", threadOpen ? "grid-cols-1 md:grid-cols-[64px_minmax(0,1fr)] lg:grid-cols-[64px_250px_minmax(0,1fr)] xl:grid-cols-[64px_250px_minmax(0,1fr)_340px]" : "grid-cols-1 md:grid-cols-[64px_minmax(0,1fr)] lg:grid-cols-[64px_250px_minmax(0,1fr)]")}>
        <WorkspaceRail />
        <aside className="hidden min-w-0 lg:block"><SidebarNavigation activeRoute={activeRoute} onRouteChange={setActiveRoute} /></aside>

        <main className="flex min-h-0 min-w-0 flex-col bg-signal-paper">
          <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-signal-line px-3 sm:px-5">
            <Sheet>
              <SheetTrigger render={<Button aria-label="Open navigation" className="lg:hidden" size="icon" type="button" variant="ghost" />}><Menu /></SheetTrigger>
              <SheetContent className="w-[min(88vw,320px)] gap-0 border-signal-line bg-signal-panel p-0" side="left">
                <SheetHeader className="sr-only"><SheetTitle>Relay navigation</SheetTitle><SheetDescription>Choose a destination or conversation.</SheetDescription></SheetHeader>
                <SidebarNavigation activeRoute={activeRoute} mobile onRouteChange={setActiveRoute} />
              </SheetContent>
            </Sheet>
            <Hash className="size-4 text-signal-muted" />
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h1 className="truncate text-sm font-semibold text-signal-ink">{activeRoute}</h1><Star className="size-3.5 text-signal-muted" /></div><p className="truncate text-[9px] text-signal-muted">Product development, technical discussion, and release planning.</p></div>
            <div className="hidden items-center -space-x-1.5 sm:flex">{["MC","JB","PN","TM"].map((initials, index) => <Avatar className="size-6 ring-2 ring-signal-paper" key={initials} size="sm"><AvatarFallback className={cn("text-[8px] font-bold", ["bg-[#91c6ba] text-[#102a25]","bg-[#e4b77c] text-[#30200f]","bg-[#b99ed8] text-[#281b3c]","bg-[#8abfaa] text-[#153028]"][index])}>{initials}</AvatarFallback></Avatar>)}<span className="grid size-6 place-items-center rounded-full bg-signal-surface-raised text-[8px] text-signal-muted ring-2 ring-signal-paper">12</span></div>
            <Button aria-label="Search conversation" size="icon-sm" type="button" variant="ghost"><Search /></Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button aria-label="Conversation options" size="icon-sm" type="button" variant="ghost" />}><MoreHorizontal /></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 border-signal-line bg-signal-surface"><DropdownMenuLabel>Conversation</DropdownMenuLabel><DropdownMenuItem><Users /> View members</DropdownMenuItem><DropdownMenuItem><Bell /> Notifications</DropdownMenuItem><DropdownMenuItem onClick={openThread}><MessageCircle /> Open thread</DropdownMenuItem><DropdownMenuSeparator/><DropdownMenuItem onClick={toggleTheme}><SunMoon /> Toggle theme</DropdownMenuItem></DropdownMenuContent>
            </DropdownMenu>
          </header>

          <Tabs className="min-h-0 flex-1 gap-0 overflow-hidden" defaultValue="messages">
            <TabsList className="h-11 w-full justify-start gap-5 rounded-none border-b border-signal-line px-4 sm:px-6" variant="line">
              <TabsTrigger className="h-full flex-none px-0 text-[10px] after:bg-signal-amber" value="messages">Messages</TabsTrigger>
              <TabsTrigger className="h-full flex-none px-0 text-[10px] after:bg-signal-amber" value="files"><File className="size-3" /> Files</TabsTrigger>
              <TabsTrigger className="h-full flex-none px-0 text-[10px] after:bg-signal-amber" value="tasks"><ListChecks className="size-3" /> Tasks</TabsTrigger>
              <TabsTrigger className="hidden h-full flex-none px-0 text-[10px] after:bg-signal-amber sm:inline-flex" value="links"><Link2 className="size-3" /> Links</TabsTrigger>
              <TabsTrigger className="hidden h-full flex-none px-0 text-[10px] after:bg-signal-amber sm:inline-flex" value="pinned"><Pin className="size-3" /> Pinned</TabsTrigger>
            </TabsList>
            <TabsContent className="flex h-0 min-h-0 overflow-hidden flex-col" value="messages"><MessageHistory onOpenThread={openThread}/><div className="flex shrink-0 items-center gap-2 px-5 py-1 text-[9px] text-signal-muted"><span className="flex gap-0.5"><span className="size-1 rounded-full bg-signal-cyan"/><span className="size-1 rounded-full bg-signal-cyan/70"/><span className="size-1 rounded-full bg-signal-cyan/40"/></span>Sarah Kim is typing…</div><ConversationComposer channel={activeRoute}/></TabsContent>
            {[
              ["files", "Shared files will appear here."],
              ["tasks", "Channel tasks will appear here."],
              ["links", "Shared links will appear here."],
              ["pinned", "Pinned messages will appear here."],
            ].map(([value, copy]) => <TabsContent className="grid place-items-center" key={value} value={value}><div className="text-center"><p className="text-sm font-medium text-signal-ink">{copy}</p><p className="mt-1 text-[11px] text-signal-muted">This visual prototype keeps the state intentionally quiet.</p></div></TabsContent>)}
          </Tabs>
        </main>

        {threadOpen && <aside className="hidden min-h-0 border-l border-signal-line xl:block"><ThreadPanel onClose={() => setThreadOpen(false)} /></aside>}

        <Sheet onOpenChange={setMobileThreadOpen} open={mobileThreadOpen}>
          <SheetContent className="w-[min(92vw,380px)] gap-0 border-signal-line bg-signal-panel p-0 xl:hidden" showCloseButton={false} side="right">
            <SheetHeader className="sr-only"><SheetTitle>Thread</SheetTitle><SheetDescription>Replies to Maya Chen&apos;s message.</SheetDescription></SheetHeader>
            <ThreadPanel onClose={() => setMobileThreadOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  )
}
