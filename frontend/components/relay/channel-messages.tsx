"use client"

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { AlertCircle, CornerUpLeft, MoreHorizontal, Pencil, RotateCcw, Send, Trash2, X } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { apiRequest } from "@/lib/api/client"
import type { AuthUserDTO, ChannelDTO, DirectConversationDTO, MessageDTO, MessageHistoryResponse, TypingUpdateEvent } from "@/lib/api/contracts"
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

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" })

function initials(value: string) {
  return value.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
}

function messageError(caught: unknown, fallback: string) {
  return caught instanceof Error ? caught.message : fallback
}

function ReplyPreview({ message }: { message: ClientMessage }) {
  if (!message.parent) return null
  return (
    <div className="mb-1 flex max-w-[72ch] items-start gap-2 border-l border-signal-line pl-2 text-[11px] leading-4 text-signal-muted">
      <CornerUpLeft className="mt-0.5 size-3 shrink-0" />
      <p className="min-w-0 truncate">
        <span className="font-semibold text-signal-ink/80">{message.parent.authorName}</span>{" "}
        {message.parent.deletedAt ? "Message deleted" : message.parent.content}
      </p>
    </div>
  )
}

function MessageRow({
  archived,
  currentUserId,
  message,
  onDelete,
  onEdit,
  onReply,
  onRetry,
}: {
  archived: boolean
  currentUserId: string
  message: ClientMessage
  onDelete: (message: ClientMessage) => Promise<void>
  onEdit: (message: ClientMessage, content: string) => Promise<void>
  onReply: (message: ClientMessage) => void
  onRetry: (message: ClientMessage) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(message.content)
  const [editError, setEditError] = useState("")
  const [saving, setSaving] = useState(false)
  const ownMessage = message.author.id === currentUserId
  const canAct = !archived && !message.deletedAt && !message.temporary

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
    <article className={cn("group relative flex gap-3 px-5 py-2.5 transition-colors hover:bg-signal-surface/60 focus-within:bg-signal-surface/60 sm:px-7", message.delivery === "failed" && "bg-destructive/5")}>
      <Avatar className="mt-0.5 size-8 rounded-lg">
        {message.author.image && <AvatarImage alt="" className="rounded-lg" src={message.author.image} />}
        <AvatarFallback className="rounded-lg bg-signal-surface-raised text-[9px] font-semibold text-signal-muted">{initials(message.author.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2 pr-8">
          <span className="truncate text-xs font-semibold">{message.author.name}</span>
          <time className="shrink-0 font-mono text-[9px] tabular-nums text-signal-muted" dateTime={message.createdAt}>{timeFormatter.format(new Date(message.createdAt))}</time>
          {message.editedAt && !message.deletedAt && <span className="text-[9px] text-signal-muted">edited</span>}
          {message.delivery === "sending" && <span className="text-[9px] text-signal-muted">Sending...</span>}
        </div>
        <ReplyPreview message={message} />
        {editing ? (
          <form className="mt-1 max-w-[72ch]" onSubmit={submitEdit}>
            <Textarea aria-label={`Edit message from ${message.author.name}`} autoFocus className="min-h-20 resize-y bg-signal-surface text-xs leading-5" disabled={saving} maxLength={8_000} onChange={(event) => setEditValue(event.target.value)} value={editValue} />
            {editError && <p className="mt-1 text-[11px] text-destructive" role="alert">{editError}</p>}
            <div className="mt-2 flex items-center gap-2">
              <Button disabled={saving} size="sm" type="submit">{saving ? "Saving..." : "Save"}</Button>
              <Button onClick={() => { setEditing(false); setEditValue(message.content); setEditError("") }} size="sm" type="button" variant="ghost">Cancel</Button>
            </div>
          </form>
        ) : message.deletedAt ? (
          <p className="max-w-[72ch] text-xs italic leading-5 text-signal-muted">This message was deleted.</p>
        ) : (
          <p className="max-w-[72ch] whitespace-pre-wrap break-words text-xs leading-5">{message.content}</p>
        )}
        {message.delivery === "failed" && !archived && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-destructive" role="alert">
            <AlertCircle className="size-3" />
            <span>{message.failureMessage || "Message was not sent."}</span>
            <Button className="h-6 px-2 text-[10px]" onClick={() => onRetry(message)} type="button" variant="outline"><RotateCcw /> Retry</Button>
          </div>
        )}
      </div>
      {canAct && (
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button aria-label={`Actions for message from ${message.author.name}`} className="absolute right-3 top-2 size-7 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100" size="icon-xs" type="button" variant="ghost" />}>
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36">
            <DropdownMenuItem onClick={() => onReply(message)}><CornerUpLeft /> Reply</DropdownMenuItem>
            {ownMessage && <DropdownMenuSeparator />}
            {ownMessage && <DropdownMenuItem onClick={() => setEditing(true)}><Pencil /> Edit</DropdownMenuItem>}
            {ownMessage && <DropdownMenuItem onClick={() => void onDelete(message)} variant="destructive"><Trash2 /> Delete</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </article>
  )
}

type ConversationTarget =
  | { type: "channel"; channel: ChannelDTO }
  | { type: "dm"; conversation: DirectConversationDTO }

export function ChannelMessages({ target, user }: { target: ConversationTarget; user: AuthUserDTO }) {
  const [historyState, setHistoryState] = useState<HistoryState>("loading")
  const [messages, setMessages] = useState<ClientMessage[]>([])
  const [historyError, setHistoryError] = useState("")
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [draft, setDraft] = useState("")
  const [composerError, setComposerError] = useState("")
  const [replyingTo, setReplyingTo] = useState<MessageDTO | null>(null)
  const [socketState, setSocketState] = useState<SocketState>("connecting")
  const [typingUsers, setTypingUsers] = useState<TypingUpdateEvent["user"][]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<RelaySocket | null>(null)
  const pendingTimeouts = useRef(new Map<string, number>())
  const shouldScrollToBottom = useRef(true)
  const olderScrollHeight = useRef<number | null>(null)
  const initialRequest = useRef(0)
  const typingStopTimeout = useRef<number | null>(null)
  const lastTypingStart = useRef(0)
  const archived = target.type === "channel" && Boolean(target.channel.archivedAt)
  const conversationId = target.type === "channel" ? target.channel.id : target.conversation.id
  const workspaceId = target.type === "channel" ? target.channel.workspaceId : target.conversation.workspaceId
  const conversationRef = { type: target.type, id: conversationId } as const
  const title = target.type === "channel" ? `#${target.channel.name}` : target.conversation.otherUser.name
  const historyPath = target.type === "channel" ? `/channels/${conversationId}/messages` : `/direct-conversations/${conversationId}/messages`
  const draftCodePoints = Array.from(draft.trim()).length

  async function loadInitial() {
    const request = ++initialRequest.current
    setHistoryState("loading")
    setHistoryError("")
    try {
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
        if ("ok" in event) return
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
    })
    socket.on("message:new", (event) => {
      if (target.type === "channel" ? event.message.channelId !== conversationId : event.message.directConversationId !== conversationId) return
      shouldScrollToBottom.current = true
      setMessages((current) => mergeMessages(current, [event.message]))
    })
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
      pending.forEach((timeout) => window.clearTimeout(timeout))
      pending.clear()
      socket.disconnect()
      socketRef.current = null
    }
  }, [archived, conversationId, workspaceId, target.type, user.id])

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
      conversation: conversationRef,
      content: clientMessage.content,
      ...(clientMessage.parentMessageId ? { parentMessageId: clientMessage.parentMessageId } : {}),
    })
  }

  function submitMessage() {
    if (archived) return
    const parsed = validateMessageContent(draft)
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
    setMessages((current) => mergeMessages(current, [optimistic]))
    setDraft("")
    setReplyingTo(null)
    setComposerError("")
    socketRef.current?.emit("typing:stop", { workspaceId, conversation: conversationRef })
    shouldScrollToBottom.current = true
    sendMessage(optimistic)
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
      socket.emit("typing:start", { workspaceId, conversation: conversationRef })
      lastTypingStart.current = now
    }
    if (typingStopTimeout.current) window.clearTimeout(typingStopTimeout.current)
    typingStopTimeout.current = window.setTimeout(() => {
      socket.emit("typing:stop", { workspaceId, conversation: conversationRef })
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

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={`Messages in ${title}`}>
      <div className="min-h-0 flex-1 overflow-y-auto" ref={scrollRef}>
        {historyState === "loading" && (
          <div className="grid min-h-full place-items-center p-6" role="status">
            <div className="text-center"><p className="text-sm font-medium">Loading messages...</p><p className="mt-1 text-xs text-signal-muted">Opening the newest history.</p></div>
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
              <div className="px-5 py-16 sm:px-7"><h2 className="text-lg font-semibold">Start the conversation</h2><p className="mt-1 max-w-md text-xs leading-5 text-signal-muted">Messages sent here are saved in {title}.</p></div>
            ) : messages.map((message) => (
              <MessageRow archived={archived} currentUserId={user.id} key={`${message.id}:${archived}`} message={message} onDelete={deleteMessage} onEdit={editMessage} onReply={(selected) => setReplyingTo(selected)} onRetry={sendMessage} />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-signal-line bg-signal-paper px-3 py-3 sm:px-5">
        {archived ? (
          <div className="mx-auto max-w-6xl rounded-md border border-signal-line bg-signal-surface px-3 py-2.5 text-xs text-signal-muted">This channel is archived. Its history remains available, but messages and replies are read-only.</div>
        ) : (
          <div className="mx-auto max-w-6xl">
            {replyingTo && (
              <div className="flex items-center gap-2 rounded-t-lg border border-b-0 border-signal-line bg-signal-surface-raised px-3 py-2 text-[11px]">
                <CornerUpLeft className="size-3 text-signal-muted" />
                <p className="min-w-0 flex-1 truncate"><span className="font-semibold">Replying to {replyingTo.author.name}</span><span className="text-signal-muted"> · {replyingTo.deletedAt ? "Message deleted" : replyingTo.content}</span></p>
                <Button aria-label="Cancel reply" onClick={() => setReplyingTo(null)} size="icon-xs" type="button" variant="ghost"><X /></Button>
              </div>
            )}
            <div className={cn("overflow-hidden rounded-lg border border-signal-line bg-signal-surface focus-within:border-signal-cyan focus-within:ring-2 focus-within:ring-signal-cyan/10", replyingTo && "rounded-t-none")}>
              {typingUsers.length > 0 && <p className="border-b border-signal-line px-3 py-1.5 text-[11px] text-signal-muted" aria-live="polite">{typingUsers.map((item) => item.name).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...</p>}
              <Textarea
                aria-label={`Message ${title}`}
                aria-describedby={composerError ? "composer-error" : undefined}
                aria-invalid={Boolean(composerError) || draftCodePoints > MESSAGE_CODE_POINT_LIMIT}
                className="min-h-16 max-h-48 resize-none rounded-none border-0 bg-transparent px-3 py-2.5 text-xs leading-5 shadow-none focus-visible:border-0 focus-visible:ring-0"
                onBlur={() => socketRef.current?.emit("typing:stop", { workspaceId, conversation: conversationRef })}
                onChange={(event) => { setDraft(event.target.value); if (composerError) setComposerError(""); emitTypingStart() }}
                onKeyDown={handleComposerKeyDown}
                placeholder={`Message ${title}`}
                value={draft}
              />
              <div className="flex min-h-9 items-center gap-3 border-t border-signal-line px-2.5">
                <span className={cn("font-mono text-[9px] tabular-nums text-signal-muted", draftCodePoints > MESSAGE_CODE_POINT_LIMIT && "text-destructive")}>{draftCodePoints}/{MESSAGE_CODE_POINT_LIMIT}</span>
                <span className="hidden text-[9px] text-signal-muted sm:inline">Enter to send · Shift+Enter for a new line</span>
                <span className="text-[9px] text-signal-muted" aria-live="polite">{socketState === "connected" ? "Live" : socketState === "connecting" ? "Connecting..." : "Offline"}</span>
                <Button aria-label="Send message" className="ml-auto size-7 bg-signal-amber text-signal-carbon hover:bg-signal-amber/90" disabled={!draft.trim() || draftCodePoints > MESSAGE_CODE_POINT_LIMIT} onClick={submitMessage} size="icon-xs" type="button"><Send /></Button>
              </div>
            </div>
            {composerError && <p className="mt-1.5 text-[11px] text-destructive" id="composer-error" role="alert">{composerError}</p>}
          </div>
        )}
      </div>
    </section>
  )
}
