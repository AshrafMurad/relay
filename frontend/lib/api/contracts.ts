export type DependencyHealthStatus = "ok" | "unavailable";
export type ApiReadinessStatus = "ok" | "degraded" | "unavailable";

export interface ApiReadinessResponse {
  service: "relay-api";
  status: ApiReadinessStatus;
  timestamp: string;
  checks: {
    postgres: { status: DependencyHealthStatus; latencyMs: number };
    redis: { status: DependencyHealthStatus; latencyMs: number };
  };
}

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

export interface AuthUserDTO {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export interface WorkspaceDTO {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  currentUserRole: WorkspaceRole;
}

export interface WorkspaceMemberDTO {
  id: string;
  userId: string;
  email: string;
  name: string;
  image: string | null;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface WorkspaceInvitationDTO {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedById: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface WorkspaceInvitationPreviewDTO {
  workspaceName: string;
  emailHint: string;
  role: "ADMIN" | "MEMBER";
  status: "PENDING" | "EXPIRED" | "ACCEPTED" | "REVOKED";
  expiresAt: string;
}

export interface ChannelDTO {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  createdById: string;
  archivedAt: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  lastReadMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DirectConversationDTO {
  id: string;
  workspaceId: string;
  participantKey: string;
  otherUser: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  lastMessageAt: string | null;
  unreadCount: number;
  lastReadMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageDTO {
  id: string;
  workspaceId: string;
  channelId: string | null;
  directConversationId: string | null;
  operationId: string;
  author: {
    id: string;
    name: string;
    image: string | null;
  };
  content: string;
  parentMessageId: string | null;
  parent: {
    id: string;
    authorName: string;
    content: string;
    deletedAt: string | null;
  } | null;
  attachments: AttachmentDTO[];
  reactions: ReactionSummaryDTO[];
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentDTO {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
  createdAt: string;
}

export interface PendingAttachmentDTO {
  id: string;
  workspaceId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  expiresAt: string;
}

export interface ReactionSummaryDTO {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface MessageHistoryResponse {
  messages: MessageDTO[];
  nextCursor: string | null;
  hasMore: boolean;
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

export interface SearchMessagesResponse {
  results: MessageDTO[];
  nextCursor: string | null;
  hasMore: boolean;
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
  message?: string;
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

export interface ConversationReadStateDTO {
  workspaceId: string;
  conversation: ConversationRef;
  userId: string;
  lastReadMessageId: string;
  lastReadAt: string;
}

export interface ConversationReadUpdateEvent {
  sequence: string;
  readState: ConversationReadStateDTO;
}

export type WorkspaceSyncEvent =
  | { sequence: string; type: "message:new" | "message:update" | "message:delete"; occurredAt: string; data: { message: MessageDTO } }
  | { sequence: string; type: "reaction:update"; occurredAt: string; data: { messageId: string; reactions: ReactionSummaryDTO[] } }
  | { sequence: string; type: "conversation:read:update"; occurredAt: string; data: { readState: ConversationReadStateDTO } }

export interface WorkspaceSyncResponse {
  events: WorkspaceSyncEvent[];
  nextCursor: string;
  hasMore: boolean;
  resetRequired: boolean;
}

export interface PresenceUpdateEvent {
  userId: string;
  status: "online" | "offline";
}

export interface PresenceSnapshotEvent {
  workspaceId: string;
  memberUserIds: string[];
  onlineUserIds: string[];
}

export interface TypingEvent {
  workspaceId: string;
  conversation: ConversationRef;
}

export interface TypingUpdateEvent extends TypingEvent {
  user: { id: string; name: string };
  typing: boolean;
}

export interface ApiErrorResponse {
  error: { code: string; message?: string; requestId?: string };
}
