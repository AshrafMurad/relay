import { io, type Socket } from "socket.io-client"

import { parsePublicEnvironment } from "@/env"
import type { ConversationJoinEvent, MessageAckEvent, MessageErrorEvent, MessageNewEvent, MessageSendEvent, PresenceUpdateEvent, TypingEvent, TypingUpdateEvent } from "@/lib/api/contracts"

interface ServerToClientEvents {
  "message:ack": (event: MessageAckEvent) => void
  "message:new": (event: MessageNewEvent) => void
  "message:error": (event: MessageErrorEvent) => void
  "presence:update": (event: PresenceUpdateEvent) => void
  "typing:update": (event: TypingUpdateEvent) => void
}

interface ClientToServerEvents {
  "conversation:join": (event: ConversationJoinEvent, acknowledge?: (event: { ok: true } | MessageErrorEvent) => void) => void
  "conversation:leave": (event: ConversationJoinEvent) => void
  "message:send": (event: MessageSendEvent) => void
  "typing:start": (event: TypingEvent) => void
  "typing:stop": (event: TypingEvent) => void
}

const environment = parsePublicEnvironment({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
  NODE_ENV: process.env.NODE_ENV,
})

export type RelaySocket = Socket<ServerToClientEvents, ClientToServerEvents>

export function createRelaySocket(): RelaySocket {
  return io(environment.NEXT_PUBLIC_SOCKET_URL, {
    withCredentials: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 30_000,
    randomizationFactor: 0.5,
  })
}
