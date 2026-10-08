"use client"

import Image from "next/image"
import { useCallback, useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { AlertCircle, AtSign, CornerUpLeft, Download, FileArchive, FileJson, FileText, FileType2, ImageIcon, LoaderCircle, MessageSquareText, MoreHorizontal, Paperclip, Pencil, RotateCcw, Send, Smile, SmilePlus, Trash2, UserPlus, X } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { API_BASE_URL, apiRequest } from "@/lib/api/client"
import type { AuthUserDTO, ChannelDTO, ConversationReadStateDTO, DirectConversationDTO, MessageDTO, MessageHistoryResponse, PendingAttachmentDTO, ReactionSummaryDTO, TypingUpdateEvent, WorkspaceSyncEvent, WorkspaceSyncResponse } from "@/lib/api/contracts"
import { mediaUrl } from "@/lib/api/media"
import {
  MESSAGE_CODE_POINT_LIMIT,
  createOptimisticMessage,
  mergeMessages,
  reconcileMessageUpdate,
  replaceMessage,
  validateMessageContent,
  type ClientMessage,
} from "@/lib/messages"
import { createRelaySocket, type RelaySocket } from "@/lib/realtime/socket"
import { cn } from "@/lib/utils"

type HistoryState = "loading" | "ready" | "error"
type SocketState = "connecting" | "connected" | "disconnected"

const ACK_TIMEOUT_MS = 10_000
const TYPING_INACTIVITY_MS = 3_000
const TYPING_REFRESH_MS = 3_000
const QUICK_REACTIONS = ["👍", "✅", "👀", "❤️"]
const MAX_ATTACHMENT_COUNT = 5
const MAX_FILE_BYTES = 25 * 1024 * 1024
const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024
const ATTACHMENT_ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.csv,.json,.zip"
const EMOJI_GROUPS = [
  { label: "Often used", emojis: [["👍", "Thumbs up"], ["👎", "Thumbs down"], ["❤️", "Red heart"], ["😂", "Tears of joy"], ["🎉", "Party popper"], ["✅", "Check mark"], ["👀", "Eyes"], ["🙌", "Raised hands"]] },
  { label: "People", emojis: [["😀", "Grinning face"], ["😃", "Happy face"], ["😄", "Smiling face"], ["😊", "Warm smile"], ["😍", "Heart eyes"], ["🤔", "Thinking face"], ["😅", "Nervous laugh"], ["😭", "Crying face"], ["😎", "Cool face"], ["🥳", "Party face"], ["🤯", "Mind blown"], ["😴", "Sleeping face"], ["🤝", "Handshake"], ["👏", "Clapping hands"], ["💪", "Strong arm"], ["🙏", "Thank you"]] },
  { label: "Work", emojis: [["🚀", "Rocket"], ["💡", "Idea"], ["🔥", "Fire"], ["⚡", "Lightning"], ["🐛", "Bug"], ["🛠️", "Tools"], ["📌", "Pin"], ["📣", "Announcement"], ["📝", "Note"], ["📎", "Paperclip"], ["🔍", "Search"], ["💻", "Laptop"], ["📊", "Chart"], ["⏰", "Alarm clock"]] },
  { label: "Symbols", emojis: [["✨", "Sparkles"], ["⭐", "Star"], ["💯", "One hundred"], ["❗", "Exclamation"], ["❓", "Question"], ["➕", "Plus"], ["➖", "Minus"], ["⬆️", "Up arrow"], ["⬇️", "Down arrow"], ["🟢", "Green circle"], ["🟡", "Yellow circle"], ["🔴", "Red circle"]] },
] as const

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" })
const dateFormatter = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" })

function initials(value: string) {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
}

function messageError(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback
}

function ReplyPreview({ message }: { message: ClientMessage }) {
  if (!message.parent) return null
  return (
    <div className="text-helper mb-1 flex max-w-[72ch] items-start gap-2 border-l border-signal-line pl-2 text-signal-muted">
      <CornerUpLeft className="mt-0.5 size-3 shrink-0" />
      <p className="min-w-0 truncate">
        <span className="font-semibold text-signal-ink/80">{message.parent.authorName}</span>{" "}
        {message.parent.deletedAt ? "Message deleted" : message.parent.content}
      </p>
    </div>
  )
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function attachmentKind(mimeType: string) {
  if (mimeType.startsWith("image/")) return "Image"
  if (mimeType === "application/pdf") return "PDF"
  if (mimeType === "application/zip") return "Archive"
  if (mimeType === "application/json") return "JSON"
  if (mimeType === "text/csv") return "CSV"
  return "Text file"
}

function AttachmentIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const props = { className: cn("size-4", className), "aria-hidden": true }
  if (mimeType.startsWith("image/")) return <ImageIcon {...props} />
  if (mimeType === "application/zip") return <FileArchive {...props} />
  if (mimeType === "application/json") return <FileJson {...props} />
  if (mimeType === "application/pdf") return <FileType2 {...props} />
  return <FileText {...props} />
}

function downloadUrl(path: string) {
  return `${API_BASE_URL}${path}`
}

function MessageAttachmentCard({ attachment }: { attachment: MessageDTO["attachments"][number] }) {
  const isImage = attachment.mimeType.startsWith("image/")
  const href = downloadUrl(attachment.downloadUrl)
  if (isImage) {
    return (
      <Dialog>
        <Attachment className="w-44 border-signal-line bg-signal-surface text-signal-ink hover:bg-signal-surface-raised/45 sm:w-56" orientation="vertical">
          <AttachmentMedia className="h-32 rounded-md bg-signal-surface-raised sm:h-40" variant="image">
            <Image alt={attachment.originalFilename} className="object-cover" fill sizes="(min-width: 640px) 14rem, 11rem" src={href} unoptimized />
          </AttachmentMedia>
          <AttachmentContent className="pb-2">
            <AttachmentTitle className="text-xs">{attachment.originalFilename}</AttachmentTitle>
            <AttachmentDescription className="text-metadata text-signal-muted">{attachmentKind(attachment.mimeType)} · {formatFileSize(attachment.sizeBytes)}</AttachmentDescription>
          </AttachmentContent>
          <DialogTrigger render={<AttachmentTrigger aria-label={`Preview ${attachment.originalFilename}`} />} />
        </Attachment>
        <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden border-signal-line bg-signal-paper p-0 text-signal-ink sm:max-w-4xl">
          <DialogHeader className="border-b border-signal-line px-4 py-3 pr-12 text-left">
            <DialogTitle className="truncate text-sm">{attachment.originalFilename}</DialogTitle>
            <DialogDescription className="text-metadata text-signal-muted">{attachmentKind(attachment.mimeType)} · {formatFileSize(attachment.sizeBytes)}</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[min(72dvh,44rem)] place-items-center overflow-auto bg-signal-carbon p-3 sm:p-5">
            <div className="relative h-[min(62dvh,38rem)] w-full max-w-3xl overflow-hidden rounded-lg border border-sidebar-border bg-signal-panel">
              <Image alt={attachment.originalFilename} className="object-contain" fill sizes="(min-width: 1024px) 56rem, calc(100vw - 3rem)" src={href} unoptimized />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-signal-line px-4 py-3">
            <p className="text-helper min-w-0 truncate text-signal-muted">Authenticated image preview</p>
            <Button nativeButton={false} render={<a download={attachment.originalFilename} href={href} />} size="sm" variant="outline"><Download />Download</Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Attachment className="min-h-14 w-full border-signal-line bg-signal-surface text-signal-ink hover:bg-signal-surface-raised/45 sm:max-w-72">
      <AttachmentMedia className="bg-signal-surface-raised text-signal-muted"><AttachmentIcon mimeType={attachment.mimeType} /></AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle className="text-xs">{attachment.originalFilename}</AttachmentTitle>
        <AttachmentDescription className="text-metadata text-signal-muted">{attachmentKind(attachment.mimeType)} · {formatFileSize(attachment.sizeBytes)}</AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions><Download className="size-3.5 text-signal-muted" /></AttachmentActions>
      <AttachmentTrigger aria-label={`Download ${attachment.originalFilename}`} render={<a download={attachment.originalFilename} href={href} />} />
    </Attachment>
  )
}

function PendingAttachmentCard({ attachment, onRemove }: { attachment: PendingAttachmentDTO; onRemove: () => void }) {
  return (
    <Attachment className="border-signal-line bg-signal-paper text-signal-ink" size="sm" state="done">
      <AttachmentMedia className="bg-signal-surface-raised text-signal-muted"><AttachmentIcon mimeType={attachment.mimeType} /></AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{attachment.originalFilename}</AttachmentTitle>
        <AttachmentDescription className="text-metadata text-signal-muted">{formatFileSize(attachment.sizeBytes)}</AttachmentDescription>
      </AttachmentContent>
      <AttachmentActions><AttachmentAction aria-label={`Remove ${attachment.originalFilename}`} onClick={onRemove} type="button"><X /></AttachmentAction></AttachmentActions>
    </Attachment>
  )
}

function MessageRow({
  archived,
  currentUserId,
  grouped,
  message,
  onDelete,
  onEdit,
  onReply,
  onReact,
  onRetry,
}: {
  archived: boolean
  currentUserId: string
  grouped: boolean
  message: ClientMessage
  onDelete: (message: ClientMessage) => Promise<void>
  onEdit: (message: ClientMessage, content: string) => Promise<void>
  onReact: (message: ClientMessage, emoji: string) => void
  onReply: (message: ClientMessage) => void
  onRetry: (message: ClientMessage) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(message.content)
  const [editError, setEditError] = useState("")
  const [saving, setSaving] = useState(false)
  const ownMessage = message.author.id === currentUserId
  const canAct = !archived && !message.deletedAt && !message.temporary
  const canReact = canAct && !editing
  const deliveryLabel = message.delivery === "sending" ? "Queued for delivery" : message.delivery === "failed" ? "Delivery failed" : null

  async function submitEdit(event: FormEvent) {
    event.preventDefault()
    const parsed = validateMessageContent(editValue)
    if (!parsed.success) {
      setEditError(parsed.message)
      return
    }
    setSaving(true)
    setEditError("")
    try {
      await onEdit(message, parsed.content)
      setEditing(false)
    } catch (caught) {
      setEditError(messageError(caught, "Message could not be edited."))
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className={cn("group relative flex gap-3 px-4 transition-colors duration-150 hover:bg-signal-surface/55 focus-within:bg-signal-surface/55 sm:px-7", grouped ? "py-0.5" : "pb-1.5 pt-3.5", message.delivery === "failed" && "bg-destructive/5")}>
        {grouped ? <time className="text-metadata mt-1.5 w-8 shrink-0 text-center text-signal-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100" dateTime={message.createdAt}>{timeFormatter.format(new Date(message.createdAt))}</time> : <Avatar className="mt-0.5 size-8 rounded-lg">
        {mediaUrl(message.author.image) && <AvatarImage alt="" className="rounded-lg" src={mediaUrl(message.author.image)!} />}
        <AvatarFallback className="text-metadata rounded-lg bg-signal-surface-raised font-semibold text-signal-muted">{initials(message.author.name)}</AvatarFallback>
      </Avatar>}
      <div className="min-w-0 flex-1">
        {!grouped && <div className="flex min-w-0 items-baseline gap-2 pr-8">
          <span className="truncate text-[13px] font-semibold leading-5">{message.author.name}</span>
          <time className="text-metadata shrink-0 text-signal-muted" dateTime={message.createdAt}>{timeFormatter.format(new Date(message.createdAt))}</time>
          {message.editedAt && !message.deletedAt && <span className="text-metadata text-signal-muted">edited</span>}
          {deliveryLabel && <span className={cn("text-metadata rounded-full border px-1.5 py-0.5", message.delivery === "failed" ? "border-destructive/30 text-destructive" : "border-signal-cyan/30 text-signal-cyan-ink")}>{deliveryLabel}</span>}
        </div>}
        <ReplyPreview message={message} />
        {editing ? (
          <form className="mt-1 max-w-[72ch]" onSubmit={submitEdit}>
            <Textarea aria-label={`Edit message from ${message.author.name}`} autoFocus className="min-h-20 resize-y bg-signal-surface text-xs leading-5" disabled={saving} maxLength={8_000} onChange={(event) => setEditValue(event.target.value)} value={editValue} />
            {editError && <p className="text-helper mt-1 text-destructive" role="alert">{editError}</p>}
            <div className="mt-2 flex items-center gap-2">
              <Button disabled={saving} size="sm" type="submit">{saving ? "Saving..." : "Save"}</Button>
              <Button onClick={() => { setEditing(false); setEditValue(message.content); setEditError("") }} size="sm" type="button" variant="ghost">Cancel</Button>
            </div>
          </form>
        ) : message.deletedAt ? (
          <p className="text-body max-w-[72ch] italic text-signal-muted">This message was deleted.</p>
        ) : (
          <p className="text-body max-w-[72ch] whitespace-pre-wrap break-words">{message.content}</p>
        )}
        {message.attachments.length > 0 && !message.deletedAt && <AttachmentGroup className="mt-2 max-w-[40rem] gap-2 py-0" aria-label="Message attachments">{message.attachments.map((attachment) => <MessageAttachmentCard attachment={attachment} key={attachment.id} />)}</AttachmentGroup>}
        {message.delivery === "failed" && !archived && (
          <div className="text-helper mt-1.5 flex flex-wrap items-center gap-2 text-destructive" role="alert">
            <AlertCircle className="size-3" />
            <span>{message.failureMessage || "Message was not sent."}</span>
            <Button onClick={() => onRetry(message)} size="xs" type="button" variant="outline"><RotateCcw /> Retry</Button>
          </div>
        )}
        {message.reactions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Message reactions">
            {message.reactions.map((reaction) => (
              <button
                aria-label={`${reaction.reactedByMe ? "Remove" : "Add"} ${reaction.emoji} reaction, ${reaction.count} ${reaction.count === 1 ? "reaction" : "reactions"}`}
                aria-pressed={reaction.reactedByMe}
                className={cn("text-helper inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan/30", reaction.reactedByMe ? "border-signal-cyan/40 bg-signal-cyan/10 text-signal-cyan-ink" : "border-signal-line bg-signal-surface text-signal-muted hover:border-signal-muted hover:bg-signal-surface-raised/60 hover:text-signal-ink")}
                disabled={!canReact}
                key={reaction.emoji}
                onClick={() => onReact(message, reaction.emoji)}
                type="button"
              >
                <span className="text-sm leading-none" aria-hidden="true">{reaction.emoji}</span>
                <span className="text-metadata">{reaction.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {canAct && <div aria-label={`Actions for message from ${message.author.name}`} className="absolute -top-4 right-3 z-10 flex items-center gap-0.5 rounded-md border border-signal-line bg-signal-paper p-1 shadow-sm opacity-100 transition-opacity duration-150 sm:pointer-events-none sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100" role="toolbar">
        {canReact && <div className="hidden items-center gap-0.5 sm:flex">{QUICK_REACTIONS.map((emoji) => <button aria-label={`React with ${emoji}`} className="grid size-8 place-items-center rounded-md text-sm leading-none transition-colors duration-150 hover:bg-signal-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-cyan/30" key={emoji} onClick={() => onReact(message, emoji)} type="button">{emoji}</button>)}</div>}
        <Button aria-label="Reply to message" className="hidden sm:inline-flex" onClick={() => onReply(message)} size="icon" type="button" variant="ghost"><CornerUpLeft /></Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button aria-label={`More actions for message from ${message.author.name}`} size="icon" type="button" variant="ghost" />}><MoreHorizontal /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => onReply(message)}><CornerUpLeft /> Reply</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onReact(message, "👍")}><SmilePlus /> React 👍</DropdownMenuItem>
            {ownMessage && <DropdownMenuSeparator />}
            {ownMessage && <DropdownMenuItem onClick={() => setEditing(true)}><Pencil /> Edit</DropdownMenuItem>}
            {ownMessage && <DropdownMenuItem onClick={() => void onDelete(message)} variant="destructive"><Trash2 /> Delete</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>}
    </article>
  )
}

type ConversationTarget =
  | { type: "channel"; channel: ChannelDTO }
  | { type: "dm"; conversation: DirectConversationDTO }

export function ChannelMessages({ onActivity, onAddDescription, onInvitePeople, onPresence, onReadState, target, user }: { onActivity?: (conversation: { type: "channel" | "dm"; id: string }, message: MessageDTO) => void; onAddDescription?: () => void; onInvitePeople?: () => void; onPresence?: (userId: string, status: "online" | "offline") => void; onReadState?: (readState: ConversationReadStateDTO) => void; target: ConversationTarget; user: AuthUserDTO }) {
  const [historyState, setHistoryState] = useState<HistoryState>("loading")
  const [messages, setMessages] = useState<ClientMessage[]>([])
  const [historyError, setHistoryError] = useState("")
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [draft, setDraft] = useState("")
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachmentDTO[]>([])
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [composerError, setComposerError] = useState("")
  const [replyingTo, setReplyingTo] = useState<MessageDTO | null>(null)
  const [socketState, setSocketState] = useState<SocketState>("connecting")
  const [typingUsers, setTypingUsers] = useState<TypingUpdateEvent["user"][]>([])
  const [lastReadMessageId, setLastReadMessageId] = useState(target.type === "channel" ? target.channel.lastReadMessageId : target.conversation.lastReadMessageId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<RelaySocket | null>(null)
  const pendingTimeouts = useRef(new Map<string, number>())
  const shouldScrollToBottom = useRef(true)
  const olderScrollHeight = useRef<number | null>(null)
  const initialRequest = useRef(0)
  const typingStopTimeout = useRef<number | null>(null)
  const lastTypingStart = useRef(0)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const syncCursor = useRef<string | null>(null)
  const syncRequest = useRef<Promise<void> | null>(null)
  const syncTimeout = useRef<number | null>(null)
  const archived = target.type === "channel" && Boolean(target.channel.archivedAt)
  const conversationId = target.type === "channel" ? target.channel.id : target.conversation.id
  const workspaceId = target.type === "channel" ? target.channel.workspaceId : target.conversation.workspaceId
  const title = target.type === "channel" ? `#${target.channel.name}` : target.conversation.otherUser.name
  const connectionCopy = socketState === "connected" ? "Signal clear" : socketState === "connecting" ? "Reconnecting" : "Offline"
  const historyPath = target.type === "channel" ? `/channels/${conversationId}/messages` : `/direct-conversations/${conversationId}/messages`
  const readPath = target.type === "channel" ? `/channels/${conversationId}/read` : `/direct-conversations/${conversationId}/read`
  const draftCodePoints = Array.from(draft.trim()).length
  const reportActivity = useEffectEvent((message: MessageDTO) => onActivity?.({ type: target.type, id: conversationId }, message))
  const reportReadState = useEffectEvent((readState: ConversationReadStateDTO) => onReadState?.(readState))
  const reportPresence = useEffectEvent((userId: string, status: "online" | "offline") => onPresence?.(userId, status))

  const applySyncEvent = useCallback((event: WorkspaceSyncEvent) => {
    if (event.type === "message:new" || event.type === "message:update" || event.type === "message:delete") {
      const message = event.data.message
      const belongsHere = target.type === "channel" ? message.channelId === conversationId : message.directConversationId === conversationId
      if (!belongsHere) return
      setMessages((current) => event.type === "message:new" ? mergeMessages(current, [message]) : reconcileMessageUpdate(current, message))
      if (event.type === "message:new") onActivity?.({ type: target.type, id: conversationId }, message)
      return
    }
    if (event.type === "reaction:update") {
      setMessages((current) => current.map((message) => message.id === event.data.messageId ? { ...message, reactions: event.data.reactions } : message))
      return
    }
    if (event.type !== "conversation:read:update") return
    const readState = event.data.readState
    if (readState.conversation.type !== target.type || readState.conversation.id !== conversationId) return
    if (readState.userId === user.id) setLastReadMessageId(readState.lastReadMessageId)
    onReadState?.(readState)
  }, [conversationId, onActivity, onReadState, target.type, user.id])

  const synchronizeWorkspace = useCallback(async () => {
    if (syncRequest.current) return syncRequest.current
    const request = (async () => {
      const storageKey = `relay:sync:${workspaceId}`
      let cursor = syncCursor.current ?? window.localStorage.getItem(storageKey)
      if (!cursor) {
        const checkpoint = await apiRequest<WorkspaceSyncResponse>(`/workspaces/${workspaceId}/sync`)
        cursor = checkpoint.nextCursor
        syncCursor.current = cursor
        window.localStorage.setItem(storageKey, cursor)
        return
      }
      let certifiedCursor: string = cursor
      let hasMore = true
      while (hasMore) {
        const response: WorkspaceSyncResponse = await apiRequest<WorkspaceSyncResponse>(`/workspaces/${workspaceId}/sync?after=${encodeURIComponent(certifiedCursor)}&limit=200`)
        for (const event of response.events) applySyncEvent(event)
        certifiedCursor = response.nextCursor
        syncCursor.current = certifiedCursor
        window.localStorage.setItem(storageKey, certifiedCursor)
        hasMore = response.hasMore
      }
    })().finally(() => { syncRequest.current = null })
    syncRequest.current = request
    return request
  }, [applySyncEvent, workspaceId])

  const scheduleSynchronization = useCallback(() => {
    if (syncTimeout.current) window.clearTimeout(syncTimeout.current)
    syncTimeout.current = window.setTimeout(() => {
      syncTimeout.current = null
      void synchronizeWorkspace().catch(() => undefined)
    }, 250)
  }, [synchronizeWorkspace])

  async function loadInitial() {
    const request = ++initialRequest.current
    setHistoryState("loading")
    setHistoryError("")
    try {
      await synchronizeWorkspace()
      const response = await apiRequest<MessageHistoryResponse>(`${historyPath}?limit=50`)
      if (request !== initialRequest.current) return
      setMessages((current) => mergeMessages(response.messages, current.filter((message) => target.type === "channel" ? message.channelId === conversationId : message.directConversationId === conversationId)))
      setNextCursor(response.nextCursor)
      setHasMore(response.hasMore)
      shouldScrollToBottom.current = true
      setHistoryState("ready")
    } catch (caught) {
      if (request !== initialRequest.current) return
      setHistoryError(messageError(caught, "Message history could not be loaded."))
      setHistoryState("error")
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadInitial(), 0)
    return () => {
      window.clearTimeout(timeout)
      initialRequest.current += 1
    }
    // The pane is keyed by channel in the shell, but the guard also makes prop changes safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId])

  useEffect(() => {
    if (archived) return
    const socket = createRelaySocket()
    const joinEvent = { workspaceId, conversation: { type: target.type, id: conversationId } as const }
    const pending = pendingTimeouts.current
    socketRef.current = socket

    function joinChannel() {
      setSocketState("connected")
      socket.emit("conversation:join", joinEvent, (event) => {
        if ("ok" in event) {
          void synchronizeWorkspace().catch(() => undefined)
          return
        }
        setComposerError(event.message)
      })
    }

    socket.on("connect", joinChannel)
    socket.on("disconnect", () => setSocketState("disconnected"))
    socket.on("connect_error", () => setSocketState("disconnected"))
    socket.on("message:ack", (event) => {
      window.clearTimeout(pending.get(event.operationId))
      pending.delete(event.operationId)
      shouldScrollToBottom.current = true
      setMessages((current) => replaceMessage(current, event.message))
      reportActivity(event.message)
      scheduleSynchronization()
    })
    socket.on("message:new", (event) => {
      if (target.type === "channel" ? event.message.channelId !== conversationId : event.message.directConversationId !== conversationId) return
      shouldScrollToBottom.current = true
      setMessages((current) => mergeMessages(current, [event.message]))
      reportActivity(event.message)
      scheduleSynchronization()
    })
    socket.on("message:update", (event) => {
      if (target.type === "channel" ? event.message.channelId !== conversationId : event.message.directConversationId !== conversationId) return
      setMessages((current) => reconcileMessageUpdate(current, event.message))
      scheduleSynchronization()
    })
    socket.on("message:delete", (event) => {
      if (target.type === "channel" ? event.message.channelId !== conversationId : event.message.directConversationId !== conversationId) return
      setMessages((current) => reconcileMessageUpdate(current, event.message))
      scheduleSynchronization()
    })
    socket.on("reaction:update", (event) => {
      if (event.conversation.type !== target.type || event.conversation.id !== conversationId) return
      setMessages((current) => current.map((message) => message.id === event.messageId ? { ...message, reactions: event.reactions } : message))
      scheduleSynchronization()
    })
    socket.on("conversation:read:update", (event) => {
      if (event.readState.conversation.type !== target.type || event.readState.conversation.id !== conversationId) return
      if (event.readState.userId === user.id) setLastReadMessageId(event.readState.lastReadMessageId)
      reportReadState(event.readState)
      scheduleSynchronization()
    })
    socket.on("presence:update", (event) => reportPresence(event.userId, event.status))
    socket.on("typing:update", (event) => {
      if (event.conversation.type !== target.type || event.conversation.id !== conversationId || event.user.id === user.id) return
      setTypingUsers((current) => event.typing
        ? [...current.filter((item) => item.id !== event.user.id), event.user]
        : current.filter((item) => item.id !== event.user.id))
    })
    socket.on("message:error", (event) => {
      if (!event.operationId) {
        setComposerError(event.message)
        return
      }
      window.clearTimeout(pending.get(event.operationId))
      pending.delete(event.operationId)
      setMessages((current) => current.map((message) => message.operationId === event.operationId ? {
        ...message,
        delivery: "failed",
        failureMessage: event.message,
      } : message))
    })

    if (socket.connected) joinChannel()
    return () => {
      socket.emit("conversation:leave", joinEvent)
      socket.emit("typing:stop", joinEvent)
      if (typingStopTimeout.current) window.clearTimeout(typingStopTimeout.current)
      if (syncTimeout.current) window.clearTimeout(syncTimeout.current)
      pending.forEach((timeout) => window.clearTimeout(timeout))
      pending.clear()
      socket.disconnect()
      socketRef.current = null
    }
  }, [archived, conversationId, scheduleSynchronization, synchronizeWorkspace, workspaceId, target.type, user.id])

  useEffect(() => {
    if (historyState !== "ready" || messages.length === 0) return
    const latest = messages.filter((message) => !message.temporary).at(-1)
    if (!latest || latest.id === lastReadMessageId) return
    if (socketRef.current?.connected && !archived) {
      socketRef.current.emit("conversation:read", { workspaceId, conversation: { type: target.type, id: conversationId }, messageId: latest.id })
      return
    }
    void apiRequest<{ readState: ConversationReadStateDTO }>(readPath, {
      method: "POST",
      body: JSON.stringify({ messageId: latest.id }),
    }).then(({ readState }) => {
      setLastReadMessageId(readState.lastReadMessageId)
      reportReadState(readState)
    }).catch(() => undefined)
  }, [archived, conversationId, historyState, lastReadMessageId, messages, readPath, target.type, workspaceId])

  useLayoutEffect(() => {
    const viewport = scrollRef.current
    if (!viewport || historyState !== "ready") return
    if (olderScrollHeight.current !== null) {
      viewport.scrollTop += viewport.scrollHeight - olderScrollHeight.current
      olderScrollHeight.current = null
    } else if (shouldScrollToBottom.current) {
      viewport.scrollTop = viewport.scrollHeight
      shouldScrollToBottom.current = false
    }
  }, [historyState, messages])

  async function loadOlder() {
    if (!nextCursor || loadingOlder) return
    setLoadingOlder(true)
    setHistoryError("")
    try {
      const response = await apiRequest<MessageHistoryResponse>(`${historyPath}?cursor=${encodeURIComponent(nextCursor)}&limit=50`)
      const viewport = scrollRef.current
      if (viewport) olderScrollHeight.current = viewport.scrollHeight
      setMessages((current) => mergeMessages(current, response.messages))
      setNextCursor(response.nextCursor)
      setHasMore(response.hasMore)
    } catch (caught) {
      olderScrollHeight.current = null
      setHistoryError(messageError(caught, "Older messages could not be loaded."))
    } finally {
      setLoadingOlder(false)
    }
  }

  function sendMessage(clientMessage: ClientMessage) {
    if (archived) return
    setMessages((current) => current.map((message) => message.operationId === clientMessage.operationId ? { ...message, delivery: "sending", failureMessage: undefined } : message))
    const socket = socketRef.current
    if (!socket?.connected) {
      setMessages((current) => current.map((message) => message.operationId === clientMessage.operationId ? {
        ...message,
        delivery: "failed",
        failureMessage: "Connection is offline. Retry when reconnected.",
      } : message))
      return
    }
    window.clearTimeout(pendingTimeouts.current.get(clientMessage.operationId))
    pendingTimeouts.current.set(clientMessage.operationId, window.setTimeout(() => {
      pendingTimeouts.current.delete(clientMessage.operationId)
      setMessages((current) => current.map((message) => message.operationId === clientMessage.operationId ? {
        ...message,
        delivery: "failed",
        failureMessage: "No acknowledgement received. Retry to check the saved message.",
      } : message))
    }, ACK_TIMEOUT_MS))
    socket.emit("message:send", {
      operationId: clientMessage.operationId,
      workspaceId,
      conversation: { type: target.type, id: conversationId },
      content: clientMessage.content,
      ...(clientMessage.parentMessageId ? { parentMessageId: clientMessage.parentMessageId } : {}),
      ...(clientMessage.attachments.length > 0 ? { attachmentIds: clientMessage.attachments.map((attachment) => attachment.id) } : {}),
    })
  }

  function submitMessage() {
    if (archived) return
    const parsed = draft.trim() || pendingAttachments.length === 0
      ? validateMessageContent(draft)
      : { success: true as const, content: "", codePoints: 0 }
    if (!parsed.success) {
      setComposerError(parsed.message)
      return
    }
    const operationId = crypto.randomUUID()
    const temporaryId = `temporary:${crypto.randomUUID()}`
    const optimistic = createOptimisticMessage({
      channelId: target.type === "channel" ? conversationId : null,
      directConversationId: target.type === "dm" ? conversationId : null,
      content: parsed.content,
      operationId,
      parent: replyingTo,
      temporaryId,
      user,
      workspaceId,
    })
    optimistic.attachments = pendingAttachments.map((attachment) => ({
      id: attachment.id,
      originalFilename: attachment.originalFilename,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      downloadUrl: `/attachments/${attachment.id}/download`,
      createdAt: attachment.createdAt,
    }))
    setMessages((current) => mergeMessages(current, [optimistic]))
    setDraft("")
    setPendingAttachments([])
    setReplyingTo(null)
    setComposerError("")
    socketRef.current?.emit("typing:stop", { workspaceId, conversation: { type: target.type, id: conversationId } })
    shouldScrollToBottom.current = true
    sendMessage(optimistic)
  }

  async function uploadAttachments(files: File[]) {
    if (files.length === 0) return
    if (pendingAttachments.length + files.length > MAX_ATTACHMENT_COUNT) {
      setComposerError(`A message can include at most ${MAX_ATTACHMENT_COUNT} attachments.`)
      return
    }
    const oversizedFile = files.find((file) => file.size > MAX_FILE_BYTES)
    if (oversizedFile) {
      setComposerError(`${oversizedFile.name} exceeds the 25 MB file limit.`)
      return
    }
    const combinedBytes = pendingAttachments.reduce((total, attachment) => total + attachment.sizeBytes, 0) + files.reduce((total, file) => total + file.size, 0)
    if (combinedBytes > MAX_ATTACHMENT_BYTES) {
      setComposerError("Attachments can total at most 50 MB per message.")
      return
    }
    setUploadingAttachment(true)
    setComposerError("")
    try {
      for (const [index, file] of files.entries()) {
        setUploadProgress({ current: index + 1, total: files.length })
        const form = new FormData()
        form.set("workspaceId", workspaceId)
        form.set("file", file)
        const response = await apiRequest<{ attachment: PendingAttachmentDTO }>("/attachments", { method: "POST", body: form })
        setPendingAttachments((current) => [...current, response.attachment])
      }
    } catch (caught) {
      setComposerError(messageError(caught, "File could not be uploaded."))
    } finally {
      setUploadingAttachment(false)
      setUploadProgress(null)
    }
  }

  function insertComposerText(value: string, cursorOffset = value.length) {
    const composer = composerRef.current
    const start = composer?.selectionStart ?? draft.length
    const end = composer?.selectionEnd ?? start
    setDraft((current) => `${current.slice(0, start)}${value}${current.slice(end)}`)
    window.requestAnimationFrame(() => {
      composerRef.current?.focus()
      composerRef.current?.setSelectionRange(start + cursorOffset, start + cursorOffset)
    })
  }

  function insertEmoji(emoji: string) {
    insertComposerText(emoji)
    setEmojiPickerOpen(false)
  }

  function insertMentionTrigger() {
    const composer = composerRef.current
    const start = composer?.selectionStart ?? draft.length
    const end = composer?.selectionEnd ?? start
    const before = draft.slice(0, start)
    const after = draft.slice(end)
    const prefix = before.length > 0 && !/\s$/.test(before) ? " " : ""
    const suffix = after.length > 0 && !/^\s/.test(after) ? " " : ""
    insertComposerText(`${prefix}@${suffix}`, prefix.length + 1)
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submitMessage()
    }
  }

  function emitTypingStart() {
    if (archived) return
    const socket = socketRef.current
    if (!socket?.connected) return
    const now = Date.now()
    if (now - lastTypingStart.current >= TYPING_REFRESH_MS) {
      socket.emit("typing:start", { workspaceId, conversation: { type: target.type, id: conversationId } })
      lastTypingStart.current = now
    }
    if (typingStopTimeout.current) window.clearTimeout(typingStopTimeout.current)
    typingStopTimeout.current = window.setTimeout(() => {
      socket.emit("typing:stop", { workspaceId, conversation: { type: target.type, id: conversationId } })
      typingStopTimeout.current = null
    }, TYPING_INACTIVITY_MS)
  }

  async function editMessage(message: ClientMessage, content: string) {
    if (archived) return
    const response = await apiRequest<{ message: MessageDTO }>(`/messages/${message.id}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    })
    setMessages((current) => reconcileMessageUpdate(current, response.message))
    setReplyingTo((current) => current?.id === response.message.id ? response.message : current)
  }

  async function deleteMessage(message: ClientMessage) {
    if (archived) return
    if (!window.confirm("Delete this message? The reply context will remain as a tombstone.")) return
    try {
      const response = await apiRequest<{ message: MessageDTO }>(`/messages/${message.id}`, { method: "DELETE" })
      setMessages((current) => reconcileMessageUpdate(current, response.message))
      if (replyingTo?.id === message.id) setReplyingTo(null)
    } catch (caught) {
      setHistoryError(messageError(caught, "Message could not be deleted."))
    }
  }

  async function reactToMessage(message: ClientMessage, emoji: string) {
    if (archived || message.temporary || message.deletedAt) return
    const socket = socketRef.current
    if (socket?.connected) {
      socket.emit("reaction:toggle", { workspaceId, messageId: message.id, emoji })
      return
    }
    try {
      const response = await apiRequest<{ messageId: string; reactions: ReactionSummaryDTO[] }>(`/messages/${message.id}/reactions`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      })
      setMessages((current) => current.map((item) => item.id === response.messageId ? { ...item, reactions: response.reactions } : item))
    } catch (caught) {
      setHistoryError(messageError(caught, "Reaction could not be saved."))
    }
  }

  function isFirstUnread(message: ClientMessage, index: number) {
    if (!lastReadMessageId) return index === 0 && message.author.id !== user.id
    const readIndex = messages.findIndex((item) => item.id === lastReadMessageId)
    return readIndex >= 0 && index === readIndex + 1
  }

  return (
    <section className="flex max-h-full min-h-0 flex-1 flex-col overflow-hidden bg-background" aria-label={`Messages in ${title}`}>
      <div className="min-h-0 flex-1 overflow-y-auto bg-background" ref={scrollRef}>
        {historyState === "loading" && (
          <div className="grid min-h-full place-items-center p-6" role="status">
            <div className="w-full max-w-xl space-y-3" aria-label="Loading message history">
              {[0, 1, 2].map((item) => (
                <div className="flex animate-pulse gap-3" key={item}>
                  <div className="size-8 rounded-lg bg-signal-surface-raised" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-32 rounded bg-signal-surface-raised" />
                    <div className="h-3 max-w-[72ch] rounded bg-signal-surface" />
                    <div className="h-3 w-2/3 rounded bg-signal-surface" />
                  </div>
                </div>
              ))}
              <p className="text-center text-xs text-signal-muted">Opening the newest saved history.</p>
            </div>
          </div>
        )}
        {historyState === "error" && (
          <div className="grid min-h-full place-items-center p-6">
            <div className="max-w-sm text-center"><AlertCircle className="mx-auto size-5 text-destructive" /><h2 className="mt-3 text-sm font-semibold">Messages could not be loaded</h2><p className="mt-1 text-xs leading-5 text-signal-muted">{historyError}</p><Button className="mt-4" onClick={() => void loadInitial()} size="sm" variant="outline">Try again</Button></div>
          </div>
        )}
        {historyState === "ready" && (
          <div className="mx-auto w-full max-w-6xl py-3" role="log" aria-label={`Message history for ${title}`}>
            {hasMore && <div className="flex justify-center px-5 pb-3"><Button disabled={loadingOlder} onClick={() => void loadOlder()} size="sm" variant="outline">{loadingOlder ? "Loading..." : "Load older messages"}</Button></div>}
            {historyError && <p className="mx-5 mb-3 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert">{historyError}</p>}
            {messages.length === 0 ? (
              <div className="flex min-h-[420px] items-center px-4 py-14 sm:px-7">
                <div className="w-full max-w-xl border-y border-signal-line py-8">
                  <span className="grid size-10 place-items-center rounded-lg border border-signal-line bg-signal-surface text-signal-amber"><MessageSquareText className="size-5" /></span>
                  <h2 className="mt-5 text-lg font-semibold tracking-[-0.02em]">{target.type === "channel" ? `Welcome to #${target.channel.name}` : `Start a conversation with ${target.conversation.otherUser.name}`}</h2>
                  <p className="mt-2 max-w-[62ch] text-sm leading-6 text-signal-muted">{target.type === "channel" ? target.channel.description || "This is the beginning of the channel. Share an update, ask a question, or bring the team into the conversation." : "Messages are private to this conversation and recover safely after reconnect."}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button onClick={() => composerRef.current?.focus()} size="sm" type="button"><MessageSquareText /> Start a conversation</Button>
                    {target.type === "channel" && onAddDescription && !target.channel.description && <Button onClick={onAddDescription} size="sm" type="button" variant="outline"><Pencil /> Add description</Button>}
                    {target.type === "channel" && onInvitePeople && <Button onClick={onInvitePeople} size="sm" type="button" variant="ghost"><UserPlus /> Invite people</Button>}
                  </div>
                  <p className="text-helper mt-5 flex items-center gap-2 text-signal-muted"><span className="size-1.5 rounded-full bg-signal-cyan" /> Messages are saved and recover after reconnect.</p>
                </div>
              </div>
            ) : messages.map((message, index) => {
              const previous = messages[index - 1]
              const unread = isFirstUnread(message, index)
              const messageDate = new Date(message.createdAt)
              const previousDate = previous ? new Date(previous.createdAt) : null
              const startsDay = !previousDate || messageDate.toDateString() !== previousDate.toDateString()
              const grouped = !unread && !startsDay && message.delivery !== "sending" && message.delivery !== "failed" && !message.editedAt && Boolean(previous && previousDate && previous.author.id === message.author.id && messageDate.getTime() - previousDate.getTime() < 5 * 60_000)
              return <div key={`${message.id}:${archived}`}>
                {startsDay && <div className="my-4 flex items-center gap-3 px-5" role="separator" aria-label={dateFormatter.format(messageDate)}><span className="h-px flex-1 bg-signal-line" /><time className="text-metadata rounded-full border border-signal-line bg-signal-paper px-2.5 py-1 font-medium text-signal-muted" dateTime={message.createdAt}>{dateFormatter.format(messageDate)}</time><span className="h-px flex-1 bg-signal-line" /></div>}
                {unread && <div className="text-metadata my-3 flex items-center gap-3 px-5 font-semibold uppercase tracking-[0.16em] text-signal-amber"><span className="h-px flex-1 bg-signal-amber/35" />New messages<span className="h-px flex-1 bg-signal-amber/35" /></div>}
                <MessageRow archived={archived} currentUserId={user.id} grouped={grouped} message={message} onDelete={deleteMessage} onEdit={editMessage} onReact={reactToMessage} onReply={(selected) => setReplyingTo(selected)} onRetry={sendMessage} />
              </div>
            })}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-signal-line bg-background px-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5 sm:px-5 sm:pb-3">
        {archived ? (
          <div className="mx-auto max-w-6xl rounded-md border border-signal-line bg-signal-surface px-3 py-2.5 text-xs text-signal-muted"><span className="font-semibold text-signal-ink">Read-only archive.</span> This channel history remains available, but messages, replies, reactions, and attachments are closed.</div>
        ) : (
          <div className="mx-auto max-w-6xl">
            {replyingTo && (
              <div className="text-helper flex items-center gap-2 rounded-t-lg border border-b-0 border-signal-line bg-signal-surface px-3 py-1.5">
                <CornerUpLeft className="size-3 text-signal-muted" />
                <p className="min-w-0 flex-1 truncate"><span className="font-semibold">Replying to {replyingTo.author.name}</span><span className="text-signal-muted"> · {replyingTo.deletedAt ? "Message deleted" : replyingTo.content}</span></p>
                <Button aria-label="Cancel reply" onClick={() => setReplyingTo(null)} size="icon-xs" type="button" variant="ghost"><X /></Button>
              </div>
            )}
            <div className={cn("overflow-hidden rounded-lg border border-signal-line bg-signal-surface transition-colors duration-150 focus-within:border-signal-muted", replyingTo && "rounded-t-none")}>
              {typingUsers.length > 0 && <p className="text-helper border-b border-signal-line px-3 py-1 text-signal-muted" aria-live="polite"><span className="mr-1 inline-flex gap-0.5 align-middle"><span className="size-1 rounded-full bg-signal-cyan" /><span className="size-1 rounded-full bg-signal-cyan" /><span className="size-1 rounded-full bg-signal-cyan" /></span>{typingUsers.map((item) => item.name).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing</p>}
              <Textarea
                ref={composerRef}
                aria-label={`Message ${title}`}
                aria-describedby={composerError ? "composer-error" : undefined}
                aria-invalid={Boolean(composerError) || draftCodePoints > MESSAGE_CODE_POINT_LIMIT}
                className="min-h-11 max-h-40 resize-none overflow-y-auto rounded-none border-0 bg-transparent px-3 py-2.5 text-sm font-normal leading-5 shadow-none transition-none placeholder:text-signal-muted focus-visible:border-0 focus-visible:ring-0"
                onBlur={() => socketRef.current?.emit("typing:stop", { workspaceId, conversation: { type: target.type, id: conversationId } })}
                onChange={(event) => { setDraft(event.target.value); if (composerError) setComposerError(""); emitTypingStart() }}
                onKeyDown={handleComposerKeyDown}
                placeholder={`Message ${title}`}
                value={draft}
              />
              {(pendingAttachments.length > 0 || uploadingAttachment) && (
                <AttachmentGroup className="border-t border-signal-line px-3 py-2" aria-label="Pending attachments">
                  {pendingAttachments.map((attachment) => <PendingAttachmentCard attachment={attachment} key={attachment.id} onRemove={() => setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id))} />)}
                  {uploadProgress && <Attachment className="border-dashed border-signal-line bg-transparent text-signal-muted" size="sm" state="uploading" role="status"><AttachmentMedia className="bg-transparent"><LoaderCircle className="size-3.5 animate-spin" /></AttachmentMedia><AttachmentContent><AttachmentTitle>Uploading attachment</AttachmentTitle><AttachmentDescription className="text-metadata text-signal-muted">{uploadProgress.current} of {uploadProgress.total}</AttachmentDescription></AttachmentContent></Attachment>}
                </AttachmentGroup>
              )}
              <div className="flex min-h-9 items-center justify-between gap-2 border-t border-signal-line px-2 py-1">
                <div className="flex shrink-0 items-center gap-0.5">
                  <label aria-label="Attach a file" className={cn("inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-signal-muted transition-colors duration-150 hover:bg-signal-surface-raised hover:text-signal-ink focus-within:outline-none focus-within:ring-2 focus-within:ring-signal-muted/35", uploadingAttachment && "pointer-events-none opacity-50")}>
                    <Paperclip className="size-3.5" />
                    <input accept={ATTACHMENT_ACCEPT} className="sr-only" disabled={uploadingAttachment || pendingAttachments.length >= MAX_ATTACHMENT_COUNT} multiple onChange={(event) => { void uploadAttachments(Array.from(event.target.files ?? [])); event.currentTarget.value = "" }} type="file" />
                  </label>
                  <Popover onOpenChange={setEmojiPickerOpen} open={emojiPickerOpen}>
                    <PopoverTrigger render={<Button aria-label="Add emoji" className="text-signal-muted hover:text-signal-ink data-[popup-open]:bg-signal-surface-raised data-[popup-open]:text-signal-ink [&_svg]:size-3.5" size="icon-sm" type="button" variant="ghost" />}><Smile /></PopoverTrigger>
                    <PopoverContent align="start" className="max-h-[min(22rem,60dvh)] w-[min(20rem,calc(100vw-1.5rem))] gap-3 overflow-y-auto border border-signal-line bg-signal-paper p-2.5 shadow-md ring-0" side="top" sideOffset={8}>
                      <PopoverTitle className="text-xs font-semibold">Choose an emoji</PopoverTitle>
                      {EMOJI_GROUPS.map((group) => (
                        <div key={group.label}>
                          <p className="text-metadata mb-1.5 text-signal-muted">{group.label}</p>
                          <div className="grid grid-cols-8 gap-0.5">
                            {group.emojis.map(([emoji, label]) => <button aria-label={label} className="grid aspect-square min-h-8 place-items-center rounded-md text-lg leading-none transition-colors duration-150 hover:bg-signal-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-muted/40" key={emoji} onClick={() => insertEmoji(emoji)} title={label} type="button">{emoji}</button>)}
                          </div>
                        </div>
                      ))}
                    </PopoverContent>
                  </Popover>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger render={<Button aria-label="Mention someone, coming soon" className="text-signal-muted hover:text-signal-ink [&_svg]:size-3.5" onClick={insertMentionTrigger} size="icon-sm" type="button" variant="ghost" />}><AtSign /></TooltipTrigger>
                      <TooltipContent side="top">Mentions coming soon</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn("text-metadata tabular-nums text-signal-muted opacity-60 transition-colors duration-150", draftCodePoints > MESSAGE_CODE_POINT_LIMIT && "text-destructive opacity-100")}>{draftCodePoints}/{MESSAGE_CODE_POINT_LIMIT}</span>
                  <span className="h-3.5 w-px shrink-0 bg-signal-line" />
                  <span className="text-metadata inline-flex min-w-0 items-center gap-1 text-signal-muted" aria-live="polite"><span className={cn("size-1 shrink-0 rounded-full", socketState === "connected" ? "bg-signal-cyan" : socketState === "connecting" ? "bg-signal-amber" : "bg-destructive")} /><span className="truncate">{connectionCopy}</span></span>
                  <Button aria-label="Send message" className="ml-0.5 size-8 bg-signal-amber text-signal-carbon transition-colors duration-150 hover:bg-signal-amber/85 focus-visible:border-signal-amber focus-visible:ring-signal-amber/25 [&_svg]:size-3.5" disabled={(!draft.trim() && pendingAttachments.length === 0) || draftCodePoints > MESSAGE_CODE_POINT_LIMIT || uploadingAttachment} onClick={submitMessage} size="icon-sm" type="button"><Send /></Button>
                </div>
              </div>
            </div>
            {composerError && <p className="text-helper mt-1.5 text-destructive" id="composer-error" role="alert">{composerError}</p>}
          </div>
        )}
      </div>
    </section>
  )
}
