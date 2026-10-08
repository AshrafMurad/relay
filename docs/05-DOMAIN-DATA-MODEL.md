# Relay — Domain & Data Model

## 1. Main Entities

### User
Fields:

- id
- email
- name
- image
- emailVerified
- createdAt
- updatedAt

Better Auth owns the compatible core user record. Relay domain records reference the same user ID.

### Account
- id
- userId
- providerId
- accountId
- password nullable
- accessToken nullable
- refreshToken nullable
- accessTokenExpiresAt nullable
- refreshTokenExpiresAt nullable
- scope nullable
- idToken nullable
- createdAt
- updatedAt

Relay uses this table for email/password credentials. OAuth provider data is reserved for possible future work.

Unique constraint: `(providerId, accountId)`. The `password` field contains a password hash, never plaintext.

### Session
- id
- userId
- token
- expiresAt
- ipAddress nullable
- userAgent nullable
- createdAt
- updatedAt

Session tokens are unique. Sessions are opaque and database-backed.

### Verification
- id
- identifier
- value
- expiresAt
- createdAt
- updatedAt

This table is reserved for future one-time verification workflows.

### Workspace
- id
- name
- slug
- imageUrl
- createdById
- createdAt
- updatedAt

Ownership is represented only by the workspace's active `WorkspaceMember` with role `OWNER`; `Workspace` does not duplicate an `ownerId` source of truth.

### WorkspaceMember
- id
- workspaceId
- userId
- role: OWNER | ADMIN | MEMBER
- joinedAt
- status: ACTIVE | REMOVED
- removedAt nullable
- removedById nullable

Unique constraint: `(workspaceId, userId)`.

Each workspace must have exactly one active `OWNER`. Enforce this with a PostgreSQL partial unique index on `workspaceId` where role is `OWNER` and status is `ACTIVE`, plus transactional service rules that prevent removing or demoting the current Owner.

Workspace creation atomically inserts the workspace and its Owner membership. V1 role changes cannot assign `OWNER`.

### WorkspaceInvitation
- id
- workspaceId
- email
- role
- tokenHash
- invitedById
- expiresAt
- acceptedAt
- revokedAt
- createdAt

`acceptedAt` and `revokedAt` are mutually exclusive. Acceptance uses a transaction with a row lock or conditional update so only one concurrent request can consume the invitation.

### Channel
- id
- workspaceId
- name
- description
- createdById
- archivedAt
- createdAt
- updatedAt

### DirectConversation
- id
- workspaceId
- participantKey
- createdAt
- updatedAt

Unique constraint: `(workspaceId, participantKey)`. The service builds `participantKey` from the two sorted user IDs so concurrent find-or-create operations resolve to one conversation.

### DirectConversationMember
- id
- conversationId
- userId

For V1 one-to-one DMs, enforce exactly two members at the service layer.

Unique constraint: `(conversationId, userId)` so both participants are distinct rows.

### Message
- id
- workspaceId
- channelId nullable
- directConversationId nullable
- authorId
- operationId
- parentMessageId nullable
- content
- editedAt nullable
- deletedAt nullable
- createdAt
- updatedAt

Constraint: a message belongs to exactly one conversation type.

Unique constraint: `(authorId, operationId)` for durable send idempotency.

### MessageReaction
- id
- messageId
- userId
- emoji
- createdAt

Unique constraint: `(messageId, userId, emoji)`.

### Attachment
- id
- workspaceId
- messageId nullable
- uploaderId
- fileName
- mimeType
- size
- storageKey
- status: PENDING | ATTACHED
- expiresAt nullable
- createdAt

Pending uploads are scoped to their uploader and workspace. They become attached only when the message transaction succeeds; unattached uploads expire after 24 hours.

Database checks enforce `PENDING` with a null `messageId` and `ATTACHED` with a non-null `messageId`. The only allowed transition is `PENDING` to `ATTACHED`, performed once in the message-creation transaction.

### ChannelReadState
- userId
- channelId
- lastReadMessageId nullable
- lastReadAt

Unique constraint: `(userId, channelId)`.

Updates are monotonic by the referenced message's canonical `(createdAt, id)` order.

