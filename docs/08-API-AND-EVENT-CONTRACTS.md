# Relay — API & Event Contracts

## 1. Contract Principle

HTTP and WebSocket contracts must be explicitly typed in both applications.

Do not expose Prisma models directly as external contracts.

The backend owns canonical DTOs, validation schemas, and socket payload definitions. The frontend mirrors or generates only the contracts it consumes. Do not create a root workspace or shared package and do not import backend source into the frontend.

## 2. HTTP API Groups

Suggested resource groups:

```text
/auth
/workspaces
/workspaces/:workspaceId/members
/workspaces/:workspaceId/invitations
/workspaces/:workspaceId/channels
/workspaces/:workspaceId/sync
/channels/:channelId/messages
/direct-conversations
/direct-conversations/:id/messages
/messages/:messageId
/messages/:messageId/reactions
/search
/attachments
/me
```

## 3. Example HTTP Operations

### Workspaces
- POST `/workspaces`
- GET `/workspaces`
- GET `/workspaces/:id`
- PATCH `/workspaces/:id`

### Invitations
- GET `/workspaces/invitations/:token` (public limited preview)
- POST `/workspaces/:workspaceId/invitations`
- DELETE `/workspaces/:workspaceId/invitations/:invitationId`
- POST `/workspaces/invitations/accept`

The public preview returns only workspace display name, masked invited email, assigned role, expiry, and lifecycle status. Raw tokens are stored only as hashes and are returned once when an invitation is created so the authorized sender can share the invitation link.

### Channels
- POST `/workspaces/:workspaceId/channels`
- GET `/workspaces/:workspaceId/channels`
- PATCH `/channels/:channelId`
- POST `/channels/:channelId/archive`

### Messages
- GET `/channels/:channelId/messages?cursor=...&limit=50`
- POST `/channels/:channelId/messages`
- GET `/direct-conversations/:id/messages?cursor=...&limit=50`
- POST `/direct-conversations/:id/messages`
- PATCH `/messages/:messageId`
- DELETE `/messages/:messageId`

Both POST routes accept the same `operationId`, content, reply, and attachment command as `message:send`. The HTTP routes and socket handler call one backend message service. The first successful HTTP creation returns `201`; an idempotent retry returns the existing canonical message with `200` and never broadcasts a duplicate.

Message history uses opaque base64url keyset cursors containing a cursor version, `createdAt`, and message ID. The default page size is 50 and the maximum is 100. Reconnect synchronization returns at most 200 durable events per request and continues until the client is caught up.

### Reconnect Synchronization

- GET `/workspaces/:workspaceId/sync?after=...&limit=200`

The opaque sync cursor identifies a workspace sync-event sequence and is distinct from a history cursor. The server verifies active workspace membership, filters every event by current conversation access and optional recipient, and returns events in ascending sequence order.

```ts
type WorkspaceSyncEvent =
  | SyncEvent<'workspace:update', { workspace: WorkspaceDTO }>
  | SyncEvent<'channel:new', { channel: ChannelDTO }>
  | SyncEvent<'channel:update', { channel: ChannelDTO }>
  | SyncEvent<'channel:archive', { channel: ChannelDTO }>
  | SyncEvent<'channel:restore', { channel: ChannelDTO }>
  | SyncEvent<'dm:new', { conversation: DirectConversationDTO }>
  | SyncEvent<'membership:update', { member: WorkspaceMemberDTO }>
  | SyncEvent<'membership:remove', { userId: string }>
  | SyncEvent<'invitation:new', { invitation: WorkspaceInvitationDTO }>
  | SyncEvent<'invitation:accept', { invitationId: string; userId: string }>
  | SyncEvent<'invitation:revoke', { invitationId: string }>
  | SyncEvent<'message:new', { message: MessageDTO }>
  | SyncEvent<'message:update', { message: MessageDTO }>
  | SyncEvent<'message:delete', { message: MessageDTO }>
  | SyncEvent<'reaction:update', { messageId: string; reactions: ReactionSummaryDTO[] }>
  | SyncEvent<'conversation:read:update', { readState: ConversationReadStateDTO }>;

interface SyncEvent<TType extends string, TData> {
  sequence: string; // PostgreSQL bigint serialized for JSON.
  type: TType;
  occurredAt: string;
  data: TData;
}

interface WorkspaceSyncResponse {
  events: WorkspaceSyncEvent[];
  nextCursor: string;
  hasMore: boolean;
  resetRequired: boolean;
}
```

