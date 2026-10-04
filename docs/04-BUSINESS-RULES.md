# Relay — Business Rules

## 1. Workspace Roles

### Owner
- Full workspace control.
- Can update workspace settings.
- Can manage members and roles.
- Can create/archive channels.
- Cannot be removed by a lower role.

### Admin
- Can invite and remove Members.
- Can create, update, archive, and restore channels.
- Cannot invite, remove, or change the role of an Admin.
- Cannot update workspace settings.
- Cannot transfer ownership unless explicitly supported later.

### Member
- Can participate in accessible channels and DMs.
- Cannot perform protected workspace administration actions.

## 2. Workspace Membership

- A user must be an active workspace member to access workspace data.
- Membership is checked on both HTTP and WebSocket paths.
- Removing a member invalidates future workspace access.
- Active socket connections for removed members should be disconnected from workspace rooms or lose authorization immediately.
- Membership status is `ACTIVE` or `REMOVED`; removal retains the record and records removal metadata.
- Accepting a later authorized invitation may reactivate a removed membership.
- Each workspace has exactly one active Owner, represented by membership role rather than a duplicate workspace owner field.
- Workspace creation atomically creates the Owner membership.
- Ownership transfer is out of scope, so role-change operations cannot assign, remove, or demote `OWNER`.
- Reactivating a removed membership replaces its old role with the accepted invitation's `ADMIN` or `MEMBER` role before setting it active.

## 3. Invitations

- Invitations are workspace-scoped.
- Invitation tokens expire.
- A used or revoked invitation cannot be accepted again.
- Acceptance and revocation are mutually exclusive terminal states and are applied atomically.
- Role assigned by the invitation must respect inviter permissions.
- Invitations expire after 7 days.
- Owners may invite Admins or Members; Admins may invite Members only.
- Owners may revoke any pending invitation; Admins may revoke any pending Member-role invitation.

## 4. Channels

- Every channel belongs to exactly one workspace.
- A channel cannot be accessed from another workspace.
- Channel names contain 2 to 80 lowercase letters, numbers, hyphens, or underscores.
- Channel names are case-insensitively unique across active and archived channels in a workspace.
- Archived channels remain readable and searchable but reject messages, replies, edits, reactions, and new attachments.
- Owners and Admins may restore archived channels.
- The default `general` channel cannot be archived.

## 5. Messages

- Every message belongs to one conversation context.
- Authors may edit their own messages.
- Authors may delete their own messages unless policy changes.
- Admin deletion can be added but is not required for V1.
- Editing preserves an `editedAt` timestamp.
- Deleted messages use soft-delete tombstones to preserve reply/reference integrity.
- Message content is limited to 4,000 Unicode code points after trimming.
- A message must contain non-whitespace text or at least one attachment.
- Deletion clears content and preserves a tombstone row for references.
- A message may contain at most 5 attachments.

## 6. Message Ordering

- The server is authoritative for persisted message ordering.
- Client temporary IDs are used for optimistic messages.
- Server IDs replace temporary IDs after acknowledgement.
- Duplicate delivery must not create duplicate UI messages.
- The backend enforces uniqueness on `(authorId, operationId)` so retried sends return the original message.

## 7. Reactions

- A user may add a given emoji reaction once per message.
- Repeating the same reaction toggles/removes it.
- Reactions inherit message access rules.

## 8. Replies

- A reply references another message.
- Replies must remain in the same conversation context.
- Reply previews should degrade gracefully if the referenced message is deleted.

## 9. Typing State

- Typing state is ephemeral.
- Typing state is never persisted as durable business data.
- Typing expires automatically after a short timeout.
- Typing events must be rate-limited/debounced on the client.
- The client stops typing after 3 seconds of inactivity and refreshes typing state at most once every 3 seconds.
- Server typing state expires after 5 seconds.

## 10. Presence

- Presence is ephemeral and primarily managed through Redis/socket lifecycle state.
- A user may have multiple active browser sessions.
- A user is considered offline only when no active relevant connection remains, subject to heartbeat/grace-period logic.
- The final disconnect starts a 15-second grace period before the user becomes offline.

## 11. Read State

- Read state is persisted.
- Read tracking should be conversation-specific.
- The client should not mark a conversation as read merely because data was fetched; the conversation should be actively viewed.
- Read markers only move forward by canonical `(createdAt, id)` order; delayed updates from another tab cannot regress them.

## 12. Attachments

- File type and size restrictions must be enforced server-side.
- Attachment metadata is stored in PostgreSQL.
- Binary data is stored outside PostgreSQL.
- Users may access an attachment only if they can access its associated message/conversation.
- Each file is limited to 25 MiB; a message is limited to 50 MiB combined and 5 attachments.
- Pending unattached uploads expire after 24 hours.
- The default workspace storage quota is 5 GiB.
- `PENDING` requires no message, `ATTACHED` requires a message, and attachment is a one-way transition performed once in the message-creation transaction.

## 13. Direct Conversations

- Direct conversations are one-to-one and workspace-scoped.
- A workspace has at most one conversation for an unordered pair of active members.
- The backend creates a canonical participant key from the sorted user IDs and enforces uniqueness with the workspace ID.
- `(conversationId, userId)` is unique and exactly two distinct member rows are required.

## 14. Search

- Search results are always workspace-scoped.
- Results must never expose inaccessible conversation content.
- Search excludes deleted messages and attachment binary contents.
- Search defaults to 25 results and allows at most 50.

## 15. Authorization Rule

Never trust client-provided workspace, channel, conversation, or user identifiers without verifying membership and permission on the server.

## 16. Permission Matrix

| Action | Owner | Admin | Member |
| --- | --- | --- | --- |
| Update workspace | Yes | No | No |
| Invite Member | Yes | Yes | No |
| Invite Admin | Yes | No | No |
| Revoke invitation | Any pending invitation | Any pending Member-role invitation | No |
| Remove Member | Yes | Yes | No |
| Remove Admin | Yes | No | No |
| Change member roles | Yes | No | No |
| Manage channels | Yes | Yes | No |
| Send channel messages and DMs | Yes | Yes | Yes |
| Manage own messages | Yes | Yes | Yes |

Ownership transfer, workspace deletion, and Admin deletion of another user's message are not included in V1. The Owner cannot be removed or demoted.