### DirectConversationReadState
- userId
- directConversationId
- lastReadMessageId nullable
- lastReadAt

Unique constraint: `(userId, directConversationId)`.

Updates are monotonic by the referenced message's canonical `(createdAt, id)` order.

Separate read-state tables avoid nullable polymorphic foreign keys and make the one-state-per-user-and-conversation constraint explicit.

A durable Notification table is deferred until mentions or another committed notification behavior requires it.

### WorkspaceSyncEvent
- sequence: bigint primary key
- workspaceId
- type
- conversationType nullable
- conversationId nullable
- entityId nullable
- recipientUserId nullable
- actorId nullable
- createdAt

Client-visible durable mutations append a sync event in the same database transaction as the domain change. Coverage includes workspace, channel, DM, membership, invitation, message, reaction, and read-state changes. Events contain routing and entity metadata rather than treating a copied payload as domain truth. The synchronization service authorizes each event and hydrates canonical DTOs from current domain records. Presence and typing never enter this table.

## 2. Ephemeral Redis Data

Redis should store short-lived state rather than durable business history.

Examples:

```text
presence:user:{userId}
typing:channel:{channelId}
typing:dm:{conversationId}
socket:user:{userId}
```

Exact structures may evolve.

## 3. Key Relationships

```text
User
 ├── Account
 ├── Session
 ├── WorkspaceMember -> Workspace
 ├── Message
 ├── MessageReaction
 ├── ChannelReadState
 └── DirectConversationReadState

Workspace
 ├── WorkspaceMember
 ├── Channel
 ├── DirectConversation
 ├── WorkspaceInvitation
 ├── Message
 └── WorkspaceSyncEvent

Channel
 └── Message

DirectConversation
 ├── DirectConversationMember
 └── Message

Message
 ├── MessageReaction
 ├── Attachment
 └── parentMessage -> Message
```

