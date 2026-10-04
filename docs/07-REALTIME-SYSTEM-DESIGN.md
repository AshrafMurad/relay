# Relay — Real-Time System Design

## 1. Purpose

Real-time behavior is the technical core of Relay. This document defines the expected behavior for WebSocket connections, rooms, messages, presence, typing, read state, reconnects, acknowledgements, and scaling.

## 2. Connection Lifecycle

1. User authenticates through the normal auth flow.
2. Browser opens a Socket.IO connection to the Express/Socket.IO backend.
3. Backend validates the authenticated session/token.
4. Backend associates the socket with the user.
5. Socket joins authorized workspace/user rooms.
6. Client subscribes to active conversation context as needed.
7. Backend tracks active connections for presence.

Unauthenticated sockets are rejected.

Relay uses the opaque Better Auth session cookie rather than a separate socket token. Every reconnect performs a new database-backed session check. The Socket.IO handshake may establish user identity, but each resource event still performs current workspace and conversation authorization.

## 3. Room Strategy

Suggested rooms:

```text
user:{userId}
workspace:{workspaceId}
channel:{channelId}
dm:{conversationId}
```

Joining any room requires server-side authorization.

## 4. Sending a Message

Recommended sequence:

1. Client creates a temporary message ID.
2. Client renders optimistic message.
3. Client emits `message:send` with the stable `operationId` and message payload; the temporary UI ID remains local.
4. Server validates authentication and conversation access.
5. Server validates content.
6. Server persists the message in PostgreSQL.
7. Server acknowledges the sender with canonical message data.
8. Server broadcasts the canonical message to authorized room members.
9. Client replaces the temporary message with the canonical server message.

## 5. Idempotency / Deduplication

The client sends a client-generated UUID `operationId` that is distinct from any temporary UI ID.

Every send carries a UUID `operationId`, and PostgreSQL enforces uniqueness on `(authorId, operationId)`. A duplicate retry returns the original canonical message.

The frontend must deduplicate messages by canonical server ID and reconcile optimistic items.

## 6. Delivery Acknowledgement

At minimum distinguish:

- pending;
- sent/acknowledged;
- failed.

A full WhatsApp-style delivered/read receipt system is not required for V1.

The client waits 10 seconds for an acknowledgement before showing the send as failed and offering retry. A late acknowledgement must still reconcile safely.

## 7. Reconnection

When a socket reconnects:

1. reauthenticate;
2. restore authorized room subscriptions;
3. refresh presence state;
4. call `GET /api/workspaces/:workspaceId/sync` with the last acknowledged workspace sync cursor;
5. reconcile unread state;
6. avoid replaying duplicates.

The server should not assume that Socket.IO reconnect alone guarantees the client received all durable events during disconnection.

Reconnect attempts use exponential backoff from 1 to 30 seconds with jitter. A synchronization response contains at most 200 ordered durable events; the client applies canonical DTOs and follows `nextCursor` until `hasMore` is false.

## 8. Missed Event Recovery

PostgreSQL is the source of truth.

Client-visible durable mutations append a `WorkspaceSyncEvent` in the same PostgreSQL transaction as the domain change. The workspace sync cursor is a monotonic event sequence, distinct from backward message-history pagination. Sync covers workspace, channel, DM, membership, invitation, message, reaction, and read-state changes; the server reauthorizes and hydrates current canonical DTOs when serving them. Presence and typing are excluded. If a future retention policy invalidates a cursor, `resetRequired` instructs the client to refresh authorized workspace summaries, read state, and loaded conversations.

On initial workspace entry, the connected client requests sync without `after` to capture the current high-water checkpoint, buffers durable socket events, loads the authorized workspace snapshot, and then syncs after the checkpoint. Every durable socket event carries its workspace sequence. HTTP sync scans up to 200 raw log rows per page and advances to the highest scanned sequence even if permission filtering yields no visible events.

Socket events update the UI immediately but never advance the persisted sync cursor because an unseen or delayed authorized event may occupy an earlier sequence. Only `nextCursor` from HTTP sync certifies progress through scanned rows. Receiving durable socket activity schedules a debounced sync from the last certified cursor; already-applied events reconcile idempotently.

## 9. Presence

Presence must account for multiple sockets per user.

Example logic:

- first active socket -> user becomes online;
- additional sockets -> remain online;
- closing one of several sockets -> remain online;
- final active socket closes -> after grace period, user becomes offline.

Use Redis to coordinate presence across instances.

The offline grace period is 15 seconds. Socket.IO uses a 25-second ping interval and a 20-second ping timeout.

## 10. Typing Indicators

Suggested flow:

```text
typing:start
typing:stop
```

Client behavior:

- debounce emissions;
- do not emit every keystroke;
- automatically stop after inactivity.
- stop immediately on send, blur, conversation change, or disconnect.
- emit a start/refresh event at most once every 3 seconds.

Server behavior:

- verify conversation access;
- broadcast to everyone except sender;
- never persist typing history.
- expire typing state after 5 seconds even when a stop event is missed.

## 11. Reactions

Reaction changes are durable.

Flow:

1. client requests toggle;
2. backend authorizes and writes to PostgreSQL;
3. backend broadcasts canonical reaction state/event;
4. all clients reconcile.

## 12. Read State

Read state should be persisted.

Suggested event:

```text
conversation:read
```

Payload includes conversation identity and latest visible/read message.

Backend verifies membership before updating state.

## 13. Event Ordering

Do not rely solely on network arrival order.

Canonical persisted timestamps/IDs should determine message ordering. The UI should reconcile late acknowledgements or delayed events.

## 14. Authorization

Every incoming event that references a workspace/channel/conversation must perform permission checks.

Joining a socket room is not itself sufficient authorization for future operations.

## 15. Rate Limits

Apply limits to abuse-prone events such as:

- message sends;
- reaction spam;
- typing signals;
- channel joins/subscriptions.

Concrete limits:

- message sends: 30 per 10 seconds and 300 per 5 minutes per user;
- reaction changes: 60 per minute per user;
- typing events: 20 per 10 seconds per user and conversation;
- conversation joins: 60 per minute per socket.

## 16. Multi-Instance Scaling

When more than one Express/Socket.IO instance exists, use the Socket.IO Redis adapter so broadcasts reach users connected to different instances.

V1 initially runs one API instance. If Redis becomes unavailable, durable messages continue through PostgreSQL and the same numeric limits are enforced in process; presence is reported as unavailable and typing is disabled until Redis recovers. Readiness remains degraded because in-process counters reset on restart and cannot coordinate multiple instances.

## 17. Failure Cases to Test

- duplicate message send;
- temporary network loss;
- reconnect after missed messages;
- authorization revoked while connected;
- channel archived while open;
- user removed from workspace while connected;
- multiple browser tabs;
- optimistic message rejected;
- delayed acknowledgement;
- Redis temporarily unavailable;
- client receives an event for already-loaded data.
