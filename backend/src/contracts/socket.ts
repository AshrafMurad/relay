import type { ConversationReadStateDTO, MessageDTO, ReactionSummaryDTO } from "../modules/messages/message.contracts.js";

export interface SystemReadyEvent {
  connectedAt: string;
}

export interface SystemPongEvent {
  receivedAt: string;
}

export interface ConversationRef {
  type: "channel" | "dm";
  id: string;
}

export interface ConversationJoinEvent {
  workspaceId: string;
  conversation: ConversationRef;
}

export interface MessageSendEvent {
  operationId: string;
  workspaceId: string;
  conversation: ConversationRef;
  content: string;
  parentMessageId?: string | null;
  attachmentIds?: string[];
}

export interface MessageAckEvent {
  operationId: string;
  sequence: string;
  message: MessageDTO;
}

export interface MessageNewEvent {
  sequence: string;
  message: MessageDTO;
}

export type MessageUpdateEvent = MessageNewEvent;
export type MessageDeleteEvent = MessageNewEvent;

export interface MessageErrorEvent {
  operationId?: string;
  code: string;
  message: string;
}

export interface ReactionToggleEvent {
  workspaceId: string;
  messageId: string;
  emoji: string;
}

export interface ReactionUpdateEvent {
  sequence: string;
  workspaceId: string;
  conversation: ConversationRef;
  messageId: string;
  reactions: ReactionSummaryDTO[];
}

export interface ConversationReadEvent extends ConversationJoinEvent {
  messageId: string;
}

export interface ConversationReadUpdateEvent {
  sequence: string;
  readState: ConversationReadStateDTO;
}

export interface PresenceUpdateEvent {
  userId: string;
  status: "online" | "offline";
}

export interface TypingEvent {
  workspaceId: string;
  conversation: ConversationRef;
}

export interface TypingUpdateEvent extends TypingEvent {
  user: { id: string; name: string };
  typing: boolean;
}

export interface ClientToServerEvents {
  "system:ping": (acknowledge: (event: SystemPongEvent) => void) => void;
  "conversation:join": (event: ConversationJoinEvent, acknowledge?: (event: { ok: true } | MessageErrorEvent) => void) => void;
  "conversation:leave": (event: ConversationJoinEvent) => void;
  "message:send": (event: MessageSendEvent) => void;
  "reaction:toggle": (event: ReactionToggleEvent) => void;
  "conversation:read": (event: ConversationReadEvent) => void;
  "typing:start": (event: TypingEvent) => void;
  "typing:stop": (event: TypingEvent) => void;
}

export interface ServerToClientEvents {
  "system:ready": (event: SystemReadyEvent) => void;
  "message:ack": (event: MessageAckEvent) => void;
  "message:new": (event: MessageNewEvent) => void;
  "message:update": (event: MessageUpdateEvent) => void;
  "message:delete": (event: MessageDeleteEvent) => void;
  "message:error": (event: MessageErrorEvent) => void;
  "reaction:update": (event: ReactionUpdateEvent) => void;
  "conversation:read:update": (event: ConversationReadUpdateEvent) => void;
  "presence:update": (event: PresenceUpdateEvent) => void;
  "typing:update": (event: TypingUpdateEvent) => void;
}

export type InterServerEvents = Record<string, never>;

export interface SocketData {
  userId?: string;
  email?: string;
  workspaceIds?: Set<string>;
}