## 4. Entity Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ ACCOUNT : authenticates_with
    USER ||--o{ SESSION : owns
    USER ||--o{ WORKSPACE_MEMBER : joins
    USER o|--o{ WORKSPACE_MEMBER : removes
    USER ||--o{ WORKSPACE : creates
    USER ||--o{ WORKSPACE_INVITATION : sends
    USER ||--o{ CHANNEL : creates
    USER ||--o{ DIRECT_CONVERSATION_MEMBER : participates
    USER ||--o{ MESSAGE : authors
    USER ||--o{ MESSAGE_REACTION : creates
    USER ||--o{ ATTACHMENT : uploads
    USER ||--o{ CHANNEL_READ_STATE : tracks
    USER ||--o{ DIRECT_CONVERSATION_READ_STATE : tracks
    USER o|--o{ WORKSPACE_SYNC_EVENT : receives
    USER o|--o{ WORKSPACE_SYNC_EVENT : acts

    WORKSPACE ||--o{ WORKSPACE_MEMBER : contains
    WORKSPACE ||--o{ WORKSPACE_INVITATION : issues
    WORKSPACE ||--o{ CHANNEL : contains
    WORKSPACE ||--o{ DIRECT_CONVERSATION : contains
    WORKSPACE ||--o{ MESSAGE : scopes
    WORKSPACE ||--o{ ATTACHMENT : scopes
    WORKSPACE ||--o{ WORKSPACE_SYNC_EVENT : records

    CHANNEL o|--o{ MESSAGE : contains
    CHANNEL ||--o{ CHANNEL_READ_STATE : has
    DIRECT_CONVERSATION ||--o{ DIRECT_CONVERSATION_MEMBER : has
    DIRECT_CONVERSATION o|--o{ MESSAGE : contains
    DIRECT_CONVERSATION ||--o{ DIRECT_CONVERSATION_READ_STATE : has

    MESSAGE o|--o{ MESSAGE : replies_to
    MESSAGE ||--o{ MESSAGE_REACTION : receives
    MESSAGE o|--o{ ATTACHMENT : includes
    MESSAGE o|--o{ CHANNEL_READ_STATE : last_read
    MESSAGE o|--o{ DIRECT_CONVERSATION_READ_STATE : last_read

    USER {
        uuid id PK
        string email UK
        string name
        string image
        boolean emailVerified
        timestamptz createdAt
    }
    ACCOUNT {
        uuid id PK
        uuid userId FK
        string providerId
        string accountId
        string password
    }
    SESSION {
        uuid id PK
        uuid userId FK
        string token UK
        timestamptz expiresAt
    }
    VERIFICATION {
        uuid id PK
        string identifier
        string value
        timestamptz expiresAt
    }
    WORKSPACE {
        uuid id PK
        uuid createdById FK
        string name
        string slug UK
    }
    WORKSPACE_MEMBER {
        uuid id PK
        uuid workspaceId FK
        uuid userId FK
        string role
        string status
        uuid removedById FK
    }
    WORKSPACE_INVITATION {
        uuid id PK
        uuid workspaceId FK
        string email
        string tokenHash UK
        timestamptz expiresAt
    }
    CHANNEL {
        uuid id PK
        uuid workspaceId FK
        string name
        timestamptz archivedAt
    }
    DIRECT_CONVERSATION {
        uuid id PK
        uuid workspaceId FK
        string participantKey
    }
    DIRECT_CONVERSATION_MEMBER {
        uuid id PK
        uuid conversationId FK
        uuid userId FK
    }
    MESSAGE {
        uuid id PK
        uuid workspaceId FK
        uuid channelId FK
        uuid directConversationId FK
        uuid authorId FK
        uuid parentMessageId FK
        string operationId
        string content
        timestamptz deletedAt
        timestamptz createdAt
    }
    MESSAGE_REACTION {
        uuid id PK
        uuid messageId FK
        uuid userId FK
        string emoji
    }
    ATTACHMENT {
        uuid id PK
        uuid workspaceId FK
        uuid messageId FK
        uuid uploaderId FK
        string storageKey UK
        string status
        bigint size
    }
    CHANNEL_READ_STATE {
        uuid userId FK
        uuid channelId FK
        uuid lastReadMessageId FK
        timestamptz lastReadAt
    }
    DIRECT_CONVERSATION_READ_STATE {
        uuid userId FK
        uuid directConversationId FK
        uuid lastReadMessageId FK
        timestamptz lastReadAt
    }
    WORKSPACE_SYNC_EVENT {
        bigint sequence PK
        uuid workspaceId FK
        string type
        string conversationType
        uuid conversationId
        uuid entityId
        uuid recipientUserId FK
        uuid actorId FK
        timestamptz createdAt
    }
```

## 5. Required Constraints and Indexes

Required constraints and indexes include:

- workspace membership lookups;
- unique `(workspaceId, userId)` membership;
- one active Owner per workspace through a partial unique index and transactional guards;
- unique `(providerId, accountId)` authentication account;
- case-insensitive unique channel name per workspace, including archived channels;
- unique `(workspaceId, participantKey)` direct conversation;
- unique `(conversationId, userId)` direct conversation member;
- messages by channel and `(createdAt, id)`;
- messages by direct conversation and `(createdAt, id)`;
- unique `(authorId, operationId)` message send;
- reactions by message;
- unique `(messageId, userId, emoji)` reaction;
- unique read state by user and channel or DM;
- invitations by token hash / email;
- a check that invitation `acceptedAt` and `revokedAt` are not both set;
- pending attachments by expiry;
- a check matching attachment status to null/non-null `messageId`;
- workspace sync events by `(workspaceId, sequence)` and recipient where applicable;
- a PostgreSQL GIN full-text search index over non-deleted message content.

Database checks or equivalent transactionally enforced service rules must ensure that a message has exactly one conversation target and that reply, attachment, and read-state references remain in the same workspace and conversation.

## 6. Storage Conventions

- Durable IDs are UUIDs.
- Timestamps are UTC `timestamptz` values.
- API timestamps are ISO 8601 UTC strings.
- Message deletion clears content and retains the row as a tombstone.
- Attachment URLs are resolved by an authorized API endpoint and are not stored as public durable URLs.

## 7. Data Isolation

Workspace ID should be carried through workspace-owned records where it improves authorization and query safety, even if it is technically derivable through a relation.
