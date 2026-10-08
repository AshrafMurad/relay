# Relay - Sprint 0 Decisions

## 1. Status and Authority

This document locks the implementation choices that were intentionally left open in the initial specification. Topic-specific documents should repeat the relevant rules where useful, but this document is authoritative if a provisional statement remains elsewhere.

These decisions do not mean the feature has been implemented.

## 2. Authentication

Relay uses database-backed email and password authentication owned and hosted by the Express backend.

Supported sign-in methods:

- email and password.

Authentication rules:

- Passwords must contain 6 to 128 characters.
- Passwords use scrypt hashing.
- Email verification, password reset, and Google OAuth are not part of the current product scope.

## 3. Sessions and Cookies

Relay uses opaque, database-backed sessions rather than JWT bearer authentication.

- Sessions are stored in PostgreSQL.
- Session lifetime is 7 days.
- Active sessions refresh at most once every 24 hours.
- Security-sensitive account actions require a session no older than 15 minutes or explicit reauthentication.
- Better Auth cookie session caching is disabled so session revocation is immediate.
- Session cookies are `HttpOnly`, `Secure` in production, and `SameSite=Lax`.
- Production cookies remain host-only; cross-subdomain cookies are not used.
- Express validates the session on every protected HTTP request.
- Socket.IO validates the same session cookie during every handshake and reconnect.
- Authentication does not replace workspace, conversation, or resource authorization.

Fresh-session enforcement applies to changing a password or email and revoking all other sessions. A stale session receives `SESSION_NOT_FRESH`; the client reauthenticates and retries the original action. Ordinary workspace and messaging actions require a valid session but not a fresh one.

## 4. Public Routing

Production uses one public origin with reverse-proxy path routing:

```text
https://relay.example.com/             -> Next.js
https://relay.example.com/api/*        -> Express
https://relay.example.com/socket.io/*  -> Express / Socket.IO
```

This keeps browser cookies first-party while the Next.js and Express services remain independently deployed.

Local development uses:

```text
http://localhost:3000  -> Next.js
http://localhost:4000  -> Express / Socket.IO
```

Local cross-origin API requests must use credentials and an exact allowed origin of `http://localhost:3000`.

## 5. Environment Contract

Only deployment-specific settings are environment variables. Product rules such as message length and page size are typed constants, not environment configuration.

Frontend variables:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
```

Backend variables:

```dotenv
NODE_ENV=development
PORT=4000
WEB_ORIGIN=http://localhost:3000
BETTER_AUTH_URL=http://localhost:4000
BETTER_AUTH_SECRET=

DATABASE_URL=postgresql://relay:relay@localhost:5432/relay
REDIS_URL=redis://localhost:6379

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=Relay <no-reply@relay.local>

UPLOAD_DIR=./storage/uploads
LOG_LEVEL=info
TRUST_PROXY=false
```

Rules:

- No secrets may use a `NEXT_PUBLIC_` prefix.
- Production sets `WEB_ORIGIN` and `BETTER_AUTH_URL` to the HTTPS public origin.
- Production enables `TRUST_PROXY` only behind the known Coolify/Traefik proxy.
- Both applications validate their environment with Zod at process startup.
- A missing or malformed required variable prevents startup.
- Example environment files contain placeholders, never real credentials.

Requiredness:

| Variable | Development | Production |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Required; `http://localhost:4000/api` | Required; `https://relay.example.com/api` |
| `NEXT_PUBLIC_SOCKET_URL` | Required; `http://localhost:4000` | Required; `https://relay.example.com` |
| `NODE_ENV` | Required | Required |
| `PORT` | Optional; defaults to `4000` | Optional; defaults to `4000` |
| `WEB_ORIGIN` | Required | Required; HTTPS public Relay origin |
| `BETTER_AUTH_URL` | Required | Required; HTTPS public Relay origin |
| `BETTER_AUTH_SECRET` | Required; at least 32 random bytes | Required; secret manager value |
| `DATABASE_URL` | Required | Required |
| `REDIS_URL` | Required | Required |
| `GOOGLE_CLIENT_ID` | Optional; reserved for future use | Optional; reserved for future use |
| `GOOGLE_CLIENT_SECRET` | Optional; reserved for future use | Optional; reserved for future use |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Required; Mailpit values allowed | Required |
| `SMTP_USER`, `SMTP_PASSWORD` | Optional for local Mailpit | Required when the production SMTP provider authenticates |
| `EMAIL_FROM` | Required | Required and verified by the provider |
| `UPLOAD_DIR` | Optional; defaults to `./storage/uploads` | Required persistent-volume path |
| `LOG_LEVEL` | Optional; defaults to `info` | Optional; defaults to `info` |
| `TRUST_PROXY` | Required; `false` | Required and enabled only for the known proxy |

Test processes use explicit test values or injected email/OAuth adapters; production configuration is never silently disabled because a credential is absent.