V1 does not prune sync events automatically, so `resetRequired` is normally false. The field reserves an explicit recovery contract for future retention or an invalidated cursor. A reset refreshes authorized workspace navigation, read state, and currently loaded conversation windows.

When `after` is omitted, the endpoint returns no events and a `nextCursor` at the current workspace high-water sequence. Workspace entry obtains this checkpoint before loading the authorized snapshot, buffers live durable socket events during loading, then requests sync after the checkpoint. Sequence and canonical entity IDs deduplicate buffered, snapshot, and sync data.

Each page scans at most `limit` raw workspace log rows. `nextCursor` advances to the highest scanned sequence even when authorization or recipient filtering returns no visible events. `hasMore` reports whether later raw rows exist. This guarantees forward progress without exposing filtered events.

Every durable socket broadcast includes the corresponding sync `sequence`, but socket arrival alone never advances the persisted sync cursor because filtered sequence gaps may exist. Only an HTTP sync response certifies the highest scanned sequence and advances that cursor. Socket events update the UI immediately and schedule a debounced sync; duplicate delivery is harmless through sequence and canonical-entity reconciliation.

## 4. Socket Event Naming

Use consistent `domain:action` naming.

### Connection / Subscription
```text
conversation:join
conversation:leave
```

### Messages
```text
message:send
message:ack
message:new
message:update
message:delete
message:error
```

### Reactions
```text
reaction:toggle
reaction:update
```

### Typing
```text
typing:start
typing:stop
typing:update
```

### Presence
```text
presence:update
```

### Read State
```text
conversation:read
conversation:read:update
```

## 5. Example Message Send Contract

Client -> Server:

```ts
interface MessageSendEvent {
  operationId: string; // UUID generated once and reused for retries
  workspaceId: string;
  conversation: {
    type: 'channel' | 'dm';
    id: string;
  };
  content: string;
  parentMessageId?: string;
  attachmentIds?: string[];
}
```

Server -> Sender acknowledgement:

```ts
interface MessageAckEvent {
  operationId: string;
  sequence: string;
  message: MessageDTO;
}
```

Server -> Conversation members:

```ts
interface MessageNewEvent {
  sequence: string;
  message: MessageDTO;
}
```

All durable update/delete/reaction/read/channel/member socket broadcasts follow the same envelope rule and include `sequence`. Ephemeral presence and typing events do not.

## 6. Error Contract

Errors should expose stable machine-readable codes.

Examples:

```text
UNAUTHORIZED
FORBIDDEN
WORKSPACE_NOT_FOUND
CHANNEL_NOT_FOUND
CONVERSATION_NOT_FOUND
MESSAGE_TOO_LONG
MESSAGE_SEND_RATE_LIMITED
ATTACHMENT_NOT_ALLOWED
SESSION_NOT_FRESH
SYNC_CURSOR_INVALID
```

## 7. Versioning

HTTP routes use the `/api` prefix without a public `/v1` namespace. Internal DTO and event-contract changes must remain intentional and synchronized between applications.

## 8. Contract Ownership

Canonical contracts live in the backend near their owning module. Frontend request, response, and socket types live in the frontend API layer. A documented generation step may be added later if manual mirroring becomes error-prone, but the repository remains two independent applications without shared packages.

## 9. Product Limits

- Message content: 4,000 Unicode code points.
- Attachments: 5 per message, 25 MiB each, 50 MiB combined.
- Search: 25 results by default, 50 maximum.
- Stable validation errors include `MESSAGE_EMPTY`, `MESSAGE_TOO_LONG`, `ATTACHMENT_TOO_LARGE`, `ATTACHMENT_LIMIT_EXCEEDED`, `CHANNEL_ARCHIVED`, and `INVALID_CURSOR`.