## 6. Supported Runtime Matrix

| Component | Supported line |
| --- | --- |
| Node.js | 24.x LTS |
| npm | Version bundled with Node.js 24 |
| TypeScript | 5.9.x |
| Next.js | 16.3.x |
| React | 19.2.x |
| Express | 5.2.x |
| Socket.IO | 4.8.x |
| Prisma | 6.19.x |
| PostgreSQL | 18.x |
| Redis server | 8.2.x |
| Redis Node client | 6.3.x |

Both applications use the same Node.js and TypeScript lines. Production and CI pin Node.js 24 rather than using an unpinned current release. PostgreSQL and Redis should run the latest compatible patch release within the selected line.

## 7. Identifier and Time Conventions

- Durable entity IDs are UUIDs.
- Better Auth is configured to generate UUID identifiers.
- Persisted timestamps use UTC `timestamptz` values.
- API timestamps use ISO 8601 UTC strings.
- Server IDs and persisted timestamps are canonical for message ordering.

## 8. Message Rules

- Message content is safe plain text.
- Maximum content length is 4,000 Unicode code points.
- Leading and trailing whitespace is removed.
- A message must contain non-whitespace text or at least one attachment.
- Editing applies the same validation rules and records `editedAt`.
- Authors may edit and delete only their own messages in V1.
- Deletion clears message content, records `deletedAt`, and preserves a tombstone for references.
- Replies must reference a message in the same conversation.
- Reply references are lightweight; V1 does not create nested thread navigation.
- Every send includes a client-generated UUID `operationId` that is distinct from a temporary UI ID.
- `(authorId, operationId)` is unique so a retry returns the original message.
- A message may contain at most 5 attachments.

## 9. Attachment Rules

- Maximum file size is 25 MiB.
- Maximum combined attachment size per message is 50 MiB.
- Default workspace storage quota is 5 GiB.
- Unattached pending uploads expire after 24 hours and are deleted by cleanup.
- Storage keys are generated by the server and never derived from a client path.
- Files remain outside public static directories.
- Download authorization derives from the associated workspace and conversation.

Allowed MIME types:

```text
image/jpeg
image/png
image/gif
image/webp
application/pdf
text/plain
text/csv
application/json
application/zip
```

The server validates both the MIME type and extension. SVG, HTML, scripts, executables, and unrecognized combinations are rejected.

## 10. Channel Rules

- V1 channels are public to active workspace members.
- Names contain 2 to 80 lowercase letters, numbers, hyphens, or underscores.
- Channel names are case-insensitively unique across active and archived channels in a workspace.
- Owners and Admins may create, update, archive, and restore channels.
- Members cannot manage channels.
- Archived channels remain readable and searchable.
- Archived channels reject messages, replies, edits, reactions, and new attachments.
- The default `general` channel cannot be archived.

## 11. Pagination and Synchronization

Relay uses keyset pagination. Offset pagination is not used for messages.

- Message cursors contain a version, `createdAt`, and message ID.
- Cursors are opaque base64url strings.
- Default message page size is 50.
- Maximum message page size is 100.
- The initial page contains the newest messages.
- Responses normalize messages into oldest-to-newest display order.
- Search defaults to 25 results and allows at most 50.
- Reconnect synchronization returns at most 200 durable events per request and repeats until caught up.
- `(createdAt, id)` provides deterministic ordering when timestamps are equal.

History and reconnect use separate cursors:

- History cursors move backward within one channel or DM using `(createdAt, id)`.
- Reconnect uses `GET /api/workspaces/:workspaceId/sync?after=...&limit=200`.
- A sync cursor is an opaque encoding of the workspace's last durable event sequence.
- The response contains ordered durable event envelopes, `nextCursor`, and `hasMore`.
- Durable event types cover client-visible workspace updates, channel create/update/archive/restore, DM creation, membership changes, invitation create/accept/revoke, message create/update/delete, reaction changes, and read-state changes.
- Domain state remains authoritative; sync events identify what canonical state clients must reconcile.
- Presence and typing are excluded because they are ephemeral.
- V1 retains the sync log without automatic time-based pruning. If retention is added later, an expired cursor returns `resetRequired: true` and the client performs a full authorized refresh.
- Calling sync without `after` returns no events and a checkpoint at the current workspace high-water sequence for initial snapshot loading.
- Sync scans at most 200 raw rows and advances `nextCursor` to the highest scanned sequence even if authorization filtering returns fewer or zero visible events.
- Durable socket broadcasts carry the same sequence; clients buffer during snapshot loading and deduplicate socket, snapshot, and sync data by sequence and canonical entity ID.
- Socket arrival never advances the persisted sync cursor because filtered sequence gaps may exist. Only HTTP sync advances the cursor to its certified highest scanned sequence; socket events schedule a debounced sync checkpoint.

## 12. Timing and Connection Values

| Behavior | Value |
| --- | --- |
| Message acknowledgement timeout | 10 seconds |
| Socket reconnect delay | Exponential backoff from 1 to 30 seconds with jitter |
| Typing inactivity stop | 3 seconds |
| Typing start refresh | At most once every 3 seconds |
| Typing server expiry | 5 seconds |
| Presence offline grace period | 15 seconds |
| Socket.IO ping interval | 25 seconds |
| Socket.IO ping timeout | 20 seconds |
| General HTTP request timeout | 15 seconds |
| Upload request timeout | 60 seconds |
| Graceful server shutdown | 30 seconds |
| Workspace invitation lifetime | 7 days |

Typing stops immediately after send, blur, conversation change, or disconnect.

## 13. Rate Limits

| Operation | Limit |
| --- | --- |
| General authenticated API | 300 requests per minute per user |
| Sign-in attempts | 5 per 15 minutes per IP and normalized email |
| Sign-up attempts | 5 per hour per IP |
| Invitations sent | 20 per hour per workspace and actor |
| Invitation acceptance | 10 per 15 minutes per IP |
| Message sending | 30 per 10 seconds and 300 per 5 minutes per user |
| Reaction changes | 60 per minute per user |
| Typing events | 20 per 10 seconds per user and conversation |
| Conversation joins | 60 per minute per socket |
| Searches | 30 per minute per user |
| Upload starts | 10 per minute per user |

Redis coordinates distributed application rate limits. If Redis is unavailable, the single-instance V1 API enforces the same numeric limits with in-process counters, marks readiness as degraded, reports presence as unavailable, disables typing indicators, and continues PostgreSQL-backed durable operations. In-process counters reset on restart and are not a multi-instance substitute.

## 14. Role Matrix

| Action | Owner | Admin | Member |
| --- | --- | --- | --- |
| Update workspace | Yes | No | No |
| Invite Member | Yes | Yes | No |
| Invite Admin | Yes | No | No |
| Revoke invitation | Any pending invitation | Any pending Member-role invitation | No |
| Remove Member | Yes | Yes | No |
| Remove Admin | Yes | No | No |
| Change member roles | Yes | No | No |
| Create, update, archive, or restore channels | Yes | Yes | No |
| Send channel messages and DMs | Yes | Yes | Yes |
| Manage own messages | Yes | Yes | Yes |

Ownership transfer, workspace deletion, and Admin deletion of another user's message are out of scope for V1. The Owner cannot be removed or demoted.

Ownership has one source of truth: the workspace's active `WorkspaceMember` with role `OWNER`. Workspace creation atomically inserts the workspace and its Owner membership. A partial unique database index prevents more than one active Owner, while service guards prevent removing or demoting the Owner. No V1 role-change operation may assign `OWNER`. Membership status is `ACTIVE` or `REMOVED`; removal retains the row for history and immediately revokes access. Accepting a later authorized invitation replaces the retained role with the invitation's `ADMIN` or `MEMBER` role before atomically reactivating the membership.

## 15. State Transition Invariants

- Read state is monotonic. The backend updates it only when the submitted message is later than the stored marker by canonical `(createdAt, id)` order.
- A `PENDING` attachment has `messageId = null`; an `ATTACHED` attachment has a non-null `messageId`.
- Attachment state only moves from `PENDING` to `ATTACHED`, in the same transaction that creates the message.
- An attachment may be attached once and only by its uploader in its original workspace.
- Invitation acceptance locks or conditionally updates the invitation row so concurrent requests can succeed at most once.
- `acceptedAt` and `revokedAt` are mutually exclusive terminal states.
- Expired, accepted, or revoked invitations cannot be accepted.

## 16. Direct Messages, Search, and Notifications

- A workspace has at most one direct conversation for an unordered pair of active members.
- The service creates a canonical participant key from the two sorted user IDs and enforces uniqueness with the workspace ID.
- Direct conversations never cross workspace boundaries.
- Search uses PostgreSQL full-text search over non-deleted message content.
- Every search query is workspace-scoped and then filtered by conversation access.
- Search never returns another user's inaccessible DM.
- Search does not include attachment binary contents in V1.
- A durable Notification table is deferred until mentions or another committed notification behavior requires it.
- Mentions, private channels, pinned messages, saved messages, and browser notifications remain optional V1+ work.

## 17. Scaling and Contract Decisions

- V1 starts with one Express/Socket.IO instance.
- Redis still owns presence coordination and rate-limit state.
- The Socket.IO Redis adapter is introduced when more than one API instance is deployed.
- HTTP endpoints use the `/api` prefix without a public `/v1` namespace.
- Socket events use `domain:action` names.
- The backend owns canonical DTOs, schemas, and event payload definitions.
- The frontend mirrors or generates only the contracts it consumes.
- There is no root workspace and no shared contracts package.
